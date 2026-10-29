import json
import pytest
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
    AuditEntry,
)
from backend.app.security import (
    Role,
)
from backend.app.audit import verify_audit_chain

from backend.synth.seed import seed_database
from backend.app.engine.credentials import generate_presentation, verify_presentation
from backend.app.engine.duplicates import redact_finding_for_role


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    init_db()
    seed_database(force=True)
    yield


@pytest.fixture
def client():
    return TestClient(app)


# 1. Test: Dry-run saves nothing to database
def test_dry_run_saves_nothing(client: TestClient):
    with Session(engine) as session:
        initial_students = len(session.exec(select(StudentRecord)).all())
        initial_subs = len(session.exec(select(Submission)).all())

    csv_content = (
        "apaar_id,name,dob,gender,social_category,nationality_status,admission_quota,programme,admission_date,student_id\n"
        "223344556677,Test Candidate,2004-05-15,Male,General,Indian,Regular,B.Tech Computer Science and Engineering,2024-08-15,TEST-001\n"
    )

    response = client.post(
        "/api/v1/upload/dry-run",
        data={"institution_id": "1-1090123456", "academic_year": "2024-25"},
        files={"file": ("test_students.csv", csv_content, "text/csv")},
        headers={"X-Role": "Institution"}
    )
    assert response.status_code == 200
    res = response.json()
    assert res["dry_run"] is True
    assert res["status"] == "dry_run_complete"

    with Session(engine) as session:
        post_students = len(session.exec(select(StudentRecord)).all())
        post_subs = len(session.exec(select(Submission)).all())

    # Strictly no changes saved
    assert post_students == initial_students
    assert post_subs == initial_subs


# 2. Test: Over-intake detected (sanctioned regular and supernumerary caps)
def test_over_intake_detected(client: TestClient):
    # Check archetype 2 (Bhaskara College: 1-1090234567)
    with Session(engine) as session:
        findings = session.exec(
            select(Finding)
            .where(Finding.institution_id == "1-1090234567")
            .where(Finding.rule_id == "SEAT_CAP_REGULAR")
        ).all()
        assert len(findings) > 0
        f = findings[0]
        assert "exceed sanctioned intake" in f.plain_reason
        assert f.evidence.get("excess", 0) > 0


# 3. Test: Cross-institution duplicate detected without leaking other institution to Institution role
def test_cross_institution_duplicate_privacy_redaction():
    finding_dict = {
        "rule_id": "DUPLICATE_CROSS_INSTITUTION",
        "severity": "critical",
        "plain_reason": "Student concurrently enrolled at another AICTE-approved institution with overlapping active tenure.",
        "evidence": {
            "conflicting_institution_id": "1-1090123456",
            "conflicting_institution_name": "Aryabhata Institute of Technology",
            "conflicting_programme": "B.Tech Computer Science and Engineering",
            "apaar_masked": "XXXX-XXXX-1100"
        }
    }

    # As Institution role: must be redacted
    redacted = redact_finding_for_role(finding_dict, Role.INSTITUTION)
    assert "Possible enrolment at another AICTE institution: AICTE will contact you" in redacted["plain_reason"]
    assert "Aryabhata Institute of Technology" not in json.dumps(redacted["evidence"])
    assert "1-1090123456" not in json.dumps(redacted["evidence"])

    # As Officer role: retains details
    officer_view = redact_finding_for_role(finding_dict, Role.OFFICER)
    assert "Aryabhata Institute of Technology" in officer_view["evidence"]["conflicting_institution_name"]


# 4. Test: Selective disclosure verifies and a tampered field fails
def test_selective_disclosure_and_tamper_detection():
    with Session(engine) as session:
        student = session.exec(select(StudentRecord)).first()
        cred = session.exec(select(Credential).where(Credential.subject_token == student.apaar_token)).first()
        if not cred:
            from backend.app.engine.credentials import issue_verifiable_credential
            cred = issue_verifiable_credential(student, "Test College", session)

        # Generate presentation
        pres = generate_presentation(cred.id, "Test Verify", session)

        # Verify untampered
        res_valid = verify_presentation(pres, "Test Verifier", session)
        assert res_valid["genuine"] is True
        assert res_valid["status"] == "genuine"

        # Tamper a disclosed field (e.g. change programme title)
        tampered_pres = json.loads(json.dumps(pres))
        for k in tampered_pres["disclosed_claims"].keys():
            tampered_pres["disclosed_claims"][k] = "TAMPERED_FRAUDULENT_DEGREE"
            break

        res_tampered = verify_presentation(tampered_pres, "Test Verifier", session)
        assert res_tampered["genuine"] is False
        assert res_tampered["status"] == "tampered"


