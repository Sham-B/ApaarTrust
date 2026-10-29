from datetime import datetime
from typing import Dict, Any, List, Tuple
from sqlmodel import Session, select
from backend.app.config import settings
from backend.app.models import (
    ProgrammeSeatMatrix,
    Finding,
    MockCitizen,
    StatusEnum,
)
from backend.app.security import (
    compute_apaar_token,
    mask_apaar,
)
from backend.app.engine.normalizer import (
    compute_name_similarity,
)
from backend.app.engine.seat_matrix import (
    evaluate_seat_compliance,
)

from backend.app.engine.duplicates import (
    find_intra_batch_duplicates,
    check_cross_institution_duplicates,
)
from backend.app.engine.anomaly import (
    detect_dob_clustering,
    detect_nri_fn_spike,
    detect_age_anomalies,
    run_isolation_forest_analysis,
)


def validate_batch(
    raw_rows: List[Dict[str, Any]],
    institution_id: str,
    submission_id: str,
    session: Session,
    academic_year: str = "2024-25"
) -> Tuple[List[Finding], Dict[str, Any], List[Dict[str, Any]]]:
    """
    Core validation engine for ApaarTrust student intake batches.
    Can be run in DRY-RUN mode without committing any changes to database.
    """
    findings: List[Finding] = []
    prepared_students: List[Dict[str, Any]] = []

    # Query institution approved seat matrices
    seat_matrices = session.exec(
        select(ProgrammeSeatMatrix)
        .where(ProgrammeSeatMatrix.institution_id == institution_id)
        .where(ProgrammeSeatMatrix.academic_year == academic_year)
    ).all()
    matrix_by_prog = {sm.programme: sm for sm in seat_matrices}

    # Group students by programme for seat matrix guard
    students_by_prog: Dict[str, List[Dict[str, Any]]] = {}

    # Check Central Mock Registry availability
    registry_down = getattr(settings, "REGISTRY_DOWN", False)

    for idx, raw in enumerate(raw_rows, start=1):
        raw_apaar = str(raw.get("apaar_id", "")).strip().replace("-", "").replace(" ", "")
        name = str(raw.get("name", "")).strip()
        dob = str(raw.get("dob", "")).strip()
        gender = str(raw.get("gender", "Male")).strip().capitalize()
        category = str(raw.get("social_category", "General")).strip()
        quota = str(raw.get("admission_quota", "Regular")).strip()
        nationality = str(raw.get("nationality_status", "Indian")).strip()
        programme = str(raw.get("programme", "B.Tech Computer Science and Engineering")).strip()
        admit_date = str(raw.get("admission_date", "2024-08-15")).strip()
        student_id = str(raw.get("student_id", f"STU-{idx:04d}")).strip()

        token = compute_apaar_token(raw_apaar) if raw_apaar else ""
        masked = mask_apaar(raw_apaar) if raw_apaar else "NOT_PROVIDED"

        student_dict = {
            "row_number": idx,
            "apaar_id": raw_apaar,
            "apaar_token": token,
            "apaar_masked": masked,
            "name": name,
            "dob": dob,
            "gender": gender,
            "social_category": category,
            "admission_quota": quota,
            "nationality_status": nationality,
            "programme": programme,
            "admission_date": admit_date,
            "student_id": student_id,
            "academic_year": academic_year,
            "institution_id": institution_id,
        }
        prepared_students.append(student_dict)

        if programme not in students_by_prog:
            students_by_prog[programme] = []
        students_by_prog[programme].append(student_dict)

        # ---------------- 1. APAAR Format Check ----------------
        if not raw_apaar or len(raw_apaar) != 12 or not raw_apaar.isdigit():
            findings.append(Finding(
                submission_id=submission_id,
                institution_id=institution_id,
                row_number=idx,
                rule_id="APAAR_FORMAT",
                severity="critical",
                plain_reason="APAAR ID must contain exactly 12 numeric digits.",
                evidence={"submitted_value": masked, "length": len(raw_apaar), "is_numeric": raw_apaar.isdigit()},
                benign_hypotheses=[
                    {"title": "Leading Zero Dropped", "description": "Spreadsheet cell formatting stripped leading zeroes from 12-digit number."},
                    {"title": "Non-Numeric Copy Paste", "description": "Accidental dash or enrollment slip number entered instead of APAAR."}
                ],
                fix_hint="Format column as Text in spreadsheet and re-enter 12-digit APAAR ID.",
                status="open",
            ))

        # ---------------- 2. Mock Registry Resolution ----------------
        if raw_apaar and len(raw_apaar) == 12 and raw_apaar.isdigit():
            if registry_down:
                # "When the registry is down or silent the result is 'cannot assess', never 'ok'."
                findings.append(Finding(
                    submission_id=submission_id,
                    institution_id=institution_id,
                    row_number=idx,
                    rule_id="REGISTRY_LOOKUP",
                    severity="medium",
                    plain_reason="Central APAAR Registry is offline or unreachable; cannot assess verification status.",
                    evidence={"status": StatusEnum.SOURCE_UNAVAILABLE, "disposition": StatusEnum.CANNOT_ASSESS},
                    benign_hypotheses=[
                        {"title": "Scheduled Portal Maintenance", "description": "Ministry of Education central gateway scheduled downtime window."}
                    ],
                    fix_hint="Retry submission verification once Central Registry service is restored.",
                    status="open",
                ))
            else:
                citizen = session.exec(select(MockCitizen).where(MockCitizen.apaar_id == raw_apaar)).first()
                if not citizen:
                    findings.append(Finding(
                        submission_id=submission_id,
                        institution_id=institution_id,
                        row_number=idx,
                        rule_id="REGISTRY_LOOKUP",
                        severity="critical",
                        plain_reason="APAAR ID is not registered in the Central APAAR Registry.",
                        evidence={"apaar_masked": masked, "registry_status": "not_found"},
                        benign_hypotheses=[
                            {"title": "Recent Registration", "description": "Student generated APAAR ID within the last 24 hours; synchronization pending."}
                        ],
                        fix_hint="Request DigiLocker APAAR download slip from student to verify number.",
                        status="open",
                    ))
                else:
                    if citizen.status == "suspended":
                        findings.append(Finding(
                            submission_id=submission_id,
                            institution_id=institution_id,
                            row_number=idx,
                            rule_id="REGISTRY_LOOKUP",
                            severity="high",
                            plain_reason="APAAR ID is suspended by the issuing authority.",
                            evidence={"apaar_masked": masked, "registry_status": "suspended"},
                            benign_hypotheses=[{"title": "Biometric Re-KYC", "description": "Citizen UIDAI biometric update required."}],
                            fix_hint="Instruct student to resolve suspension via DigiLocker / Aadhaar Seva Kendra.",
                            status="open",
                        ))

                    if not citizen.consent_flag:
                        findings.append(Finding(
                            submission_id=submission_id,
                            institution_id=institution_id,
                            row_number=idx,
                            rule_id="REGISTRY_CONSENT_MISSING",
                            severity="medium",
                            plain_reason="Citizen verification consent is missing or expired in registry.",
                            evidence={"apaar_masked": masked, "consent_flag": False},
                            benign_hypotheses=[{"title": "Pending e-KYC Consent", "description": "Student skipped institutional consent authorization on portal."}],
                            fix_hint="Ask student to grant e-consent via APAAR DigiLocker mobile app.",
                            status="open",
                        ))

                    # Concordance Checks (Name & DOB)
                    sim = compute_name_similarity(name, citizen.name)
                    if sim < 0.80:
                        findings.append(Finding(
                            submission_id=submission_id,
                            institution_id=institution_id,
                            row_number=idx,
                            rule_id="REGISTRY_MISMATCH_NAME",
                            severity="high",
                            plain_reason=f"Student name '{name}' differs from legal registry name '{citizen.name}'.",
                            evidence={"submitted_name": name, "registry_name": citizen.name, "similarity": round(sim, 2)},
                            benign_hypotheses=[
                                {"title": "Initials or Honorifics", "description": "Different placement of initials or ancestral titles between matriculation and APAAR."},
                                {"title": "Transliteration Variance", "description": "Spelling variations transliterated from regional language."}
                            ],
                            fix_hint="Verify with 10th standard passing certificate and update master record to match.",
                            status="open",
                        ))

                    if dob and citizen.dob and dob != citizen.dob:
                        findings.append(Finding(
                            submission_id=submission_id,
                            institution_id=institution_id,
                            row_number=idx,
                            rule_id="REGISTRY_MISMATCH_DOB",
                            severity="high",
                            plain_reason=f"Date of Birth '{dob}' differs from registry birth date '{citizen.dob}'.",
                            evidence={"submitted_dob": dob, "registry_dob": citizen.dob},
                            benign_hypotheses=[{"title": "Date-Month Swap", "description": "DD/MM vs MM/DD entry transposition."}],
                            fix_hint="Cross-check official municipal birth certificate or secondary school certificate.",
                            status="open",
                        ))

        # ---------------- 3. Cross-Institution Duplicate Check ----------------
        if token:
            cross_dup = check_cross_institution_duplicates(student_dict, institution_id, session)
            if cross_dup:
                findings.append(Finding(
                    submission_id=submission_id,
                    institution_id=institution_id,
                    row_number=idx,
                    rule_id="DUPLICATE_CROSS_INSTITUTION",
                    severity="critical",
                    plain_reason=cross_dup["plain_reason"],
                    evidence=cross_dup["raw_evidence"],
                    benign_hypotheses=cross_dup["benign_hypotheses"],
                    fix_hint=cross_dup["fix_hint"],
                    status="open",
                ))

        # ---------------- 4. Consistency Checks ----------------
        # A) Nationality vs Quota
        if nationality == "Indian" and quota in ("NRI", "FN", "OCI"):
            findings.append(Finding(
                submission_id=submission_id,
                institution_id=institution_id,
                row_number=idx,
                rule_id="CONSISTENCY_NATIONALITY_QUOTA",
                severity="medium",
                plain_reason=f"Student has Indian nationality but is enrolled under {quota} quota without NRI sponsorship documentation.",
                evidence={"nationality": nationality, "admission_quota": quota},
                benign_hypotheses=[{"title": "NRI Sponsored Quota", "description": "Candidate admitted under state NRI-Sponsored quota."}],
                fix_hint="Attach valid NRI sponsor financial undertaking or reclassify quota to Regular/General.",
                status="open",
            ))

        # B) Admission Date inside session
        if admit_date:
            try:
                d = datetime.strptime(admit_date, "%Y-%m-%d")
                if d.year != 2024 or d.month < 6 or d.month > 11:
                    findings.append(Finding(
                        submission_id=submission_id,
                        institution_id=institution_id,
                        row_number=idx,
                        rule_id="CONSISTENCY_ADMISSION_DATE",
                        severity="low",
                        plain_reason=f"Admission date '{admit_date}' falls outside the approved 2024 academic cycle (June - November).",
                        evidence={"admission_date": admit_date, "academic_year": academic_year},
                        benign_hypotheses=[{"title": "Mop-up Round Extension", "description": "State authority approved late spot counseling."}],
                        fix_hint="Verify institutional fee receipt date and format as YYYY-MM-DD.",
                        status="open",
                    ))
            except Exception:
                pass

    # ---------------- 5. Intra-Batch Duplicate Check ----------------
    batch_dups = find_intra_batch_duplicates(prepared_students)
    for bd in batch_dups:
        findings.append(Finding(
            submission_id=submission_id,
            institution_id=institution_id,
            row_number=bd["row_number"],
            rule_id=bd["rule_id"],
            severity=bd["severity"],
            plain_reason=bd["plain_reason"],
            evidence=bd["evidence"],
            benign_hypotheses=bd["benign_hypotheses"],
            fix_hint=bd["fix_hint"],
            status="open",
        ))

    # ---------------- 6. Seat Matrix & Supernumerary Guard ----------------
    seat_gauges: List[Dict[str, Any]] = []
    for prog, prog_students in students_by_prog.items():
        sm = matrix_by_prog.get(prog)
        approved_intake = sm.approved_intake if sm else 120
        compliance = evaluate_seat_compliance(prog, approved_intake, prog_students)
        seat_gauges.append(compliance)

        # Regular overflow finding
        if compliance["regular_overflow"] > 0:
            findings.append(Finding(
                submission_id=submission_id,
                institution_id=institution_id,
                row_number=0,  # Batch-level
                rule_id="SEAT_CAP_REGULAR",
                severity="high",
                plain_reason=f"Sanctioned intake exceeded in {prog}: {compliance['regular_admitted']} regular students admitted against approved capacity of {approved_intake} (+{compliance['regular_overflow']} excess).",
                evidence={
                    "programme": prog,
                    "approved_intake": approved_intake,
                    "regular_admitted": compliance["regular_admitted"],
                    "excess": compliance["regular_overflow"],
                    "utilization_pct": compliance["regular_utilization_pct"],
                },
                benign_hypotheses=[
                    {"title": "State Counseling Spot Round", "description": "State CET cell conducted special mop-up allotment round pending portal intake adjustment."},
                    {"title": "Supernumerary Students Tagged Regular", "description": "Eligible TFW/EWS candidates were entered under the Regular quota code."}
                ],
                fix_hint="Reclassify supernumerary candidates or upload State Counseling spot allotment directive.",
                status="open",
            ))

        # Supernumerary violations
        for sv in compliance["supernumerary_violations"]:
            findings.append(Finding(
                submission_id=submission_id,
                institution_id=institution_id,
                row_number=0,
                rule_id="SEAT_CAP_SUPERNUMERARY",
                severity="high",
                plain_reason=f"Supernumerary quota cap breached in {prog} for category {sv['category']}: {sv['admitted']} admitted against permissible cap of {sv['cap']} (+{sv['excess']} excess).",
                evidence={"programme": prog, "category": sv["category"], "cap": sv["cap"], "admitted": sv["admitted"], "excess": sv["excess"]},
                benign_hypotheses=[{"title": "Quota Code Entry Typo", "description": "General candidates marked with category quota code."}],
                fix_hint="Audit category certificates and correct mislabeled rows.",
                status="open",
            ))

    # ---------------- 7. Statistical & Anomaly Checks ----------------
    # A) DOB Clustering (01-Jan)
    dob_cluster = detect_dob_clustering(prepared_students)
    if dob_cluster:
        findings.append(Finding(
            submission_id=submission_id,
            institution_id=institution_id,
            row_number=0,
            rule_id="ANOMALY_DOB_CLUSTER",
            severity="medium",
            plain_reason=f"Statistically unnatural birth date clustering: {dob_cluster['count']} students ({dob_cluster['concentration_percentage']}%) share birth date {dob_cluster['cluster_date']}.",
            evidence=dob_cluster,
            benign_hypotheses=[
                {"title": "Rural Default Date Convention", "description": "Older rural school records used Jan 01 when exact birth day was unrecorded."},
                {"title": "ERP Default Value", "description": "Campus database migration defaulted null dates to January 1."}
            ],
            fix_hint="Verify physical matriculation certificates and update exact birth dates.",
            status="open",
        ))

    # B) NRI/FN Spike
    nri_spike = detect_nri_fn_spike(prepared_students)
    if nri_spike:
        findings.append(Finding(
            submission_id=submission_id,
            institution_id=institution_id,
            row_number=0,
            rule_id="ANOMALY_NRI_FN_SPIKE",
            severity="medium",
            plain_reason=f"Elevated NRI / Foreign National quota concentration: {nri_spike['nri_fn_count']} of {nri_spike['total_students']} students ({nri_spike['ratio_percentage']}%) exceeds typical 15% threshold.",
            evidence=nri_spike,
            benign_hypotheses=[{"title": "MEA Study in India Program", "description": "Institution participates in central Ministry of External Affairs scholarship scheme."}],
            fix_hint="Provide AICTE approval letter for international student intake.",
            status="open",
        ))

    # C) Age Anomalies
    age_anoms = detect_age_anomalies(prepared_students)
    for aa in age_anoms:
        findings.append(Finding(
            submission_id=submission_id,
            institution_id=institution_id,
            row_number=aa["row_number"],
            rule_id="CONSISTENCY_AGE_RANGE",
            severity="low",
            plain_reason=f"Student age ({aa['calculated_age']} years) is outside standard undergraduate age range.",
            evidence=aa,
            benign_hypotheses=[{"title": "Year Typo", "description": "Typo in birth year on admission form."}],
            fix_hint="Check 10th standard certificate for exact date of birth.",
            status="open",
        ))

    # D) IsolationForest ML Outliers (if available and not low-memory)
    ml_outliers = run_isolation_forest_analysis(prepared_students)
    if ml_outliers:
        for row_idx in ml_outliers[:5]:  # limit to top 5 outliers
            findings.append(Finding(
                submission_id=submission_id,
                institution_id=institution_id,
                row_number=row_idx,
                rule_id="ANOMALY_ML_OUTLIER",
                severity="low",
                plain_reason="Multivariate statistical outlier detected by IsolationForest (unusual combination of age, quota, and admission timing).",
                evidence={"row_number": row_idx, "detector": "IsolationForest", "note": "Unsupervised exploratory anomaly advisory"},
                benign_hypotheses=[{"title": "Atypical Career Path", "description": "Candidate with non-traditional academic trajectory or late lateral entry."}],
                fix_hint="Inspect row to ensure candidate information is accurately recorded.",
                status="open",
            ))

    summary_counts = {
        "critical": len([f for f in findings if f.severity == "critical"]),
        "high": len([f for f in findings if f.severity == "high"]),
        "medium": len([f for f in findings if f.severity == "medium"]),
        "low": len([f for f in findings if f.severity == "low"]),
        "total_findings": len(findings),
        "total_rows": len(raw_rows),
        "seat_gauges": seat_gauges,
    }

    return findings, summary_counts, prepared_students
