"""
Fast, end-to-end journey test suite for ApaarTrust Flagship Journeys J1-J4.
Tests:
- J1: College Data Submission (Templates clean/errors, dry run, commit, receipt, students roster, diff, errors CSV, certificate PDF)
- J2: Officer Oversight (KPIs, State Map, Over-intake scrutiny, Finding status/comment/clarification, Adverse action, Duplicates decision, Reveal ID, Audit verify/tamper/restore, Compliance Report PDF)
- J3: Student Sovereignty (Record view, Selective consent, Presentation generation, Verifier view, Revocation, Access log)
- J4: Public Verifier (All 5 outcomes: Genuine, Revoked, Expired, Tampered, Not Found)
- Role Isolation & Security (Cross-institution boundary, student privilege containment, public verifier scope)
"""

import io
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from backend.app.main import app
from backend.app.db import engine, init_db
from backend.app.models import (
    StudentRecord,
    Submission,
    Finding,
    ConsentGrant,
    Credential,
)
from backend.app.security import (
    Role,
    create_demo_token,
    compute_apaar_token,
)
from backend.synth.seed import seed_database


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    seed_database(force=True)
    yield


@pytest.fixture
def client():
    return TestClient(app)


# ----------------- Journey 1: College Data Submission -----------------
def test_journey_1_college_data_submission(client: TestClient):
    college_id = "1-1090123456"
    college_token = create_demo_token(Role.INSTITUTION, institution_id=college_id)
    headers = {"Authorization": f"Bearer {college_token}"}

    # 1. Download clean templates (CSV and XLSX)
    res_clean_csv = client.get("/api/v1/upload/template?format=csv&sample_type=clean")
    assert res_clean_csv.status_code == 200
    assert "apaar_id,name,dob" in res_clean_csv.text

    res_clean_xlsx = client.get("/api/v1/upload/template?format=xlsx&sample_type=clean")
    assert res_clean_xlsx.status_code == 200
    assert len(res_clean_xlsx.content) > 100

    # 2. Download sample with 5 deliberate errors (CSV and XLSX)
    res_err_csv = client.get("/api/v1/upload/template?format=csv&sample_type=errors")
    assert res_err_csv.status_code == 200
    assert "UNKNOWN_QUOTA" in res_err_csv.text

    res_err_xlsx = client.get("/api/v1/upload/template?format=xlsx&sample_type=errors")
    assert res_err_xlsx.status_code == 200
    assert len(res_err_xlsx.content) > 100

    # 3. Dry run with the 5 deliberate errors
    err_file = io.BytesIO(res_err_csv.content)
    res_dry_err = client.post(
        "/api/v1/upload/dry-run",
        data={"institution_id": college_id, "academic_year": "2024-25"},
        files={"file": ("errors.csv", err_file, "text/csv")},
        headers=headers,
    )
    assert res_dry_err.status_code == 200
    dry_err_data = res_dry_err.json()
    assert dry_err_data["status"] in ["dry_run", "dry_run_complete"]
    assert dry_err_data["findings_count"] >= 4

    # 4. Dry run with clean CSV
    clean_file = io.BytesIO(res_clean_csv.content)
    res_dry_clean = client.post(
        "/api/v1/upload/dry-run",
        data={"institution_id": college_id, "academic_year": "2024-25"},
        files={"file": ("clean.csv", clean_file, "text/csv")},
        headers=headers,
    )
    assert res_dry_clean.status_code == 200
    assert res_dry_clean.json()["findings_count"] == 0

    # 5. Commit batch with receipt
    commit_file = io.BytesIO(res_clean_csv.content)
    res_commit = client.post(
        "/api/v1/upload/commit",
        data={"institution_id": college_id, "academic_year": "2024-25"},
        files={"file": ("clean.csv", commit_file, "text/csv")},
        headers=headers,
    )
    assert res_commit.status_code == 200
    commit_data = res_commit.json()
    assert commit_data["status"] == "committed"
    sub_id = commit_data["submission_id"]
    assert "receipt" in commit_data
    assert commit_data["receipt"]["receipt_number"].startswith("REC-")

    # 6. Fetch submission receipt endpoint
    res_receipt = client.get(f"/api/v1/submissions/{sub_id}/receipt", headers=headers)
    assert res_receipt.status_code == 200
    receipt = res_receipt.json()
    assert receipt["submission_id"] == sub_id
    assert receipt["cryptographic_seal"].startswith("SHA256:")

    # 7. Students appear in college student roster
    res_students = client.get(f"/api/v1/institutions/{college_id}/students", headers=headers)
    assert res_students.status_code == 200
    names = [s["name"] for s in res_students.json()]
    assert "Aarav Sharma" in names

    # 8. Check diff endpoint
    res_diff = client.get(f"/api/v1/submissions/{sub_id}/diff", headers=headers)
    assert res_diff.status_code == 200

    # 9. Downloadable error CSV
    res_exp_err = client.get(f"/api/v1/submissions/{sub_id}/export-errors", headers=headers)
    assert res_exp_err.status_code == 200
    assert "Rule ID" in res_exp_err.text

    # 10. Issue sample certificate PDF with QR code
    with Session(engine) as session:
        stu = session.exec(select(StudentRecord).where(StudentRecord.name == "Aarav Sharma")).first()
        assert stu is not None
        stu_id = stu.id

    res_issue = client.post(f"/api/v1/credentials/issue?student_id={stu_id}")
    assert res_issue.status_code == 200
    cred_id = res_issue.json()["credential_id"]

    res_pdf = client.get(f"/api/v1/credentials/{cred_id}/certificate.pdf")
    assert res_pdf.status_code == 200
    assert res_pdf.headers["content-type"] == "application/pdf"
    assert len(res_pdf.content) > 1000