# 5. Test: Revoked consent blocks verification
def test_revoked_consent_blocks_verification():
    with Session(engine) as session:
        student = session.exec(select(StudentRecord)).first()
        cred = session.exec(select(Credential).where(Credential.subject_token == student.apaar_token)).first()

        pres = generate_presentation(cred.id, "Consent Check", session)

        # Revoke consent
        grant = session.exec(select(ConsentGrant).where(ConsentGrant.student_token == student.apaar_token)).first()
        from datetime import datetime, timezone
        grant.revoked_at = datetime.now(timezone.utc)
        session.add(grant)
        session.commit()

        # Re-verify should fail with revoked status
        res = verify_presentation(pres, "Public Verifier", session)
        assert res["genuine"] is False
        assert res["status"] == "revoked"

        # Restore consent for other tests
        grant.revoked_at = None
        session.add(grant)
        session.commit()


# 6. Test: Only an Officer can take adverse action
def test_only_officer_can_take_adverse_action(client: TestClient):
    with Session(engine) as session:
        sub = session.exec(select(Submission)).first()
        sub_id = sub.id

    # Non-officer attempts adverse action: must return 403 Forbidden
    resp_inst = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": sub_id, "action": "reject", "reason": "Attempted by college role"},
        headers={"X-Role": "Institution"}
    )
    assert resp_inst.status_code == 403
    assert "Only AICTE Scrutiny Officers" in resp_inst.json()["detail"]

    # Officer with < 10 char reason: must return 400 Bad Request
    resp_short = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": sub_id, "action": "hold", "reason": "short"},
        headers={"X-Role": "Officer"}
    )
    assert resp_short.status_code == 400

    # Officer with valid written justification: succeeds
    resp_ok = client.post(
        "/api/v1/officer/adverse-action",
        json={"submission_id": sub_id, "action": "hold", "reason": "Sanctioned intake ceiling breached pending committee inspection."},
        headers={"X-Role": "Officer"}
    )
    assert resp_ok.status_code == 200
    assert resp_ok.json()["status"] == "action_recorded"


# 7. Test: Masking and reveal are audit-logged
def test_masking_and_reveal_audit_logging(client: TestClient):
    with Session(engine) as session:
        student = session.exec(select(StudentRecord)).first()
        stu_id = student.id

    # Get student via API: masked by default
    res = client.get(f"/api/v1/institutions/{student.institution_id}/students", headers={"X-Role": "Officer"})
    assert res.status_code == 200
    students_list = res.json()
    match = next(s for s in students_list if s["id"] == stu_id)
    assert match["apaar_id"].startswith("XXXX-XXXX-")

    # Call reveal with written reason
    reveal_resp = client.post(
        f"/api/v1/students/{stu_id}/reveal",
        json={"reason": "Regional committee verification order #9921"},
        headers={"X-Role": "Officer"}
    )
    assert reveal_resp.status_code == 200
    data = reveal_resp.json()
    assert len(data["full_apaar_id"]) == 12
    assert data["full_apaar_id"].isdigit()

    # Verify audit log recorded this event
    with Session(engine) as session:
        last_audit = session.exec(
            select(AuditEntry).where(AuditEntry.action == "CONFIDENTIAL_APAAR_ID_REVEALED").order_by(AuditEntry.id.desc())
        ).first()
        assert last_audit is not None
        assert last_audit.actor_role == "Officer"
        assert "9921" in last_audit.payload["justification_reason"]


# 8. Test: Audit chain verifies
def test_audit_chain_verifies():
    with Session(engine) as session:
        result = verify_audit_chain(session)
        assert result["valid"] is True
        assert result["total_entries"] > 0
        assert "intact" in result["message"].lower()


