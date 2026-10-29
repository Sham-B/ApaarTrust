import json
import logging
import threading
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from sqlmodel import Session, select
from backend.app.config import settings
from backend.app.db import engine
from backend.app.models import (
    Institution,
    ProgrammeSeatMatrix,
    StudentRecord,
    Submission,
    Finding,
    MockCitizen,
    ConsentGrant,
    Credential,
    AuditEntry,
    Alert,
    QuotaEnum,
    NationalityEnum,
)
from backend.app.security import (
    compute_apaar_token,
    encrypt_apaar,
    mask_apaar,
    encrypt_str,
    generate_commitment,
    sign_payload,
)
from backend.app.audit import log_audit_event
from backend.synth.generator import (
    generate_realistic_student,
)


logger = logging.getLogger("apaartrust.seed")

# Thread-safe seeding status tracker for /health endpoint
SEEDING_STATE = {
    "status": "initializing",
    "ready": False,
    "stage": "starting",
    "seeded_count": 0,
    "institutions_count": 0,
    "findings_count": 0,
    "demo_mode": True,
}

_seed_lock = threading.Lock()


def run_seeding_in_background(force: bool = False) -> None:
    thread = threading.Thread(target=seed_database, args=(force,), daemon=True)
    thread.start()


def seed_database(force: bool = False) -> None:
    with _seed_lock:
        if SEEDING_STATE["ready"] and not force:
            logger.info("Database already seeded and ready.")
            return

        SEEDING_STATE["status"] = "seeding"
        SEEDING_STATE["stage"] = "checking_existing_records"

        with Session(engine) as session:
            existing_insts = session.exec(select(Institution)).all()
            if len(existing_insts) >= 5 and not force:
                student_count = len(session.exec(select(StudentRecord)).all())
                SEEDING_STATE["status"] = "ok"
                SEEDING_STATE["ready"] = True
                SEEDING_STATE["stage"] = "ready"
                SEEDING_STATE["institutions_count"] = len(existing_insts)
                SEEDING_STATE["seeded_count"] = student_count
                logger.info(f"Existing dataset confirmed: {len(existing_insts)} institutions, {student_count} students.")
                return

            if force:
                logger.warning("Forcing clean reseeding of all ApaarTrust archetype datasets...")
                # Clear existing tables
                for model in [
                    StudentRecord,
                    Finding,
                    Submission,
                    ProgrammeSeatMatrix,
                    ConsentGrant,
                    Credential,
                    MockCitizen,
                    Alert,
                    AuditEntry,
                    Institution,
                ]:
                    session.exec(select(model))
                    # SQLite delete
                    session.execute(model.__table__.delete())
                session.commit()

            SEEDING_STATE["stage"] = "seeding_archetype_institutions"

            # ----------------- ARCHETYPE DEFINITIONS -----------------
            archetypes = [
                {
                    "pid": "1-1090123456",
                    "name": "Aryabhata Institute of Technology",
                    "state": "Delhi",
                    "district": "New Delhi",
                    "address": "Mahatma Gandhi Marg, Sector 4, New Delhi - 110001",
                    "type": "clean",
                },
                {
                    "pid": "1-1090234567",
                    "name": "Bhaskara College of Engineering & Research",
                    "state": "Maharashtra",
                    "district": "Pune",
                    "address": "Shivaji Nagar Expressway, Pune, Maharashtra - 411005",
                    "type": "over_intake",
                },
                {
                    "pid": "1-1090345678",
                    "name": "Chanakya Technological University",
                    "state": "Karnataka",
                    "district": "Bengaluru",
                    "address": "Outer Ring Road, Whitefield, Bengaluru, Karnataka - 560066",
                    "type": "cross_duplicate",
                },
                {
                    "pid": "1-1090456789",
                    "name": "Dronacharya Institute of Science & Technology",
                    "state": "Telangana",
                    "district": "Hyderabad",
                    "address": "HITEC City Phase 2, Madhapur, Hyderabad, Telangana - 500081",
                    "type": "registry_mismatches",
                },
                {
                    "pid": "1-1090567890",
                    "name": "Eklavya Engineering Academy",
                    "state": "Rajasthan",
                    "district": "Jaipur",
                    "address": "Tonk Road, Sitapura Industrial Area, Jaipur, Rajasthan - 302022",
                    "type": "anomalies",
                },
            ]

            created_institutions: Dict[str, Institution] = {}
            for arch in archetypes:
                inst = Institution(
                    id=arch["pid"],
                    aicte_pid=arch["pid"],
                    name=arch["name"],
                    state=arch["state"],
                    district=arch["district"],
                    address=arch["address"],
                    contact_email=f"registrar@{arch['pid'].lower().replace('-', '')}.edu.in",
                )
                session.add(inst)
                created_institutions[arch["pid"]] = inst
            session.commit()

            # Seed Programme Seat Matrix for each
            for pid in created_institutions.keys():
                # 3 Core Programmes per institution
                # CSE: 120 intake
                # ECE: 60 intake
                # ME: 60 intake
                sm_cse = ProgrammeSeatMatrix(
                    institution_id=pid,
                    programme="B.Tech Computer Science and Engineering",
                    academic_year="2024-25",
                    approved_intake=120,
                    supernumerary_caps={"TFW": 6, "EWS": 12, "KM": 3, "PMSSS": 2, "NRI": 6, "FN_OCI": 18},
                )
                sm_ece = ProgrammeSeatMatrix(
                    institution_id=pid,
                    programme="B.Tech Electronics and Communication Engineering",
                    academic_year="2024-25",
                    approved_intake=60,
                    supernumerary_caps={"TFW": 3, "EWS": 6, "KM": 3, "PMSSS": 2, "NRI": 3, "FN_OCI": 9},
                )
                sm_me = ProgrammeSeatMatrix(
                    institution_id=pid,
                    programme="B.Tech Mechanical Engineering",
                    academic_year="2024-25",
                    approved_intake=60,
                    supernumerary_caps={"TFW": 3, "EWS": 6, "KM": 3, "PMSSS": 2, "NRI": 3, "FN_OCI": 9},
                )
                session.add(sm_cse)
                session.add(sm_ece)
                session.add(sm_me)
            session.commit()

            SEEDING_STATE["stage"] = "generating_students_and_mock_citizens"

            total_students_seeded = 0
            all_created_students: List[StudentRecord] = []

            # Specific cross-duplicate student to link Arch 1 and Arch 3
            shared_apaar = "554433221100"
            shared_name = "Rohan Aditya Sharma"
            shared_dob = "2004-03-15"
            shared_token = compute_apaar_token(shared_apaar)

            # Citizen for shared student
            shared_cit = MockCitizen(
                apaar_id=shared_apaar,
                name=shared_name,
                dob=shared_dob,
                gender="Male",
                status="active",
                consent_flag=True,
                phone_masked="XXXXXX1100",
            )
            session.add(shared_cit)

            # Seed clean template citizens in mock registry
            template_sample_citizens = [
                ("234567890123", "Aarav Sharma", "2004-05-14", "Male"),
                ("345678901234", "Priya Patel", "2004-09-22", "Female"),
                ("456789012345", "Rohan Verma", "2003-12-05", "Male"),
                ("567890123456", "Ananya Iyer", "2004-03-30", "Female"),
                ("678901234567", "Tariq Ahmad", "2004-07-19", "Male"),
            ]
            for ap_id, nm, db, gd in template_sample_citizens:
                if not session.get(MockCitizen, ap_id):
                    session.add(MockCitizen(
                        apaar_id=ap_id,
                        name=nm,
                        dob=db,
                        gender=gd,
                        status="active",
                        consent_flag=True,
                        phone_masked="XXXXXX1234"
                    ))
            session.commit()

            # ----------------- SEED STUDENTS PER ARCHETYPE -----------------
            for arch in archetypes:
                pid = arch["pid"]
                arch_type = arch["type"]

                sub_id = f"sub_{pid.replace('-', '')}_2024_v1"
                submission = Submission(
                    id=sub_id,
                    institution_id=pid,
                    academic_year="2024-25",
                    version=1,
                    status="committed",
                    filename=f"{pid}_student_intake_2024.xlsx",
                    total_rows=0,
                    valid_rows=0,
                    flagged_rows=0,
                    submission_hash=f"hash_{pid}_v1",
                    counts={"critical": 0, "high": 0, "medium": 0, "low": 0},
                )
                session.add(submission)
                session.commit()

                arch_students: List[StudentRecord] = []
                arch_findings: List[Finding] = []

                # (1) CLEAN ARCHETYPE (PID: 1-1090123456)
                if arch_type == "clean":
                    # Admitted counts: CSE: 115 regular, 4 TFW, 8 EWS (within 120 regular cap)
                    # ECE: 55 regular, 2 TFW
                    # ME: 52 regular
                    # Total ~236 clean students
                    student_specs = [
                        ("B.Tech Computer Science and Engineering", 115, QuotaEnum.REGULAR),
                        ("B.Tech Computer Science and Engineering", 4, "TFW"),
                        ("B.Tech Computer Science and Engineering", 8, "EWS"),
                        ("B.Tech Electronics and Communication Engineering", 55, QuotaEnum.REGULAR),
                        ("B.Tech Electronics and Communication Engineering", 2, "TFW"),
                        ("B.Tech Mechanical Engineering", 52, QuotaEnum.REGULAR),
                    ]
                    # Also include shared student in Arch 1
                    sr = StudentRecord(
                        apaar_token=shared_token,
                        apaar_id_encrypted=encrypt_apaar(shared_apaar),
                        apaar_masked=mask_apaar(shared_apaar),
                        name=shared_name,
                        dob=shared_dob,
                        gender="Male",
                        social_category="General",
                        nationality_status=NationalityEnum.INDIAN,
                        admission_quota=QuotaEnum.REGULAR,
                        programme="B.Tech Computer Science and Engineering",
                        admission_date="2024-08-05",
                        enrolment_status="Active",
                        student_id="AIT-CSE-24-001",
                        institution_id=pid,
                        submission_id=sub_id,
                        academic_year="2024-25",
                    )
                    session.add(sr)
                    arch_students.append(sr)

                    roll_idx = 2
                    for prog, count, quota in student_specs:
                        for _ in range(count):
                            s = generate_realistic_student(programme=prog, quota=quota)
                            cit = MockCitizen(
                                apaar_id=s["apaar_id"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                status="active",
                                consent_flag=True,
                                phone_masked="XXXXXX" + s["apaar_id"][-4:],
                            )
                            session.add(cit)
                            sr = StudentRecord(
                                apaar_token=s["apaar_token"],
                                apaar_id_encrypted=s["apaar_id_encrypted"],
                                apaar_masked=s["apaar_masked"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                social_category=s["social_category"],
                                nationality_status=s["nationality_status"],
                                admission_quota=quota,
                                programme=prog,
                                admission_date=s["admission_date"],
                                enrolment_status="Active",
                                student_id=f"AIT-{prog[:3].upper()}-24-{roll_idx:03d}",
                                institution_id=pid,
                                submission_id=sub_id,
                                academic_year="2024-25",
                            )
                            session.add(sr)
                            arch_students.append(sr)
                            roll_idx += 1

                # (2) OVER-INTAKE ARCHETYPE (PID: 1-1090234567)
                elif arch_type == "over_intake":
                    # Approved regular CSE is 120 -> We admit 148 Regular! (+28 over-intake)
                    # TFW approved is 6 -> We admit 14 TFW! (+8 over-intake)
                    # NRI approved is 6 -> We admit 12 NRI! (+6 over-intake)
                    # Plus ECE 62, ME 58. Total ~294 students.
                    student_specs = [
                        ("B.Tech Computer Science and Engineering", 148, QuotaEnum.REGULAR),
                        ("B.Tech Computer Science and Engineering", 14, "TFW"),
                        ("B.Tech Computer Science and Engineering", 12, QuotaEnum.NRI),
                        ("B.Tech Electronics and Communication Engineering", 62, QuotaEnum.REGULAR),
                        ("B.Tech Mechanical Engineering", 58, QuotaEnum.REGULAR),
                    ]
                    roll_idx = 1
                    for prog, count, quota in student_specs:
                        for _ in range(count):
                            s = generate_realistic_student(programme=prog, quota=quota)
                            cit = MockCitizen(
                                apaar_id=s["apaar_id"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                status="active",
                                consent_flag=True,
                                phone_masked="XXXXXX" + s["apaar_id"][-4:],
                            )
                            session.add(cit)
                            sr = StudentRecord(
                                apaar_token=s["apaar_token"],
                                apaar_id_encrypted=s["apaar_id_encrypted"],
                                apaar_masked=s["apaar_masked"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                social_category=s["social_category"],
                                nationality_status=s["nationality_status"],
                                admission_quota=quota,
                                programme=prog,
                                admission_date=s["admission_date"],
                                enrolment_status="Active",
                                student_id=f"BCE-{prog[:3].upper()}-24-{roll_idx:03d}",
                                institution_id=pid,
                                submission_id=sub_id,
                                academic_year="2024-25",
                            )
                            session.add(sr)
                            arch_students.append(sr)
                            roll_idx += 1

                    # Add Over-intake Findings
                    f1 = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=121,
                        rule_id="SEAT_CAP_REGULAR",
                        severity="high",
                        plain_reason="Regular admissions in B.Tech CSE (148 students) exceed sanctioned intake (120 seats) by 28 seats.",
                        evidence={"programme": "B.Tech Computer Science and Engineering", "approved_intake": 120, "actual_regular_admitted": 148, "excess": 28},
                        benign_hypotheses=[
                            {"title": "State Mop-Up Spot Allotment", "description": "State Technical Education Directorate sanctioned additional spot round allotments pending portal update."},
                            {"title": "Misclassified Quota Category", "description": "Certain admitted students belong to EWS or state sponsored quotas but were flagged as Regular."}
                        ],
                        fix_hint="Review admission orders. Reclassify eligible supernumerary students or request intake regularization.",
                        status="open",
                    )
                    f2 = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=135,
                        rule_id="SEAT_CAP_SUPERNUMERARY",
                        severity="high",
                        plain_reason="TFW quota admissions (14 students) exceed maximum 5% supernumerary ceiling (6 seats) by 8 seats.",
                        evidence={"programme": "B.Tech Computer Science and Engineering", "category": "TFW", "max_allowed": 6, "actual_admitted": 14, "excess": 8},
                        benign_hypotheses=[
                            {"title": "Category Code Entry Slip", "description": "Economically Weaker Section (EWS) or general scholarship students mistakenly marked with TFW quota code."}
                        ],
                        fix_hint="Verify state counseling allotment letters and correct candidate category to EWS or General.",
                        status="open",
                    )
                    arch_findings.extend([f1, f2])

                # (3) CROSS-DUPLICATE ARCHETYPE (PID: 1-1090345678)
                elif arch_type == "cross_duplicate":
                    # Admitted counts: CSE 110, ECE 50, ME 50. Total ~211 students.
                    # CRITICAL: shared student Rohan Aditya Sharma is ALSO enrolled here!
                    sr_shared = StudentRecord(
                        apaar_token=shared_token,
                        apaar_id_encrypted=encrypt_apaar(shared_apaar),
                        apaar_masked=mask_apaar(shared_apaar),
                        name=shared_name,
                        dob=shared_dob,
                        gender="Male",
                        social_category="General",
                        nationality_status=NationalityEnum.INDIAN,
                        admission_quota=QuotaEnum.REGULAR,
                        programme="B.Tech Computer Science and Engineering",
                        admission_date="2024-08-12",
                        enrolment_status="Active",
                        student_id="CTU-CSE-24-088",
                        institution_id=pid,
                        submission_id=sub_id,
                        academic_year="2024-25",
                    )
                    session.add(sr_shared)
                    arch_students.append(sr_shared)

                    student_specs = [
                        ("B.Tech Computer Science and Engineering", 109, QuotaEnum.REGULAR),
                        ("B.Tech Electronics and Communication Engineering", 50, QuotaEnum.REGULAR),
                        ("B.Tech Mechanical Engineering", 50, QuotaEnum.REGULAR),
                    ]
                    roll_idx = 1
                    for prog, count, quota in student_specs:
                        for _ in range(count):
                            s = generate_realistic_student(programme=prog, quota=quota)
                            cit = MockCitizen(
                                apaar_id=s["apaar_id"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                status="active",
                                consent_flag=True,
                                phone_masked="XXXXXX" + s["apaar_id"][-4:],
                            )
                            session.add(cit)
                            sr = StudentRecord(
                                apaar_token=s["apaar_token"],
                                apaar_id_encrypted=s["apaar_id_encrypted"],
                                apaar_masked=s["apaar_masked"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                social_category=s["social_category"],
                                nationality_status=s["nationality_status"],
                                admission_quota=quota,
                                programme=prog,
                                admission_date=s["admission_date"],
                                enrolment_status="Active",
                                student_id=f"CTU-{prog[:3].upper()}-24-{roll_idx:03d}",
                                institution_id=pid,
                                submission_id=sub_id,
                                academic_year="2024-25",
                            )
                            session.add(sr)
                            arch_students.append(sr)
                            roll_idx += 1

                    # Finding for cross-institution duplicate
                    # Notice: PRIVACY PRESERVATION!
                    # The finding stores internal details, but when viewed by Institution role, the other institution/student is REDACTED.
                    f_dup = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=88,
                        rule_id="DUPLICATE_CROSS_INSTITUTION",
                        severity="critical",
                        plain_reason="Student concurrently enrolled at another AICTE-approved institution with overlapping active tenure.",
                        evidence={
                            "apaar_token": shared_token,
                            "apaar_masked": mask_apaar(shared_apaar),
                            "match_score": 10.0,
                            "conflicting_institution_id": "1-1090123456",
                            "conflicting_institution_name": "Aryabhata Institute of Technology",
                            "conflicting_programme": "B.Tech Computer Science and Engineering",
                            "overlap_academic_year": "2024-25",
                            "evidence_breakdown": "Deterministic match: same HMAC-SHA256 APAAR token (+10.0), matching DOB (+4.1)."
                        },
                        benign_hypotheses=[
                            {"title": "Pending Transfer Certificate", "description": "Candidate migrated from earlier institution without former college issuing formal online exit slip."},
                            {"title": "Seat Holding During State Counseling", "description": "Candidate secured round 1 seat and upgraded in round 2 without cancellation acknowledgment."}
                        ],
                        fix_hint="Collect stamped Transfer / Migration Certificate from candidate's previous college.",
                        status="open",
                    )
                    arch_findings.append(f_dup)

                # (4) REGISTRY MISMATCHES ARCHETYPE (PID: 1-1090456789)
                elif arch_type == "registry_mismatches":
                    # Admitted ~220 students.
                    # Include:
                    # - 6 not_found APAARs
                    # - 4 suspended APAARs
                    # - 8 Name mismatches
                    # - 6 DOB mismatches
                    # - 4 Consent missing
                    # - 4 Malformed APAARs (e.g. 9 digits)
                    student_specs = [
                        ("B.Tech Computer Science and Engineering", 100, QuotaEnum.REGULAR),
                        ("B.Tech Electronics and Communication Engineering", 50, QuotaEnum.REGULAR),
                        ("B.Tech Mechanical Engineering", 50, QuotaEnum.REGULAR),
                    ]
                    roll_idx = 1
                    for prog, count, quota in student_specs:
                        for idx in range(count):
                            s = generate_realistic_student(programme=prog, quota=quota)
                            cit_status = "active"
                            consent = True
                            cit_name = s["name"]
                            cit_dob = s["dob"]

                            # Plant anomalies
                            if prog.startswith("B.Tech Computer") and idx < 4:
                                # Malformed 9 digits
                                s["apaar_id"] = s["apaar_id"][:9]
                                s["apaar_token"] = compute_apaar_token(s["apaar_id"])
                                s["apaar_id_encrypted"] = encrypt_apaar(s["apaar_id"])
                                s["apaar_masked"] = mask_apaar(s["apaar_id"])
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="APAAR_FORMAT",
                                    severity="critical",
                                    plain_reason="APAAR ID must contain exactly 12 numeric digits.",
                                    evidence={"submitted_apaar_masked": s["apaar_masked"], "length": len(s["apaar_id"])},
                                    benign_hypotheses=[{"title": "Leading Zero Dropped", "description": "Spreadsheet cell formatting stripped leading zeroes."}],
                                    fix_hint="Format column as Text and re-enter 12-digit number.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            elif prog.startswith("B.Tech Computer") and 4 <= idx < 10:
                                # Not found in registry (do not create citizen)
                                cit_status = "not_found"
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="REGISTRY_LOOKUP",
                                    severity="critical",
                                    plain_reason="APAAR ID not registered in Central APAAR Registry.",
                                    evidence={"apaar_masked": s["apaar_masked"]},
                                    benign_hypotheses=[{"title": "Sync Delay", "description": "Freshly generated APAAR ID pending central index replication."}],
                                    fix_hint="Obtain DigiLocker PDF verification slip from student.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            elif prog.startswith("B.Tech Computer") and 10 <= idx < 14:
                                # Suspended in registry
                                cit_status = "suspended"
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="REGISTRY_LOOKUP",
                                    severity="high",
                                    plain_reason="APAAR ID has been suspended by issuing authority.",
                                    evidence={"apaar_masked": s["apaar_masked"], "registry_status": "suspended"},
                                    benign_hypotheses=[{"title": "Aadhaar e-KYC Resubmission", "description": "Student biometric update flagged pending re-verification."}],
                                    fix_hint="Advise candidate to visit local Aadhaar/DigiLocker Seva Kendra to reactivate profile.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            elif prog.startswith("B.Tech Computer") and 14 <= idx < 22:
                                # Name mismatch
                                cit_name = "Shriman " + s["name"] + " Verma"
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="REGISTRY_MISMATCH_NAME",
                                    severity="high",
                                    plain_reason="Student name differs from registered APAAR legal name.",
                                    evidence={"submitted_name": s["name"], "registry_name": cit_name, "similarity": 0.68},
                                    benign_hypotheses=[
                                        {"title": "Honorific Prefix Inclusion", "description": "Registry profile contains traditional prefixes or expanded patronymics."},
                                        {"title": "School Certificate Abbreviation", "description": "High school marksheet condensed surname or initials."}
                                    ],
                                    fix_hint="Match name to 10th standard matriculation certificate.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            elif prog.startswith("B.Tech Computer") and 22 <= idx < 28:
                                # DOB mismatch
                                cit_dob = "2002-11-20"
                                s["dob"] = "2004-06-15"
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="REGISTRY_MISMATCH_DOB",
                                    severity="high",
                                    plain_reason="Submitted Date of Birth differs from APAAR Registry records.",
                                    evidence={"submitted_dob": s["dob"], "registry_dob": cit_dob},
                                    benign_hypotheses=[{"title": "Month-Day Inversion", "description": "Clerical entry inverted day and month order."}],
                                    fix_hint="Verify with birth certificate or Aadhaar card.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            elif prog.startswith("B.Tech Computer") and 28 <= idx < 32:
                                # Consent missing
                                consent = False
                                f = Finding(
                                    submission_id=sub_id,
                                    institution_id=pid,
                                    row_number=idx + 1,
                                    rule_id="REGISTRY_CONSENT_MISSING",
                                    severity="medium",
                                    plain_reason="Citizen consent flag inactive for institutional data access.",
                                    evidence={"apaar_masked": s["apaar_masked"], "consent_flag": False},
                                    benign_hypotheses=[{"title": "Pending Student OTP", "description": "Student has not yet completed DigiLocker consent authorization."}],
                                    fix_hint="Instruct student to grant e-consent via APAAR student portal.",
                                    status="open",
                                )
                                arch_findings.append(f)

                            if cit_status != "not_found":
                                cit = MockCitizen(
                                    apaar_id=s["apaar_id"],
                                    name=cit_name,
                                    dob=cit_dob,
                                    gender=s["gender"],
                                    status=cit_status,
                                    consent_flag=consent,
                                    phone_masked="XXXXXX" + s["apaar_id"][-4:] if len(s["apaar_id"]) >= 4 else "XXXXXX0000",
                                )
                                session.add(cit)

                            sr = StudentRecord(
                                apaar_token=s["apaar_token"],
                                apaar_id_encrypted=s["apaar_id_encrypted"],
                                apaar_masked=s["apaar_masked"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                social_category=s["social_category"],
                                nationality_status=s["nationality_status"],
                                admission_quota=quota,
                                programme=prog,
                                admission_date=s["admission_date"],
                                enrolment_status="Active",
                                student_id=f"DIS-{prog[:3].upper()}-24-{roll_idx:03d}",
                                institution_id=pid,
                                submission_id=sub_id,
                                academic_year="2024-25",
                            )
                            session.add(sr)
                            arch_students.append(sr)
                            roll_idx += 1

                # (5) ANOMALIES ARCHETYPE (PID: 1-1090567890)
                elif arch_type == "anomalies":
                    # Admitted ~220 students.
                    # Features:
                    # - 60+ students born on 01-Jan (e.g. 2004-01-01) -> DOB clustering!
                    # - 50 NRI/FN admissions (>22% ratio) -> NRI/FN anomaly!
                    # - 2 impossible age students (born 1948 and born 2019)!
                    student_specs = [
                        ("B.Tech Computer Science and Engineering", 80, QuotaEnum.REGULAR),
                        ("B.Tech Computer Science and Engineering", 35, QuotaEnum.NRI),
                        ("B.Tech Computer Science and Engineering", 20, QuotaEnum.FN),
                        ("B.Tech Electronics and Communication Engineering", 45, QuotaEnum.REGULAR),
                        ("B.Tech Mechanical Engineering", 40, QuotaEnum.REGULAR),
                    ]
                    roll_idx = 1
                    for prog, count, quota in student_specs:
                        for idx in range(count):
                            dob_ovr = None
                            if idx < 15:
                                # DOB Cluster on Jan 01
                                dob_ovr = "2004-01-01"

                            s = generate_realistic_student(programme=prog, quota=quota, dob_override=dob_ovr)

                            # Plant impossible age on roll 1 and 2
                            if roll_idx == 1:
                                s["dob"] = "1948-03-10"  # Age 76
                            elif roll_idx == 2:
                                s["dob"] = "2019-07-22"  # Age 5

                            cit = MockCitizen(
                                apaar_id=s["apaar_id"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                status="active",
                                consent_flag=True,
                                phone_masked="XXXXXX" + s["apaar_id"][-4:],
                            )
                            session.add(cit)

                            sr = StudentRecord(
                                apaar_token=s["apaar_token"],
                                apaar_id_encrypted=s["apaar_id_encrypted"],
                                apaar_masked=s["apaar_masked"],
                                name=s["name"],
                                dob=s["dob"],
                                gender=s["gender"],
                                social_category=s["social_category"],
                                nationality_status=s["nationality_status"],
                                admission_quota=quota,
                                programme=prog,
                                admission_date=s["admission_date"],
                                enrolment_status="Active",
                                student_id=f"EEA-{prog[:3].upper()}-24-{roll_idx:03d}",
                                institution_id=pid,
                                submission_id=sub_id,
                                academic_year="2024-25",
                            )
                            session.add(sr)
                            arch_students.append(sr)
                            roll_idx += 1

                    # Anomalies Findings
                    f_dob = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=1,
                        rule_id="ANOMALY_DOB_CLUSTER",
                        severity="medium",
                        plain_reason="Statistically abnormal cluster: 55+ students in this cohort have date of birth 01-Jan.",
                        evidence={"date_cluster": "01-01", "student_count": 58, "concentration_percentage": 26.4},
                        benign_hypotheses=[
                            {"title": "Rural Birth Registration Convention", "description": "Historically, candidates from rural school certificates had Jan 01 entered when exact date was unknown."},
                            {"title": "ERP Default Field Artifact", "description": "Institutional database migration defaulted null birth dates to January 1st."}
                        ],
                        fix_hint="Cross-reference original matriculation certificate and update exact birth dates.",
                        status="open",
                    )
                    f_nri = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=2,
                        rule_id="ANOMALY_NRI_FN_SPIKE",
                        severity="medium",
                        plain_reason="High NRI/Foreign National quota concentration: 55 out of 220 students (25.0%) exceeds 15% norm.",
                        evidence={"nri_fn_count": 55, "total_admitted": 220, "percentage": 25.0, "threshold_pct": 15.0},
                        benign_hypotheses=[
                            {"title": "MEA / ICCR Scholarship Scheme", "description": "Institution participates in Ministry of External Affairs Study in India program."}
                        ],
                        fix_hint="Attach AICTE international student approval endorsement memo.",
                        status="open",
                    )
                    f_age = Finding(
                        submission_id=sub_id,
                        institution_id=pid,
                        row_number=1,
                        rule_id="CONSISTENCY_AGE_RANGE",
                        severity="low",
                        plain_reason="Student age at undergraduate admission (age 76 or age 5) is outside customary age norms.",
                        evidence={"student_roll": "EEA-B.T-24-001", "dob": "1948-03-10", "calculated_age": 76},
                        benign_hypotheses=[{"title": "Birth Year Typo", "description": "Year 1948 entered instead of 2004."}],
                        fix_hint="Check 10th marksheet for correct year of birth.",
                        status="open",
                    )
                    arch_findings.extend([f_dob, f_nri, f_age])

                # Commit students and findings for this archetype
                session.commit()
                for f in arch_findings:
                    session.add(f)
                session.commit()

                # Update submission counts
                submission.total_rows = len(arch_students)
                submission.flagged_rows = len(arch_findings)
                submission.valid_rows = submission.total_rows - submission.flagged_rows
                submission.counts = {
                    "critical": len([f for f in arch_findings if f.severity == "critical"]),
                    "high": len([f for f in arch_findings if f.severity == "high"]),
                    "medium": len([f for f in arch_findings if f.severity == "medium"]),
                    "low": len([f for f in arch_findings if f.severity == "low"]),
                }
                session.add(submission)
                session.commit()

                all_created_students.extend(arch_students)
                total_students_seeded += len(arch_students)

            # ----------------- SEED SAMPLE VERIFIABLE CREDENTIAL & CONSENT -----------------
            # Select student from Clean Institution for initial demo
            demo_student = all_created_students[0]

            # Create default consent grant
            now = datetime.now(timezone.utc)
            cg = ConsentGrant(
                id="cg-demo-2026-001",
                student_token=demo_student.apaar_token,
                purpose="Employment Background Verification",
                allowed_fields=["name", "programme", "institution", "enrolment_status"],
                created_at=now,
                expires_at=now + timedelta(days=90),
                revoked_at=None,
            )
            session.add(cg)

            # Generate SD-JWT-inspired salted commitments for the student
            raw_claims = {
                "name": demo_student.name,
                "dob": demo_student.dob,
                "gender": demo_student.gender,
                "programme": demo_student.programme,
                "institution": "Aryabhata Institute of Technology",
                "enrolment_status": demo_student.enrolment_status,
                "academic_year": demo_student.academic_year,
                "student_id": demo_student.student_id,
            }

            commitments: Dict[str, str] = {}
            salts: Dict[str, str] = {}
            for k, v in raw_claims.items():
                c_hash, salt = generate_commitment(k, v)
                commitments[k] = c_hash
                salts[k] = salt

            # Sign root commitments dictionary
            cred_id = "cred-demo-aicte-2026"
            cred_signature = sign_payload("apaar_credential_authority", commitments)

            cred = Credential(
                id=cred_id,
                subject_token=demo_student.apaar_token,
                commitments=commitments,
                salts_encrypted=encrypt_str(json.dumps(salts)),
                claims_encrypted=encrypt_str(json.dumps(raw_claims)),
                signature=cred_signature,
                issuer="AICTE-ApaarTrust-Authority",
                issued_at=now,
                expires_at=now + timedelta(days=365),
                revoked=False,
            )
            session.add(cred)

            # Seed Alerts for Officer Dashboard
            a1 = Alert(
                institution_id="1-1090234567",
                alert_type="over_intake",
                severity="critical",
                title="Sanctioned Intake Exceeded at Bhaskara College",
                message="B.Tech Computer Science intake exceeded by 28 regular seats and 8 TFW supernumerary seats.",
                rule_id="SEAT_CAP_REGULAR",
            )
            a2 = Alert(
                institution_id="1-1090345678",
                alert_type="cross_institution_duplicate",
                severity="critical",
                title="Cross-Institution Duplicate Enrolment Detected",
                message="Student token matched active registration at Aryabhata Institute of Technology.",
                rule_id="DUPLICATE_CROSS_INSTITUTION",
            )
            a3 = Alert(
                institution_id="1-1090456789",
                alert_type="registry_mismatch",
                severity="warning",
                title="Elevated APAAR Registry Mismatch Rate",
                message="Dronacharya Institute submission flagged 32 identity/registry mismatches.",
                rule_id="REGISTRY_LOOKUP",
            )
            session.add(a1)
            session.add(a2)
            session.add(a3)

            # Log audit event for seeding
            log_audit_event(
                session=session,
                actor_role="System",
                action="INITIAL_SEED_COMPLETE",
                application_id="AICTE_CENTRAL",
                payload={
                    "institutions_seeded": len(archetypes),
                    "students_seeded": total_students_seeded,
                    "archetypes": [a["type"] for a in archetypes],
                },
            )

            session.commit()

            SEEDING_STATE["status"] = "ok"
            SEEDING_STATE["ready"] = True
            SEEDING_STATE["stage"] = "ready"
            SEEDING_STATE["institutions_count"] = len(archetypes)
            SEEDING_STATE["seeded_count"] = total_students_seeded
            logger.info(f"Seeding completed successfully: {total_students_seeded} students seeded across 5 institutions.")


def get_seeding_health() -> Dict[str, Any]:
    return {
        "status": SEEDING_STATE["status"],
        "ready": SEEDING_STATE["ready"],
        "stage": SEEDING_STATE["stage"],
        "seeded_count": SEEDING_STATE["seeded_count"],
        "institutions_count": SEEDING_STATE["institutions_count"],
        "demo_mode": SEEDING_STATE["demo_mode"],
        "app_name": settings.APP_NAME,
    }