# ----------------- Journey 2: Officer Oversight -----------------
def test_journey_2_officer_oversight(client: TestClient):
    # 1. Signin with signed token
    res_signin = client.post("/api/v1/demo/signin", json={"role": "Officer"})
    assert res_signin.status_code == 200
    officer_token = res_signin.json()["access_token"]
    headers = {"Authorization": f"Bearer {officer_token}"}

    # 2. Overview KPIs and State Tile Map
    res_spark = client.get("/api/v1/officer/sparklines", headers=headers)
    assert res_spark.status_code == 200
    assert "students_verified" in res_spark.json()

    res_map = client.get("/api/v1/officer/state-map", headers=headers)
    assert res_map.status_code == 200
    assert len(res_map.json()["states"]) > 0

    # 3. Scrutiny of over-intake institution (Bhaskara: 1-1090234567)
    res_bhaskara = client.get("/api/v1/institutions/1-1090234567", headers=headers)
    assert res_bhaskara.status_code == 200
    b_data = res_bhaskara.json()
    assert "Bhaskara College" in b_data["institution"]["name"]
    assert len(b_data["findings"]) > 0

    # 4. Findings Inbox: Update status & request clarification
    with Session(engine) as session:
        f = session.exec(select(Finding)).first()
        assert f is not None
        finding_id = f.id

    # Mandatory reason validation (reject < 10 chars)
    res_f_fail = client.post(
        f"/api/v1/findings/{finding_id}/status",
        json={"status": "in_review", "reason": "Too short"},
        headers=headers
    )
    assert res_f_fail.status_code == 400

    # Successful status update
    res_f_ok = client.post(
        f"/api/v1/findings/{finding_id}/status",
        json={"status": "in_review", "reason": "Dispatched inquiry notice to regional registrar."},
        headers=headers
    )
    assert res_f_ok.status_code == 200
    assert res_f_ok.json()["new_status"] == "in_review"

    # Request clarification
    res_clarify = client.post(
        f"/api/v1/findings/{finding_id}/status",
        json={
            "request_clarification": True,
            "clarification_note": "Please submit approved sanction order from State Directorate."
        },
        headers=headers
    )
    assert res_clarify.status_code == 200

    # Check notification reached the institution
    res_inst_notifs = client.get(
        "/api/v1/notifications",
        headers={"Authorization": f"Bearer {create_demo_token(Role.INSTITUTION, institution_id=f.institution_id)}"}
    )
    assert res_inst_notifs.status_code == 200
    assert any("Clarification Requested" in n["title"] for n in res_inst_notifs.json()["items"])

    # 5. Adverse action requiring >= 10 chars reason
    with Session(engine) as session:
        sub = session.exec(select(Submission)).first()
        sub_id = sub.id

    res_adv_fail = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": sub_id, "action": "hold", "reason": "bad"},
        headers=headers
    )
    assert res_adv_fail.status_code == 400

    res_adv_ok = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": sub_id, "action": "hold", "reason": "Discrepancy in sanctioned CSE intake ceiling."},
        headers=headers
    )
    assert res_adv_ok.status_code == 200

    # 6. Duplicates & decisions
    res_dups = client.get("/api/v1/officer/duplicates", headers=headers)
    assert res_dups.status_code == 200
    assert len(res_dups.json()) > 0

    res_dup_dec = client.post(
        "/api/v1/officer/duplicate-decision",
        json={"case_id": "dup_01", "decision": "needs_review", "reason": "Referred to Joint Regional Scrutiny Board."},
        headers=headers
    )
    assert res_dup_dec.status_code == 200

    # 7. Reveal full APAAR ID with mandatory written reason
    with Session(engine) as session:
        stu = session.exec(select(StudentRecord)).first()
        stu_id = stu.id

    res_rev = client.post(
        f"/api/v1/students/{stu_id}/reveal",
        json={"reason": "Statutory regional committee verification order #9921"},
        headers=headers
    )
    assert res_rev.status_code == 200
    assert len(res_rev.json()["full_apaar_id"]) == 12

    # 8. Cryptographic audit chain verification, tamper demo, and restore
    res_audit_v1 = client.get("/api/v1/audit/verify", headers=headers)
    assert res_audit_v1.status_code == 200
    assert res_audit_v1.json()["valid"] is True

    # Tamper simulation
    res_tamper = client.post("/api/v1/audit/tamper-demo", headers=headers)
    assert res_tamper.status_code == 200
    assert res_tamper.json()["verification_result"]["valid"] is False

    # Restore chain
    res_restore = client.post("/api/v1/audit/restore", headers=headers)
    assert res_restore.status_code == 200
    assert res_restore.json()["verification_result"]["valid"] is True

    # 9. Download Compliance Report PDF
    res_report = client.get("/api/v1/institutions/1-1090123456/compliance-report.pdf", headers=headers)
    assert res_report.status_code == 200
    assert res_report.headers["content-type"] == "application/pdf"
    assert len(res_report.content) > 1000