# 9. Test: Student cannot call officer or college endpoints (403)
def test_student_cannot_call_officer_or_college_endpoints(client: TestClient):
    student_headers = {"X-Role": "Student"}

    # Attempt browsing institutions directory
    resp_insts = client.get("/api/v1/institutions", headers=student_headers)
    assert resp_insts.status_code == 403
    assert "Access forbidden" in resp_insts.json()["detail"]

    # Attempt reading audit trail
    resp_audit = client.get("/api/v1/audit/trail", headers=student_headers)
    assert resp_audit.status_code == 403

    # Attempt running data fraud drill
    resp_drill = client.post("/api/v1/drill/run", headers=student_headers)
    assert resp_drill.status_code == 403

    # Attempt uploading intake batch
    csv_content = "apaar_id,name,dob,gender,social_category,nationality_status,admission_quota,programme,admission_date,student_id\n"
    resp_upload = client.post(
        "/api/v1/upload/dry-run",
        data={"institution_id": "1-1090123456", "academic_year": "2024-25"},
        files={"file": ("test.csv", csv_content, "text/csv")},
        headers=student_headers,
    )
    assert resp_upload.status_code == 403


# 10. Test: College cannot read another institution (403)
def test_college_cannot_read_another_institution(client: TestClient):
    # Aryabhata College headers
    college_headers = {
        "X-Role": "Institution",
        "X-Institution-Id": "1-1090123456"
    }

    # Accessing own institution: 200 OK
    resp_own = client.get("/api/v1/institutions/1-1090123456", headers=college_headers)
    assert resp_own.status_code == 200
    assert resp_own.json()["institution"]["name"] == "Aryabhata Institute of Technology"

    # Attempting to read Bhaskara College (1-1090234567): 403 Forbidden
    resp_other = client.get("/api/v1/institutions/1-1090234567", headers=college_headers)
    assert resp_other.status_code == 403
    assert "Access forbidden" in resp_other.json()["detail"]

    # Attempting to read another college's students: 403 Forbidden
    resp_other_students = client.get("/api/v1/institutions/1-1090234567/students", headers=college_headers)
    assert resp_other_students.status_code == 403


# 11. Test: Public verifier gets only consented fields
def test_public_verifier_gets_only_consented_fields(client: TestClient):
    with Session(engine) as session:
        student = session.exec(select(StudentRecord)).first()
        cred = session.exec(select(Credential).where(Credential.subject_token == student.apaar_token)).first()
        if not cred:
            from backend.app.engine.credentials import issue_verifiable_credential
            cred = issue_verifiable_credential(student, "Test College", session)

        pres = generate_presentation(cred.id, "Public Verification", session)

    resp = client.post(
        "/api/v1/verify/presentation",
        json=pres,
        headers={"X-Role": "Verifier"}
    )
    assert resp.status_code == 200
    result = resp.json()
    assert result["genuine"] is True
    assert result["status"] == "genuine"

    # Verifier sees disclosed claims (e.g. name, programme)
    assert "name" in result["disclosed_claims"]
    assert "programme" in result["disclosed_claims"]

    # Sensitive fields that student has NOT consented to disclose remain withheld
    withheld_keys = result["withheld_fields"]
    assert "dob" in withheld_keys or "social_category" in withheld_keys
    assert "social_category" not in result["disclosed_claims"]


# 12. Test: /api/v1/me returns strict role profile, persona, and nav
def test_me_endpoint_returns_correct_nav_and_persona(client: TestClient):
    # Officer
    res_officer = client.get("/api/v1/me", headers={"X-Role": "Officer"})
    assert res_officer.status_code == 200
    officer_data = res_officer.json()
    assert officer_data["role"] == "Officer"
    assert officer_data["persona"]["name"] == "Ananya Rao"
    assert any(nav["href"] == "#/officer/overview" for nav in officer_data["nav"])
    assert not any("/student/" in nav["href"] for nav in officer_data["nav"])

    # Student
    res_student = client.get("/api/v1/me", headers={"X-Role": "Student"})
    assert res_student.status_code == 200
    student_data = res_student.json()
    assert student_data["role"] == "Student"
    assert student_data["persona"]["name"] == "Rohan Aditya Sharma"
    assert any(nav["href"] == "#/student/record" for nav in student_data["nav"])
    assert not any("/officer/" in nav["href"] for nav in student_data["nav"])
    assert not any("/college/" in nav["href"] for nav in student_data["nav"])

    # Institution
    res_college = client.get("/api/v1/me", headers={"X-Role": "Institution", "X-Institution-Id": "1-1090123456"})
    assert res_college.status_code == 200
    college_data = res_college.json()
    assert college_data["role"] == "Institution"
    assert any(nav["href"] == "#/college/overview" for nav in college_data["nav"])
    assert not any("/officer/" in nav["href"] for nav in college_data["nav"])
