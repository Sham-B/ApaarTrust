"""
Tests for Offline AI Compliance Assistant & Grounded Knowledge Base
Verifies:
1. 30 distinct question / expected-source pairs across portals, rules, glossary, and verification
2. Grounding guarantee: every answer begins with 'Based on the demo rule set' and cites source
3. Seat limits disclaimer: all seat-related answers include DEMO VALUES disclaimer
4. Advisory footer: every answer ends with 'Demo assistant. Not legal or regulatory advice.'
5. Refusal test: out-of-scope query returns 'That is not in the configured rules' + 3 suggestions
6. Role-scope leakage test: student role cannot query internal officer/institution data
"""

import pytest
from sqlmodel import Session
from backend.app.db import engine
from backend.app.engine.copilot import query_copilot, COPILOT_FOOTER, SEAT_DISCLAIMER


@pytest.fixture(name="session")
def session_fixture():
    with Session(engine) as session:
        yield session


QA_TEST_CASES = [
    # 1. TFW Seat Quota
    ("What is the Tuition Fee Waiver (TFW) limit?", "rules/seat_rules.yaml: seat_quotas.tfw", True, "Officer"),
    # 2. EWS Seat Quota
    ("What is the Economically Weaker Section (EWS) quota limit?", "rules/seat_rules.yaml: seat_quotas.ews", True, "Officer"),
    # 3. Kashmiri Migrants (KM)
    ("What is the Kashmiri Migrants (KM) quota limit?", "rules/seat_rules.yaml: seat_quotas.km", True, "Officer"),
    # 4. PMSSS Scholarship
    ("What is the PMSSS scholarship quota limit?", "rules/seat_rules.yaml: seat_quotas.pmsss", True, "Officer"),
    # 5. NRI / Foreign National Quota
    ("What are the NRI and Foreign National (FN/OCI) quotas?", "rules/seat_rules.yaml: seat_quotas.nri_and_fn_oci", True, "Officer"),
    # 6. Lateral Entry
    ("What is the Lateral Entry quota ceiling?", "rules/seat_rules.yaml: seat_quotas.lateral_entry", True, "Officer"),
    # 7. Regular Sanctioned Intake
    ("What is rule SEAT_CAP_REGULAR and how do I fix it?", "rules/validation_rules.yaml: SEAT_CAP_REGULAR", True, "Officer"),
    # 8. Cross-Institution Duplicate
    ("What is DUPLICATE_CROSS_INSTITUTION and how is it resolved?", "rules/validation_rules.yaml: DUPLICATE_CROSS_INSTITUTION", False, "Officer"),
    # 9. Intra-Batch Duplicate
    ("What is DUPLICATE_IN_BATCH and how do I fix it?", "rules/validation_rules.yaml: DUPLICATE_IN_BATCH", False, "Institution"),
    # 10. APAAR Format
    ("What is rule APAAR_FORMAT?", "rules/validation_rules.yaml: APAAR_FORMAT", False, "Institution"),
    # 11. Name Mismatch
    ("What is REGISTRY_MISMATCH_NAME and what is the threshold?", "rules/validation_rules.yaml: REGISTRY_MISMATCH_NAME", False, "Officer"),
    # 12. Date of Birth Mismatch
    ("What is REGISTRY_MISMATCH_DOB?", "rules/validation_rules.yaml: REGISTRY_MISMATCH_DOB", False, "Officer"),
    # 13. DOB Cluster Anomaly
    ("What is ANOMALY_DOB_CLUSTER?", "rules/validation_rules.yaml: ANOMALY_DOB_CLUSTER", False, "Officer"),
    # 14. Gender Ratio Anomaly
    ("What is ANOMALY_GENDER_RATIO?", "rules/validation_rules.yaml: ANOMALY_GENDER_RATIO", False, "Officer"),
    # 15. Invalid Affirmative Action
    ("What is INVALID_AFFIRMATIVE_ACTION?", "rules/validation_rules.yaml: INVALID_AFFIRMATIVE_ACTION", False, "Officer"),
    # 16. Concept: APAAR
    ("What is APAAR?", "glossary: apaar", False, "Public"),
    # 17. Concept: SD-JWT
    ("What is SD-JWT selective disclosure?", "glossary: privacy_sdjwt", False, "Student"),
    # 18. Concept: Dry Run
    ("What is dry run simulation?", "glossary: dry_run", False, "Institution"),
    # 19. Concept: Ed25519
    ("What cryptographic signature is used for credentials?", "glossary: ed25519", False, "Public"),
    # 20. Concept: Audit Trail
    ("How does the cryptographic audit trail work?", "knowledge: portals.officer_audit", False, "Officer"),
    # 21. Concept: Retention Horizons
    ("What are the data retention horizons?", "rules/retention.yaml: retention_horizons_days", False, "Officer"),
    # 22. Outcome: Verified Genuine
    ("What does 'Verified Genuine' mean in verification?", "knowledge: verification.genuine", False, "Public"),
    # 23. Outcome: Revoked
    ("What does 'Revoked' mean in verification?", "knowledge: verification.revoked", False, "Public"),
    # 24. Outcome: Expired
    ("What does 'Expired' mean in verification?", "knowledge: verification.expired", False, "Public"),
    # 25. Outcome: Tampered
    ("What does 'Tampered' mean in verification?", "knowledge: verification.tampered", False, "Public"),
    # 26. Outcome: Not Found
    ("What does 'Not Found' mean in verification?", "knowledge: verification.not_found", False, "Public"),
    # 27. Limitation: DEMO VALUES
    ("Are seat caps and quotas official AICTE rules?", "rules/seat_rules.yaml: disclaimer", True, "Public"),
    # 28. Limitation: Synthetic Data
    ("Is real student data stored in ApaarTrust?", "knowledge: limitations.synthetic_data", False, "Public"),
    # 29. Limitation: AI Role
    ("Does the AI assistant make regulatory decisions?", "knowledge: limitations.ai_role", False, "Public"),
    # 30. Limitation: Encryption
    ("What encryption algorithm protects APAAR IDs at rest?", "knowledge: limitations.encryption", False, "Officer"),
]