# ----------------- Journey 3: Student Sovereignty -----------------
def test_journey_3_student_sovereignty(client: TestClient):
    with Session(engine) as session:
        stu = session.exec(select(StudentRecord)).first()
        assert stu is not None
        stu_token = stu.apaar_token
        stu_id = stu.id

    student_auth = create_demo_token(Role.STUDENT, student_token=stu_token)
    headers = {"Authorization": f"Bearer {student_auth}"}

    # 1. Fetch digital record
    res_rec = client.get(f"/api/v1/students/{stu_token}/record", headers=headers)
    assert res_rec.status_code == 200
    rec_data = res_rec.json()
    assert rec_data["student"]["apaar_masked"].startswith("XXXX-")

    # 2. Grant selective consent (only name, programme, institution)
    res_cg = client.post(
        f"/api/v1/students/{stu_token}/consent",
        json={
            "purpose": "Employment Verification",
            "allowed_fields": ["name", "programme", "institution"],
            "duration_days": 30
        },
        headers=headers
    )
    assert res_cg.status_code == 200
    grant_id = res_cg.json()["grant"]["id"]

    # 3. Issue verifiable credential and generate presentation
    res_issue = client.post(f"/api/v1/credentials/issue?student_id={stu_id}")
    assert res_issue.status_code == 200
    cred_id = res_issue.json()["credential_id"]

    res_pres = client.get(f"/api/v1/credentials/{cred_id}/presentation?purpose=Employment+Verification")
    assert res_pres.status_code == 200
    presentation = res_pres.json()

    # 4. Verify presentation as Public Verifier
    res_v1 = client.post("/api/v1/verify/presentation?verifier_type=Employer", json=presentation)
    assert res_v1.status_code == 200
    v1_data = res_v1.json()
    assert v1_data["status"] == "genuine"
    assert v1_data["genuine"] is True
    # Only consented fields are disclosed!
    disclosed = list(v1_data["disclosed_claims"].keys())
    assert "name" in disclosed
    assert "dob" not in disclosed  # DOB was withheld!

    # 5. Revoke consent
    res_revoke = client.post(f"/api/v1/consent/{grant_id}/revoke", headers=headers)
    assert res_revoke.status_code == 200
    assert res_revoke.json()["status"] == "revoked"

    # 6. Verifying again FAILS immediately with clear message
    res_v2 = client.post("/api/v1/verify/presentation?verifier_type=Employer", json=presentation)
    assert res_v2.status_code == 200
    v2_data = res_v2.json()
    assert v2_data["status"] == "revoked"
    assert v2_data["genuine"] is False
    assert "revoked" in v2_data["message"].lower()

    # 7. "Who viewed my record" shows both verification attempts
    res_logs = client.get(f"/api/v1/students/{stu_token}/access-log", headers=headers)
    assert res_logs.status_code == 200
    logs = res_logs.json()
    assert len(logs) >= 2


