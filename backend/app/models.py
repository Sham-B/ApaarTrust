import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON





class StatusEnum:
    VERIFIED = "verified"
    MISMATCH_DETECTED = "mismatch_detected"
    NOT_FOUND = "not_found"
    VERIFICATION_PENDING = "verification_pending"
    SOURCE_UNAVAILABLE = "source_unavailable"
    MANUAL_REVIEW_REQUIRED = "manual_review_required"
    CANNOT_ASSESS = "cannot_assess"

    ALL_STATUSES = [
        VERIFIED,
        MISMATCH_DETECTED,
        NOT_FOUND,
        VERIFICATION_PENDING,
        SOURCE_UNAVAILABLE,
        MANUAL_REVIEW_REQUIRED,
        CANNOT_ASSESS,
    ]


class QuotaEnum:
    REGULAR = "Regular"
    SUPERNUMERARY = "Supernumerary"
    NRI = "NRI"
    OCI = "OCI"
    FN = "FN"
    OTHER = "Other"


class NationalityEnum:
    INDIAN = "Indian"
    NRI = "NRI"
    OCI = "OCI"
    FN = "FN"


class Institution(SQLModel, table=True):
    id: str = Field(primary_key=True)  # aicte_pid, e.g. "1-1090123456"
    aicte_pid: str = Field(index=True, unique=True)
    name: str = Field(index=True)
    state: str = Field(index=True)
    district: str = "Central"
    address: str = "Campus Address"
    contact_email: str = "registrar@institution.edu.in"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProgrammeSeatMatrix(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    institution_id: str = Field(foreign_key="institution.id", index=True)
    programme: str = Field(index=True)  # e.g. "B.Tech Computer Science and Engineering"
    academic_year: str = Field(default="2024-25", index=True)
    approved_intake: int = Field(default=120)
    supernumerary_caps: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StudentRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    apaar_token: str = Field(index=True)  # HMAC-SHA256(SECRET_KEY, apaar_id)
    apaar_id_encrypted: str  # Fernet encrypted
    apaar_masked: str = Field(index=True)  # "XXXX-XXXX-1234"
    name: str = Field(index=True)
    dob: str = Field(index=True)  # YYYY-MM-DD
    gender: str = "Male"
    social_category: str = "General"  # General, OBC, SC, ST, EWS
    nationality_status: str = Field(default=NationalityEnum.INDIAN)  # Indian | NRI | OCI | FN
    admission_quota: str = Field(default=QuotaEnum.REGULAR)  # Regular | Supernumerary | NRI | OCI | FN | Other
    programme: str = Field(index=True)
    admission_date: str = "2024-08-01"  # YYYY-MM-DD
    enrolment_status: str = Field(default="Active", index=True)  # Active | Completed | Withdrawn | Suspended
    student_id: str = Field(index=True)  # College roll number
    institution_id: str = Field(foreign_key="institution.id", index=True)
    submission_id: Optional[str] = Field(default=None, foreign_key="submission.id", index=True)
    academic_year: str = Field(default="2024-25", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Submission(SQLModel, table=True):
    id: str = Field(primary_key=True)  # e.g. "sub_1090_v1"
    institution_id: str = Field(foreign_key="institution.id", index=True)
    academic_year: str = Field(default="2024-25", index=True)
    version: int = Field(default=1)
    status: str = Field(default="dry_run", index=True)  # "dry_run" | "committed"
    filename: str = "students_intake.xlsx"
    total_rows: int = 0
    valid_rows: int = 0
    flagged_rows: int = 0
    submission_hash: str = Field(index=True)
    counts: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    committed_at: Optional[datetime] = None

    # Officer adverse action safeguards
    held_by_officer: bool = Field(default=False)
    rejected_by_officer: bool = Field(default=False)
    adverse_reason: Optional[str] = None
    officer_id: Optional[str] = None
    action_timestamp: Optional[datetime] = None


class Finding(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    submission_id: str = Field(foreign_key="submission.id", index=True)
    institution_id: str = Field(foreign_key="institution.id", index=True)
    student_record_id: Optional[int] = Field(default=None, index=True)
    row_number: int = 0
    rule_id: str = Field(index=True)
    severity: str = Field(default="medium", index=True)  # "critical", "high", "medium", "low", "info"
    plain_reason: str
    evidence: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    benign_hypotheses: List[Dict[str, str]] = Field(default_factory=list, sa_column=Column(JSON))
    fix_hint: str
    status: str = Field(default="open", index=True)  # "open", "resolved", "dismissed_by_officer", "held_by_officer"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ConsentGrant(SQLModel, table=True):
    id: str = Field(primary_key=True)  # cg_...
    student_token: str = Field(index=True)  # apaar_token
    purpose: str = "Employment Verification"
    allowed_fields: List[str] = Field(default_factory=lambda: ["name", "programme", "institution", "enrolment_status"], sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    revoked_at: Optional[datetime] = None


class Credential(SQLModel, table=True):
    id: str = Field(primary_key=True)  # cred_...
    subject_token: str = Field(index=True)  # apaar_token
    commitments: Dict[str, str] = Field(default_factory=dict, sa_column=Column(JSON))  # field -> sha256(salt + ":" + value)
    salts_encrypted: str  # Fernet encrypted JSON of salts
    claims_encrypted: str  # Fernet encrypted JSON of plaintext claims
    signature: str  # Ed25519 signature of commitments canonical digest
    issuer: str = "AICTE-ApaarTrust-Authority"
    issued_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    revoked: bool = Field(default=False, index=True)
    revoked_at: Optional[datetime] = None


class VerificationLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    credential_id: str = Field(index=True)
    student_token: str = Field(index=True)
    verifier_type: str = "Public"  # Employer | Regulator | Public
    fields_disclosed: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    status: str = Field(default="genuine")  # genuine | revoked | expired | tampered | not_found
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class AuditEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)
    actor_role: str = Field(default="System")
    action: str = Field(index=True)  # 'SUBMISSION_UPLOAD', 'SUBMISSION_COMMIT', 'REVEAL_ID', 'OFFICER_DECISION', etc.
    application_id: Optional[str] = Field(default=None, index=True)  # institution_id or submission_id
    doc_id: Optional[str] = None  # student_id or credential_id
    payload: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    prev_hash: str
    current_hash: str = Field(index=True)


class Alert(SQLModel, table=True):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    institution_id: Optional[str] = Field(default=None, index=True)
    alert_type: str = Field(index=True)  # 'over_intake', 'cross_institution_duplicate', 'registry_mismatch', 'overdue', 'consent_expiring'
    severity: str = Field(default="warning")  # 'info', 'warning', 'critical'
    title: str
    message: str
    rule_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved: bool = Field(default=False)


class MockCitizen(SQLModel, table=True):
    apaar_id: str = Field(primary_key=True)  # 12 digits
    name: str = Field(index=True)
    dob: str = Field(index=True)  # YYYY-MM-DD
    gender: str = "Male"
    status: str = Field(default="active")  # active | suspended | not_issued
    consent_flag: bool = Field(default=True)
    phone_masked: str = "XXXXXX9876"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