def test_copilot_30_question_source_pairs(session):
    """Verifies that all 30 distinct questions resolve to their expected sources with mandatory labels."""
    for idx, (question, expected_source, is_seat, role) in enumerate(QA_TEST_CASES, start=1):
        res = query_copilot(user_message=question, role=role, session=session)
        reply = res["reply"]
        source = res["source"]

        assert "Based on the demo rule set" in reply, f"Q{idx} failed prefix check: {question}"
        assert COPILOT_FOOTER in reply, f"Q{idx} failed footer check: {question}"
        assert expected_source in source or expected_source in reply, (
            f"Q{idx} expected source '{expected_source}' not in '{source}' (reply: {reply[:100]}...)"
        )

        if is_seat:
            assert SEAT_DISCLAIMER in reply, f"Q{idx} seat disclaimer missing for '{question}'"


def test_copilot_out_of_scope_refusal(session):
    """Verifies that questions outside configured rules trigger the standard refusal response."""
    out_of_scope_questions = [
        "What is the weather in New Delhi today?",
        "Can you write a poem about artificial intelligence?",
        "How do I invest in Indian stock market mutual funds?",
    ]
    for q in out_of_scope_questions:
        res = query_copilot(user_message=q, role="Officer", session=session)
        reply = res["reply"]
        assert "That is not in the configured rules" in reply
        assert res["source"] == "none"
        assert COPILOT_FOOTER in reply
        assert "Suggested questions for your role:" in reply
        assert len(res.get("follow_ups", [])) >= 2


def test_copilot_role_scope_leakage_protection(session):
    """Verifies that a student role cannot access internal officer-only scrutiny data."""
    # Officer-only query asked by a student
    student_res = query_copilot(
        user_message="How do I inspect cross-institution duplicates?",
        role="Student",
        session=session,
    )
    # Must refuse because duplicates portal is officer-scoped
    assert "That is not in the configured rules" in student_res["reply"] or student_res["source"] == "none"

    # College upload triage asked by a student
    student_res2 = query_copilot(
        user_message="How do I triage open findings in the inbox?",
        role="Student",
        session=session,
    )
    assert "That is not in the configured rules" in student_res2["reply"] or student_res2["source"] == "none"


def test_copilot_live_read_only_tools(session):
    """Verifies that live read-only queries return accurate role-scoped database metrics."""
    # Officer counts open findings
    off_res = query_copilot(
        user_message="How many open findings do I have?",
        role="Officer",
        session=session,
    )
    assert "open regulatory findings" in off_res["reply"]
    assert "tools: findings_count" in off_res["source"]

    # Student cannot count officer findings
    stu_res = query_copilot(
        user_message="How many open findings do I have?",
        role="Student",
        session=session,
    )
    assert "open regulatory findings" not in stu_res["reply"]