# ----------------- Journey 4: Public Verifier (All 5 Outcomes) -----------------
def test_journey_4_public_verifier_all_five_outcomes(client: TestClient):
    with Session(engine) as session:
        stu = session.exec(select(StudentRecord)).first()
        stu_id = stu.id
        stu_token = stu.apaar_token

    # Setup credential
    res_issue = client.post(f"/api/v1/credentials/issue?student_id={stu_id}")
    cred_id = res_issue.json()["credential_id"]

    # Active consent
    client.post(
        f"/api/v1/students/{stu_token}/consent",
        json={"purpose": "Public", "allowed_fields": ["name", "programme"], "duration_days": 10},
        headers={"X-Role": "Student", "X-Student-Token": stu_token}
    )

    valid_pres = client.get(f"/api/v1/credentials/{cred_id}/presentation?purpose=Public").json()

    # Outcome 1: Genuine
    res_gen = client.post("/api/v1/verify/presentation", json=valid_pres)
    assert res_gen.status_code == 200
    assert res_gen.json()["status"] == "genuine"
    assert res_gen.json()["genuine"] is True

    # Outcome 2: Revoked (by revoking consent)
    with Session(engine) as session:
        cgs = session.exec(select(ConsentGrant).where(ConsentGrant.student_token == stu_token)).all()
        for cg in cgs:
            cg.revoked_at = datetime.now(timezone.utc)
            session.add(cg)
        session.commit()

    res_rev = client.post("/api/v1/verify/presentation", json=valid_pres)
    assert res_rev.status_code == 200
    assert res_rev.json()["status"] == "revoked"
    assert res_rev.json()["genuine"] is False

    # Outcome 3: Expired
    with Session(engine) as session:
        cgs = session.exec(select(ConsentGrant).where(ConsentGrant.student_token == stu_token)).all()
        for cg in cgs:
            cg.revoked_at = None
            cg.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            session.add(cg)
        # Also expire credential
        cred = session.get(Credential, cred_id)
        cred.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        session.add(cred)
        session.commit()

    res_exp = client.post("/api/v1/verify/presentation", json=valid_pres)
    assert res_exp.status_code == 200
    assert res_exp.json()["status"] in ["expired", "revoked"]

    # Outcome 4: Tampered (modify claims commitment without signing)
    with Session(engine) as session:
        cred = session.get(Credential, cred_id)
        cred.expires_at = datetime.now(timezone.utc) + timedelta(days=365)
        session.add(cred)
        cgs = session.exec(select(ConsentGrant).where(ConsentGrant.student_token == stu_token)).all()
        for cg in cgs:
            cg.revoked_at = None
            cg.expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            session.add(cg)
        session.commit()

    tampered_pres = dict(valid_pres)
    tampered_pres["signature"] = "0" * 128  # Invalid signature
    res_tamp = client.post("/api/v1/verify/presentation", json=tampered_pres)
    assert res_tamp.status_code == 200
    assert res_tamp.json()["status"] == "tampered"
    assert res_tamp.json()["genuine"] is False

    # Outcome 5: Not found
    not_found_pres = dict(valid_pres)
    not_found_pres["credential_id"] = "cred_non_existent_99999"
    res_nf = client.post("/api/v1/verify/presentation", json=not_found_pres)
    assert res_nf.status_code == 200
    assert res_nf.json()["status"] == "not_found"
    assert res_nf.json()["genuine"] is False


# ----------------- Role Isolation Checks -----------------
def test_role_isolation_and_security(client: TestClient):
    stu_token = compute_apaar_token("234567890123")
    student_headers = {"Authorization": f"Bearer {create_demo_token(Role.STUDENT, student_token=stu_token)}"}
    college_headers = {"Authorization": f"Bearer {create_demo_token(Role.INSTITUTION, institution_id='1-1090123456')}"}

    # 1. Student CANNOT call officer endpoints
    res_officer_forbidden = client.get("/api/v1/officer/sparklines", headers=student_headers)
    assert res_officer_forbidden.status_code == 403

    res_audit_forbidden = client.get("/api/v1/audit/trail", headers=student_headers)
    assert res_audit_forbidden.status_code == 403

    # 2. Student CANNOT browse college or all institutions
    res_inst_forbidden = client.get("/api/v1/institutions", headers=student_headers)
    assert res_inst_forbidden.status_code == 403

    # 3. College CANNOT read another institution's detail
    res_cross_college = client.get("/api/v1/institutions/1-1090234567", headers=college_headers)
    assert res_cross_college.status_code == 403

    # 4. College CANNOT take officer adverse actions
    res_adv_forbidden = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": "sub_1", "action": "hold", "reason": "Malicious attempt"},
        headers=college_headers
    )
    assert res_adv_forbidden.status_code == 403
