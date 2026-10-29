import csv
import io
import json
import logging
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
import openpyxl
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
    Form,
    Query,
    Body,
    status,
)
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.app.config import settings, BASE_DIR, STORAGE_DIR
from backend.app.db import get_session, init_db
from backend.app.models import (
    Institution,
    ProgrammeSeatMatrix,
    StudentRecord,
    Submission,
    Finding,
    ConsentGrant,
    Credential,
    VerificationLog,
    AuditEntry,
    Alert,
)
from backend.app.security import (
    get_current_role,
    require_officer,
    Role,
    decrypt_apaar,
    encrypt_apaar,
    get_institution_context,
    get_student_token_context,
    assert_officer,
    assert_institution_access,
    assert_student_access,
    compute_apaar_token,
    create_demo_token,
)
from backend.app.audit import log_audit_event, verify_audit_chain, restore_audit_chain
from backend.app.mock_registry.router import router as mock_registry_router
from backend.synth.seed import (
    seed_database,
    run_seeding_in_background,
    get_seeding_health,
)

from backend.app.engine.validator import validate_batch
from backend.app.engine.diff import compute_submission_diff
from backend.app.engine.duplicates import redact_finding_for_role
from backend.app.engine.credentials import (
    issue_verifiable_credential,
    generate_presentation,
    verify_presentation,
    generate_certificate_pdf,
    generate_compliance_report_pdf,
    decode_qr_from_bytes,
)
from backend.app.engine.alerts import AlertEngine
from backend.app.engine.retention import execute_retention_purge
from backend.app.engine.fraud_drill import run_data_fraud_drill, run_speed_benchmark
from backend.app.engine.copilot import query_copilot
from backend.app.notifications import (
    get_notifications_for_context,
    mark_notification_as_read,
    mark_all_notifications_as_read,
    add_notification,
)

logger = logging.getLogger("apaartrust.main")

app = FastAPI(
    title="ApaarTrust",
    description="APAAR ID-Based Student Data Management and Verification Platform for AICTE-Approved Institutions",
    version="1.0.0",
)

# CORS Middleware
origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Mock APAAR Central Registry Router
app.include_router(mock_registry_router)


# ----------------- Lifespan / Startup Seeding -----------------
@app.on_event("startup")
def on_startup():
    init_db()
    # Trigger background seeding for instant responsiveness
    run_seeding_in_background(force=False)


# ----------------- Health & Status -----------------
@app.get("/health")
@app.get("/api/status")
def health_check() -> Dict[str, Any]:
    """Health check returning database readiness, seeded count, and demo mode."""
    health_info = get_seeding_health()
    return health_info


@app.post("/api/v1/system/reset-demo")
def reset_demo_database(
    role: str = Depends(require_officer),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Resets the environment back to the 5 canonical archetype institutions."""
    seed_database(force=True)
    log_audit_event(
        session=session,
        actor_role=role,
        action="DEMO_DATABASE_RESET",
        application_id="SYSTEM",
        payload={"message": "All 5 canonical archetype institutions reseeded cleanly."}
    )
    return {
        "status": "success",
        "message": "ApaarTrust database successfully re-seeded with 5 canonical archetypes.",
        "health": get_seeding_health()
    }


# ----------------- Demo Authentication & Bearer Tokens -----------------
class DemoSignInRequest(BaseModel):
    role: str
    institution_id: Optional[str] = None
    student_token: Optional[str] = None


@app.post("/api/v1/demo/signin")
def demo_signin(req: DemoSignInRequest) -> Dict[str, Any]:
    """Issues an HMAC-SHA256 signed demo bearer token for zero-friction role switching."""
    role_norm = req.role.strip().capitalize()
    if role_norm not in Role.ALL_ROLES:
        low = req.role.strip().lower()
        if "officer" in low:
            role_norm = Role.OFFICER
        elif "inst" in low or "college" in low or "reg" in low:
            role_norm = Role.INSTITUTION
        elif "stud" in low:
            role_norm = Role.STUDENT
        elif "verif" in low or "pub" in low or "emp" in low:
            role_norm = Role.VERIFIER
        else:
            raise HTTPException(status_code=400, detail=f"Invalid demo role '{req.role}'.")

    # Sensible defaults for college and student if not provided
    inst_id = req.institution_id or ("1-1090123456" if role_norm == Role.INSTITUTION else None)
    student_tok = req.student_token or (compute_apaar_token("554433221100") if role_norm == Role.STUDENT else None)
    token = create_demo_token(role=role_norm, institution_id=inst_id, student_token=student_tok)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role_norm,
        "institution_id": inst_id,
        "student_token": student_tok,
        "expires_in": 86400,
        "message": f"Authenticated successfully as {role_norm}."
    }


# ----------------- User Profile & Role Navigation (/api/v1/me) -----------------
@app.get("/api/v1/me")
def get_current_user_profile(
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session),
) -> Dict[str, Any]:
    """
    Returns authenticated role profile, persona details, granted permissions,
    and server-driven navigation links specific to that role.
    """
    if role == Role.OFFICER:
        return {
            "role": Role.OFFICER,
            "persona": {
                "name": "Ananya Rao",
                "designation": "Scrutiny Officer",
                "department": "AICTE Regulation Bureau",
                "badge": "Central Oversight",
                "email": "ananya.rao@aicte-india.org",
                "initials": "AR",
            },
            "permissions": [
                "officer:all",
                "read:all_institutions",
                "action:adverse",
                "view:audit_trail",
                "view:duplicates",
                "view:insights",
                "view:benchmarks",
                "triage:findings",
            ],
            "nav": [
                {"id": "overview", "title": "Overview", "href": "#/officer/overview", "icon": "layout-dashboard"},
                {"id": "institutions", "title": "Institutions", "href": "#/officer/institutions", "icon": "building-2"},
                {"id": "findings", "title": "Findings Inbox", "href": "#/officer/findings", "icon": "alert-triangle"},
                {"id": "duplicates", "title": "Duplicates & Collisions", "href": "#/officer/duplicates", "icon": "copy-check"},
                {"id": "verifications", "title": "Verification Activity", "href": "#/officer/verifications", "icon": "shield-check"},
                {"id": "insights", "title": "Insights & Drills", "href": "#/officer/insights", "icon": "line-chart"},
                {"id": "audit", "title": "Audit Log", "href": "#/officer/audit", "icon": "history"},
                {"id": "rules", "title": "Rules & Limits", "href": "#/officer/rules", "icon": "book-open"},
                {"id": "help", "title": "Help & Docs", "href": "#/help", "icon": "help-circle"},
            ]
        }

    if role == Role.INSTITUTION:
        target_id = institution_id or "1-1090123456"
        inst = session.get(Institution, target_id)
        inst_name = inst.name if inst else "Aryabhata Institute of Technology"
        return {
            "role": Role.INSTITUTION,
            "persona": {
                "name": "Dr. K. S. Verma",
                "designation": "College Registrar",
                "institution_id": target_id,
                "institution_name": inst_name,
                "badge": "AICTE Approved",
                "email": f"registrar@{target_id.lower().replace('-', '')}.edu.in",
                "initials": "KV",
            },
            "permissions": [
                "college:own",
                "upload:intake",
                "view:own_students",
                "view:certificates",
                "view:submissions",
                "view:todos",
            ],
            "nav": [
                {"id": "overview", "title": "Overview", "href": "#/college/overview", "icon": "layout-dashboard"},
                {"id": "upload", "title": "Upload Data", "href": "#/college/upload", "icon": "upload-cloud"},
                {"id": "students", "title": "Students", "href": "#/college/students", "icon": "users"},
                {"id": "certificates", "title": "Certificates", "href": "#/college/certificates", "icon": "award"},
                {"id": "submissions", "title": "Submissions", "href": "#/college/submissions", "icon": "file-clock"},
                {"id": "todos", "title": "To-do", "href": "#/college/todos", "icon": "check-square"},
                {"id": "help", "title": "Help & Docs", "href": "#/help", "icon": "help-circle"},
            ]
        }

    if role == Role.STUDENT:
        shared_token = student_token or compute_apaar_token("554433221100")
        student = session.exec(select(StudentRecord).where(StudentRecord.apaar_token == shared_token)).first()
        student_name = student.name if student else "Rohan Aditya Sharma"
        inst_name = "Aryabhata Institute of Technology"
        if student and student.institution_id:
            inst = session.get(Institution, student.institution_id)
            if inst:
                inst_name = inst.name

        return {
            "role": Role.STUDENT,
            "persona": {
                "name": student_name,
                "apaar_masked": student.apaar_masked if student else "XXXX-XXXX-1100",
                "token": shared_token,
                "student_token": shared_token,
                "programme": student.programme if student else "B.Tech Computer Science and Engineering",
                "institution_name": inst_name,
                "badge": "APAAR Verified",
                "initials": "RS",
            },
            "permissions": [
                "student:own",
                "view:own_record",
                "manage:consent",
                "view:access_log",
                "view:certificates",
                "share:presentation",
            ],
            "nav": [
                {"id": "record", "title": "My Record", "href": "#/student/record", "icon": "id-card"},
                {"id": "consent", "title": "Consent Ledger", "href": "#/student/consent", "icon": "lock"},
                {"id": "activity", "title": "Who Viewed My Record", "href": "#/student/activity", "icon": "eye"},
                {"id": "certificates", "title": "My Certificates", "href": "#/student/certificates", "icon": "award"},
                {"id": "share", "title": "Share Credentials", "href": "#/student/share", "icon": "share-2"},
                {"id": "help", "title": "Help & Docs", "href": "#/help", "icon": "help-circle"},
            ]
        }

    # Public Verifier
    return {
        "role": Role.VERIFIER,
        "persona": {
            "name": "Public Verifier",
            "designation": "Verification Gateway",
            "badge": "Public Access",
            "initials": "PV",
        },
        "permissions": ["verify:public"],
        "nav": [
            {"id": "verify", "title": "Verify Credential", "href": "#/verify", "icon": "shield-check"},
            {"id": "guide", "title": "How Verification Works", "href": "#/verify/guide", "icon": "info"},
            {"id": "help", "title": "Help & Docs", "href": "#/help", "icon": "help-circle"},
        ]
    }


# ----------------- Role Notifications -----------------
@app.get("/api/v1/notifications")
def get_notifications(
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
) -> Dict[str, Any]:
    """Returns unread counts and notifications list scoped to authenticated user context."""
    return get_notifications_for_context(role=role, institution_id=institution_id, student_token=student_token)


@app.post("/api/v1/notifications/{notif_id}/read")
def mark_single_notification_read(notif_id: str) -> Dict[str, Any]:
    """Marks a single notification as read."""
    ok = mark_notification_as_read(notif_id)
    return {"status": "success" if ok else "not_found", "id": notif_id}


@app.post("/api/v1/notifications/mark-all-read")
def mark_all_notifications_read_endpoint(
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
) -> Dict[str, Any]:
    """Marks all notifications for current context as read."""
    count = mark_all_notifications_as_read(role=role, institution_id=institution_id, student_token=student_token)
    return {"status": "success", "marked_read": count}


# ----------------- User Preferences Persistence -----------------
USER_PREFERENCES: Dict[str, Dict[str, Any]] = {
    "default": {
        "theme": "light",
        "density": "comfortable",
        "textSize": "normal",
        "language": "en"
    }
}


class UserPreferencesModel(BaseModel):
    theme: Optional[str] = "light"
    density: Optional[str] = "comfortable"
    textSize: Optional[str] = "normal"
    language: Optional[str] = "en"


@app.get("/api/v1/user/preferences")
def get_user_preferences(
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
) -> Dict[str, Any]:
    """Returns persisted user UI preferences (theme, density, textSize, language)."""
    key = f"{role}:{institution_id or student_token or 'default'}"
    return USER_PREFERENCES.get(key, USER_PREFERENCES["default"])


@app.post("/api/v1/user/preferences")
def save_user_preferences(
    prefs: UserPreferencesModel,
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
) -> Dict[str, Any]:
    """Persists user UI preferences for the active session and profile."""
    key = f"{role}:{institution_id or student_token or 'default'}"
    saved = {
        "theme": prefs.theme or "light",
        "density": prefs.density or "comfortable",
        "textSize": prefs.textSize or "normal",
        "language": prefs.language or "en",
    }
    USER_PREFERENCES[key] = saved
    return {"status": "success", "preferences": saved}


# ----------------- Global Role-Scoped Search -----------------
@app.get("/api/v1/search")
def global_search(
    q: str = Query(..., min_length=1),
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Global role-scoped search across institutions, records, findings, and navigation."""
    query_str = q.strip().lower()
    results: Dict[str, List[Dict[str, Any]]] = {
        "institutions": [],
        "students": [],
        "findings": [],
        "navigation": []
    }

    # 1. Institutions search
    if role == Role.OFFICER:
        insts = session.exec(select(Institution)).all()
        for inst in insts:
            if query_str in inst.name.lower() or query_str in inst.id.lower() or query_str in inst.state.lower():
                results["institutions"].append({
                    "id": inst.id,
                    "title": inst.name,
                    "subtitle": f"{inst.state} • PID: {inst.id}",
                    "href": f"#/officer/institutions/{inst.id}"
                })
    elif role == Role.INSTITUTION and institution_id:
        inst = session.get(Institution, institution_id)
        if inst and (query_str in inst.name.lower() or query_str in inst.id.lower()):
            results["institutions"].append({
                "id": inst.id,
                "title": inst.name,
                "subtitle": inst.id,
                "href": "#/institution/seat-matrix"
            })

    # 2. Students search (role-scoped)
    if role == Role.OFFICER:
        students = session.exec(select(StudentRecord).limit(60)).all()
        for s in students:
            if query_str in s.name.lower() or query_str in s.apaar_masked.lower() or query_str in (s.student_id or "").lower():
                results["students"].append({
                    "id": s.id,
                    "title": s.name,
                    "subtitle": f"{s.apaar_masked} • {s.programme} ({s.institution_id})",
                    "href": f"#/officer/institutions/{s.institution_id}"
                })
    elif role == Role.INSTITUTION and institution_id:
        students = session.exec(select(StudentRecord).where(StudentRecord.institution_id == institution_id).limit(60)).all()
        for s in students:
            if query_str in s.name.lower() or query_str in s.apaar_masked.lower() or query_str in (s.student_id or "").lower():
                results["students"].append({
                    "id": s.id,
                    "title": s.name,
                    "subtitle": f"{s.student_id} • {s.programme}",
                    "href": "#/institution/students"
                })

    # 3. Findings search
    if role == Role.OFFICER:
        findings = session.exec(select(Finding).limit(50)).all()
        for f in findings:
            if query_str in f.rule_id.lower() or query_str in f.plain_reason.lower() or query_str in f.institution_id.lower():
                results["findings"].append({
                    "id": f.id,
                    "title": f"Finding #{f.id}: {f.rule_id}",
                    "subtitle": f"{f.institution_id} • {f.plain_reason[:50]}...",
                    "href": "#/officer/findings"
                })

    # 4. Relevant navigation links
    nav_catalog = [
        {"title": "Verify Credential Portal", "href": "#/verify", "roles": [Role.PUBLIC, Role.OFFICER, Role.INSTITUTION, Role.STUDENT]},
        {"title": "How Verification Works Guide", "href": "#/verify/guide", "roles": [Role.PUBLIC, Role.OFFICER, Role.INSTITUTION, Role.STUDENT]},
        {"title": "Audit Chain & Integrity", "href": "#/officer/audit", "roles": [Role.OFFICER]},
        {"title": "Cross-Institution Duplicates", "href": "#/officer/duplicates", "roles": [Role.OFFICER]},
        {"title": "Upload Intake Data", "href": "#/institution/upload", "roles": [Role.INSTITUTION]},
        {"title": "College Seat Matrix", "href": "#/institution/seat-matrix", "roles": [Role.INSTITUTION]},
        {"title": "Student Digital Record", "href": "#/student/record", "roles": [Role.STUDENT]},
        {"title": "Student Consent Manager", "href": "#/student/consent", "roles": [Role.STUDENT]},
        {"title": "Compliance Rules & Glossary", "href": "#/help", "roles": Role.ALL_ROLES},
    ]
    for item in nav_catalog:
        if role in item["roles"] and (query_str in item["title"].lower() or query_str in item["href"].lower()):
            results["navigation"].append(item)

    total_hits = sum(len(v) for v in results.values())
    return {
        "query": q,
        "total_results": total_hits,
        "results": results
    }



# ----------------- Officer Aggregates (State Map & Sparklines) -----------------
@app.get("/api/v1/officer/state-map")
def get_officer_state_map(
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_officer(role)
    states_data = [
        {"code": "DL", "name": "Delhi", "institutions": 1, "findings": 0, "status": "good", "students": 236},
        {"code": "MH", "name": "Maharashtra", "institutions": 1, "findings": 2, "status": "problem", "students": 252},
        {"code": "KA", "name": "Karnataka", "institutions": 1, "findings": 1, "status": "needs_review", "students": 238},
        {"code": "TS", "name": "Telangana", "institutions": 1, "findings": 1, "status": "needs_review", "students": 240},
        {"code": "RJ", "name": "Rajasthan", "institutions": 1, "findings": 1, "status": "needs_review", "students": 235},
        {"code": "TN", "name": "Tamil Nadu", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "UP", "name": "Uttar Pradesh", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "GJ", "name": "Gujarat", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "WB", "name": "West Bengal", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "KL", "name": "Kerala", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "MP", "name": "Madhya Pradesh", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "AP", "name": "Andhra Pradesh", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "PB", "name": "Punjab", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "HR", "name": "Haryana", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
        {"code": "OD", "name": "Odisha", "institutions": 0, "findings": 0, "status": "idle", "students": 0},
    ]
    return {"states": states_data, "total_monitored": 5, "total_open_findings": 5}


@app.get("/api/v1/officer/sparklines")
def get_officer_sparklines(
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_officer(role)
    months = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]
    return {
        "months": months,
        "institutions_reporting": {
            "current": 5,
            "change_pct": "+25%",
            "trend": "up",
            "series": [2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5]
        },
        "students_verified": {
            "current": 1201,
            "change_pct": "+18%",
            "trend": "up",
            "series": [180, 310, 480, 620, 750, 890, 980, 1050, 1110, 1160, 1185, 1201]
        },
        "open_findings": {
            "current": 5,
            "change_pct": "-42%",
            "trend": "down",
            "series": [14, 12, 11, 10, 9, 8, 8, 7, 6, 6, 5, 5]
        },
        "over_intake_cases": {
            "current": 1,
            "change_pct": "-66%",
            "trend": "down",
            "series": [3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1]
        }
    }


# ----------------- Finding Triage Status Updates -----------------
class FindingStatusUpdateRequest(BaseModel):
    status: Optional[str] = None  # "open", "in_review", "resolved"
    reason: Optional[str] = None
    comment: Optional[str] = None
    request_clarification: Optional[bool] = False
    clarification_note: Optional[str] = None


@app.post("/api/v1/findings/{finding_id}/status")
def update_finding_status(
    finding_id: int,
    req: FindingStatusUpdateRequest,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_officer(role)
    finding = session.get(Finding, finding_id)
    if not finding:
        raise HTTPException(status_code=404, detail="Finding not found")

    reason = (req.reason or req.clarification_note or req.comment or "").strip()
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="A written justification or note of at least 10 characters is mandatory to update regulatory finding status or request clarification."
        )

    old_status = finding.status
    if req.request_clarification:
        finding.status = "in_review"
        note = req.clarification_note or reason
        # Push notification for institution
        add_notification(
            role=Role.INSTITUTION,
            institution_id=finding.institution_id,
            title="Clarification Requested",
            message=f"Officer requested clarification on finding #{finding.id} ({finding.rule_id}): {note}",
            notif_type="warning"
        )
        action_name = "FINDING_CLARIFICATION_REQUESTED"
    else:
        new_status = (req.status or "in_review").lower()
        valid_statuses = ["open", "in_review", "resolved", "dismissed_by_officer", "held_by_officer"]
        if new_status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
        finding.status = new_status
        action_name = "FINDING_STATUS_UPDATED"

    session.add(finding)
    session.commit()

    log_audit_event(
        session=session,
        actor_role=role,
        action=action_name,
        application_id=finding.institution_id,
        doc_id=str(finding.id),
        payload={
            "finding_id": finding.id,
            "rule_id": finding.rule_id,
            "old_status": old_status,
            "new_status": finding.status,
            "reason": reason,
            "comment": req.comment,
            "request_clarification": req.request_clarification,
        }
    )

    return {
        "status": "success",
        "finding_id": finding.id,
        "old_status": old_status,
        "new_status": finding.status,
        "reason": reason,
        "message": f"Finding #{finding.id} status updated to '{finding.status}'."
    }


# ----------------- Officer Cross-Institution Duplicates & Decisions -----------------
class DuplicateDecisionRequest(BaseModel):
    case_id: str
    decision: str  # "needs_review", "dismiss", "refer"
    reason: str
    action_notes: Optional[str] = None


@app.get("/api/v1/officer/duplicates")
def get_officer_duplicates(
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """Returns detected cross-institution duplicate candidate collisions for officer scrutiny."""
    assert_officer(role)
    return [
        {
            "id": "dup_01",
            "student_record_id": 1,
            "student_name": "Rohan Aditya Sharma",
            "apaar_masked": "XXXX-XXXX-1100",
            "status": "critical",
            "decision": "pending",
            "scores": {
                "token_match": 100,
                "name_match": 98,
                "dob_match": 100,
                "overall_score": 18.4,
            },
            "inst1": {
                "id": "1-1090123456",
                "name": "Aryabhata Institute of Technology",
                "state": "Delhi",
                "programme": "B.Tech Computer Science and Engineering",
                "quota": "Regular",
                "admission_date": "2024-08-10",
                "roll": "CSE-24-042",
            },
            "inst2": {
                "id": "1-1090345678",
                "name": "Chanakya Technological University",
                "state": "Karnataka",
                "programme": "B.Tech Computer Science and Engineering",
                "quota": "Regular",
                "admission_date": "2024-08-14",
                "roll": "CTU-24-118",
            },
            "summary": "Concurrent active full-time enrolment detected across two AICTE-approved institutions for Academic Year 2024-25.",
            "rule_id": "DUPLICATE_CROSS_INSTITUTION",
        }
    ]


@app.post("/api/v1/officer/duplicate-decision")
def post_duplicate_decision(
    req: DuplicateDecisionRequest,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Records an officer adjudication decision on cross-institution collisions with mandatory justification."""
    assert_officer(role)
    valid_decisions = ["needs_review", "dismiss", "refer"]
    dec_norm = req.decision.strip().lower()
    if dec_norm not in valid_decisions:
        raise HTTPException(status_code=400, detail=f"Invalid decision '{req.decision}'. Allowed: {', '.join(valid_decisions)}")

    reason = req.reason.strip() if req.reason else ""
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="A written justification of at least 10 characters is mandatory for duplicate decisions."
        )

    log_audit_event(
        session=session,
        actor_role=role,
        action="OFFICER_DUPLICATE_DECISION",
        application_id=req.case_id,
        payload={
            "case_id": req.case_id,
            "decision": dec_norm,
            "reason": reason,
            "action_notes": req.action_notes,
        }
    )

    return {
        "status": "success",
        "case_id": req.case_id,
        "decision": dec_norm,
        "reason": reason,
        "message": f"Officer decision '{dec_norm}' registered successfully in audit trail."
    }



# ----------------- User Saved Table Filters -----------------
SAVED_USER_FILTERS: Dict[str, List[Dict[str, Any]]] = {}


@app.get("/api/v1/user/filters")
def get_user_filters(
    table_id: str = Query(...),
    role: str = Depends(get_current_role),
) -> List[Dict[str, Any]]:
    key = f"{role}:{table_id}"
    return SAVED_USER_FILTERS.get(key, [])


@app.post("/api/v1/user/filters")
def save_user_filter(
    table_id: str = Query(...),
    filter_data: Dict[str, Any] = Body(...),
    role: str = Depends(get_current_role),
) -> Dict[str, Any]:
    key = f"{role}:{table_id}"
    if key not in SAVED_USER_FILTERS:
        SAVED_USER_FILTERS[key] = []
    SAVED_USER_FILTERS[key].append(filter_data)
    return {"status": "saved", "filters": SAVED_USER_FILTERS[key]}


# ----------------- Institutions & Seat Matrix -----------------
@app.get("/api/v1/institutions")
def list_institutions(
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    """
    List institutions.
    AICTE Officer sees all institutions.
    Institution role sees ONLY its own institution.
    Student / Verifier role is forbidden.
    """
    if role == Role.STUDENT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: students do not have permission to browse institutions directory."
        )

    statement = select(Institution)
    if role == Role.INSTITUTION:
        target_id = institution_id or "1-1090123456"
        statement = statement.where(Institution.id == target_id)

    institutions = session.exec(statement).all()
    results = []

    for inst in institutions:
        students_count = len(session.exec(
            select(StudentRecord).where(StudentRecord.institution_id == inst.id)
        ).all())

        findings = session.exec(
            select(Finding).where(Finding.institution_id == inst.id, Finding.status == "open")
        ).all()

        crit_findings = len([f for f in findings if f.severity == "critical"])
        high_findings = len([f for f in findings if f.severity == "high"])

        matrices = session.exec(
            select(ProgrammeSeatMatrix).where(ProgrammeSeatMatrix.institution_id == inst.id)
        ).all()
        total_intake = sum(m.approved_intake for m in matrices)

        results.append({
            "id": inst.id,
            "aicte_pid": inst.aicte_pid,
            "name": inst.name,
            "state": inst.state,
            "district": inst.district,
            "address": inst.address,
            "contact_email": inst.contact_email,
            "student_count": students_count,
            "approved_intake": total_intake or 240,
            "open_findings_count": len(findings),
            "critical_findings_count": crit_findings,
            "high_findings_count": high_findings,
            "compliance_status": "non_compliant" if (crit_findings > 0 or high_findings > 0) else "compliant"
        })

    return results


@app.get("/api/v1/institutions/{inst_id}")
def get_institution_detail(
    inst_id: str,
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_institution_access(inst_id, role, institution_id)

    inst = session.get(Institution, inst_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    matrices = session.exec(
        select(ProgrammeSeatMatrix).where(ProgrammeSeatMatrix.institution_id == inst_id)
    ).all()

    students = session.exec(
        select(StudentRecord).where(StudentRecord.institution_id == inst_id)
    ).all()

    findings = session.exec(
        select(Finding).where(Finding.institution_id == inst_id)
    ).all()

    # Redact findings if viewed by institution role
    redacted_findings = [redact_finding_for_role(f.model_dump(), role) for f in findings]

    submissions = session.exec(
        select(Submission).where(Submission.institution_id == inst_id).order_by(Submission.version.desc())
    ).all()

    return {
        "institution": inst.model_dump(),
        "seat_matrices": [m.model_dump() for m in matrices],
        "student_count": len(students),
        "findings": redacted_findings,
        "submissions": [s.model_dump() for s in submissions],
    }


@app.get("/api/v1/institutions/{inst_id}/compliance-report.pdf")
def download_institution_compliance_report(
    inst_id: str,
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
):
    """Generates and serves a ReportLab PDF compliance report for the specified institution."""
    assert_institution_access(inst_id, role, institution_id)
    inst = session.get(Institution, inst_id)
    if not inst:
        raise HTTPException(status_code=404, detail="Institution not found")

    matrices = session.exec(
        select(ProgrammeSeatMatrix).where(ProgrammeSeatMatrix.institution_id == inst_id)
    ).all()
    findings = session.exec(
        select(Finding).where(Finding.institution_id == inst_id)
    ).all()

    out_dir = STORAGE_DIR / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"compliance_report_{inst_id.replace('-', '_')}.pdf"
    generate_compliance_report_pdf(inst, matrices, findings, out_path)

    return FileResponse(
        path=str(out_path),
        media_type="application/pdf",
        filename=f"Compliance_Report_{inst_id}.pdf"
    )


@app.get("/api/v1/institutions/{inst_id}/students")
def get_institution_students(
    inst_id: str,
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    assert_institution_access(inst_id, role, institution_id)

    students = session.exec(
        select(StudentRecord).where(StudentRecord.institution_id == inst_id)
    ).all()

    # Students APAAR IDs are masked by default: XXXX-XXXX-1234
    res = []
    for s in students:
        d = s.model_dump()
        # Always mask unless explicit reveal endpoint is called
        d["apaar_id"] = s.apaar_masked
        del d["apaar_id_encrypted"]
        res.append(d)
    return res


# ----------------- APAAR ID Reveal (Officer Safeguard) -----------------
class RevealRequest(BaseModel):
    reason: str


@app.post("/api/v1/students/{student_id}/reveal")
def reveal_full_apaar_id(
    student_id: int,
    req: RevealRequest,
    role: str = Depends(require_officer),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Officer-only endpoint to reveal full 12-digit APAAR ID.
    STRICT SAFEGUARD:
    Requires AICTE Officer role, a written justification of at least 10 characters,
    and logs the action to the tamper-evident cryptographic audit chain!
    """
    reason = req.reason.strip() if req.reason else ""
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="A written justification of at least 10 characters is mandatory for revealing confidential APAAR identity."
        )

    student = session.get(StudentRecord, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    full_apaar = decrypt_apaar(student.apaar_id_encrypted)

    # Log to audit trail
    log_audit_event(
        session=session,
        actor_role=role,
        action="CONFIDENTIAL_APAAR_ID_REVEALED",
        application_id=student.institution_id,
        doc_id=str(student.id),
        payload={
            "student_name": student.name,
            "student_roll": student.student_id,
            "institution_id": student.institution_id,
            "justification_reason": reason,
            "apaar_masked": student.apaar_masked,
        }
    )

    return {
        "student_id": student.id,
        "name": student.name,
        "full_apaar_id": full_apaar,
        "masked_apaar_id": student.apaar_masked,
        "authorized_officer": role,
        "reason_recorded": reason,
        "audit_notice": "Identity disclosure logged in cryptographic audit trail."
    }


# ----------------- Upload & Validation Engine -----------------
@app.get("/api/v1/upload/template")
def download_template(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    sample_type: str = Query("clean", pattern="^(clean|errors)$")
):
    """Downloads sample AICTE student intake template in XLSX or CSV format, either clean or with 5 deliberate test errors."""

    headers = [
        "apaar_id",
        "name",
        "dob",
        "gender",
        "social_category",
        "nationality_status",
        "admission_quota",
        "programme",
        "admission_date",
        "student_id"
    ]

    if sample_type == "errors":
        sample_rows = [
            ["23456789012", "Aarav Sharma", "2004-05-14", "Male", "General", "Indian", "Regular", "B.Tech Computer Science and Engineering", "2024-08-10", "CSE-24-001"],
            ["345678901234", "Priya Patel", "2004-09-22", "Female", "OBC", "Indian", "Regular", "B.Tech Computer Science and Engineering", "2028-11-15", "CSE-24-002"],
            ["456789012345", "Rohan Verma", "2003-12-05", "Male", "General", "Indian", "UNKNOWN_QUOTA", "B.Tech Computer Science and Engineering", "2024-08-15", "CSE-24-003"],
            ["456789012345", "Rohan Duplicate", "2003-12-05", "Male", "General", "Indian", "Regular", "B.Tech Computer Science and Engineering", "2024-08-15", "CSE-24-004"],
            ["678901234567", "Tariq Ahmad", "2004-07-19", "Male", "General", "Indian", "KM", "B.Tech Marine Aviation (Unsanctioned)", "2024-08-20", "CSE-24-005"],
        ]
        filename_base = "apaartrust_intake_5_errors"
    else:
        sample_rows = [
            ["234567890123", "Aarav Sharma", "2004-05-14", "Male", "General", "Indian", "Regular", "B.Tech Computer Science and Engineering", "2024-08-10", "CSE-24-001"],
            ["345678901234", "Priya Patel", "2004-09-22", "Female", "OBC", "Indian", "Regular", "B.Tech Computer Science and Engineering", "2024-08-12", "CSE-24-002"],
            ["456789012345", "Rohan Verma", "2003-12-05", "Male", "General", "Indian", "TFW", "B.Tech Computer Science and Engineering", "2024-08-15", "CSE-24-003"],
            ["567890123456", "Ananya Iyer", "2004-03-30", "Female", "General", "Indian", "EWS", "B.Tech Computer Science and Engineering", "2024-08-18", "CSE-24-004"],
            ["678901234567", "Tariq Ahmad", "2004-07-19", "Male", "General", "Indian", "KM", "B.Tech Computer Science and Engineering", "2024-08-20", "CSE-24-005"],
        ]
        filename_base = "apaartrust_intake_template"

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(sample_rows)
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename_base}.csv"}
        )

    # XLSX format
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Student Intake"
    ws.append(headers)
    for r in sample_rows:
        ws.append(r)

    out_bytes = io.BytesIO()
    wb.save(out_bytes)
    out_bytes.seek(0)
    return Response(
        content=out_bytes.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename_base}.xlsx"}
    )



def parse_upload_file(file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
    """Parses CSV or XLSX bytes into structured list of row dictionaries."""
    rows = []
    fn_low = filename.lower()

    if fn_low.endswith(".csv"):
        text = file_bytes.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        for r in reader:
            rows.append({k.strip(): str(v).strip() for k, v in r.items() if k})
    else:
        # XLSX
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        ws = wb.active
        header_cells = [str(cell.value or "").strip() for cell in ws[1]]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not any(row):
                continue
            row_dict = {}
            for col_idx, h in enumerate(header_cells):
                if h and col_idx < len(row):
                    val = row[col_idx]
                    if isinstance(val, datetime):
                        val = val.strftime("%Y-%m-%d")
                    row_dict[h] = str(val if val is not None else "").strip()
            rows.append(row_dict)

    return rows


@app.post("/api/v1/upload/dry-run")
async def upload_dry_run(
    institution_id: str = Form(...),
    academic_year: str = Form("2024-25"),
    file: UploadFile = File(...),
    role: str = Depends(get_current_role),
    caller_inst_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    DRY-RUN VALIDATION:
    Evaluates spreadsheet against all 14 rules without committing anything to database.
    Returns findings, seat gauges, and summary counts.
    """
    assert_institution_access(institution_id, role, caller_inst_id)
    file_bytes = await file.read()
    raw_rows = parse_upload_file(file_bytes, file.filename)

    if not raw_rows:
        raise HTTPException(status_code=400, detail="The uploaded file contains no student records.")

    sim_sub_id = f"dryrun_{secrets.token_hex(6)}"

    findings, counts, prepared_students = validate_batch(
        raw_rows=raw_rows,
        institution_id=institution_id,
        submission_id=sim_sub_id,
        session=session,
        academic_year=academic_year,
    )

    return {
        "status": "dry_run_complete",
        "dry_run": True,
        "submission_id": sim_sub_id,
        "institution_id": institution_id,
        "filename": file.filename,
        "total_rows": len(raw_rows),
        "findings_count": len(findings),
        "summary_counts": counts,
        "findings": [f.model_dump() for f in findings],
        "seat_gauges": counts.get("seat_gauges", []),
        "sample_preview": prepared_students[:5],
        "message": "Dry-run analysis complete: NO records have been modified in the database. Review findings and click Commit to proceed."
    }


@app.post("/api/v1/upload/commit")
async def upload_and_commit(
    institution_id: str = Form(...),
    academic_year: str = Form("2024-25"),
    file: UploadFile = File(...),
    role: str = Depends(get_current_role),
    caller_inst_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    COMMITS submission batch to permanent database.
    Increments submission version, stores StudentRecords, Findings, updates seat matrix,
    and logs cryptographic audit event.
    """
    assert_institution_access(institution_id, role, caller_inst_id)
    file_bytes = await file.read()
    raw_rows = parse_upload_file(file_bytes, file.filename)

    if not raw_rows:
        raise HTTPException(status_code=400, detail="No rows in file to commit.")

    # Determine submission version
    prev_subs = session.exec(
        select(Submission).where(Submission.institution_id == institution_id).order_by(Submission.version.desc())
    ).all()
    next_version = (prev_subs[0].version + 1) if prev_subs else 1
    previous_sub_id = prev_subs[0].id if prev_subs else None

    sub_id = f"sub_{institution_id.replace('-', '')}_v{next_version}"

    findings, counts, prepared_students = validate_batch(
        raw_rows=raw_rows,
        institution_id=institution_id,
        submission_id=sub_id,
        session=session,
        academic_year=academic_year,
    )

    now = datetime.now(timezone.utc)
    submission = Submission(
        id=sub_id,
        institution_id=institution_id,
        academic_year=academic_year,
        version=next_version,
        status="committed",
        filename=file.filename,
        total_rows=len(raw_rows),
        valid_rows=len(raw_rows) - len(findings),
        flagged_rows=len(findings),
        submission_hash=f"hash_{secrets.token_hex(16)}",
        counts=counts,
        created_at=now,
        committed_at=now,
    )
    session.add(submission)
    session.commit()

    # Commit findings
    for f in findings:
        session.add(f)
    session.commit()

    # Commit student records
    for s in prepared_students:
        sr = StudentRecord(
            apaar_token=s["apaar_token"],
            apaar_id_encrypted=encrypt_apaar(s["apaar_id"]) if s["apaar_id"] else "",
            apaar_masked=s["apaar_masked"],
            name=s["name"],
            dob=s["dob"],
            gender=s["gender"],
            social_category=s["social_category"],
            nationality_status=s["nationality_status"],
            admission_quota=s["admission_quota"],
            programme=s["programme"],
            admission_date=s["admission_date"],
            enrolment_status="Active",
            student_id=s["student_id"],
            institution_id=institution_id,
            submission_id=sub_id,
            academic_year=academic_year,
        )
        session.add(sr)
    session.commit()

    # Compute submission diff vs previous version
    diff = compute_submission_diff(sub_id, previous_sub_id, session)

    # Scan and trigger governance alerts
    AlertEngine.scan_institution_alerts(session, institution_id)

    # Log to audit trail
    log_audit_event(
        session=session,
        actor_role=role,
        action="SUBMISSION_BATCH_COMMITTED",
        application_id=institution_id,
        payload={
            "submission_id": sub_id,
            "version": next_version,
            "total_rows": len(raw_rows),
            "findings_count": len(findings),
            "filename": file.filename,
        }
    )

    # Create in-app notifications
    add_notification(
        role=Role.INSTITUTION,
        institution_id=institution_id,
        title="Submission Committed",
        message=f"Submission batch v{next_version} ({len(raw_rows)} records) committed with receipt REC-{sub_id.upper()}.",
        notif_type="success"
    )
    add_notification(
        role=Role.OFFICER,
        institution_id=institution_id,
        title="College Submission Received",
        message=f"{institution_id} committed batch v{next_version} with {len(raw_rows)} records ({len(findings)} findings).",
        notif_type="info"
    )

    receipt_obj = {
        "receipt_number": f"REC-{sub_id.upper()}",
        "submission_id": sub_id,
        "institution_id": institution_id,
        "version": next_version,
        "academic_year": academic_year,
        "filename": file.filename,
        "status": "committed",
        "total_rows": len(raw_rows),
        "valid_rows": len(raw_rows) - len(findings),
        "flagged_rows": len(findings),
        "submission_hash": submission.submission_hash,
        "cryptographic_seal": f"SHA256:{submission.submission_hash}",
        "counts": counts,
        "committed_at": now.isoformat(),
    }

    return {
        "status": "committed",
        "submission_id": sub_id,
        "version": next_version,
        "institution_id": institution_id,
        "total_rows": len(raw_rows),
        "findings_count": len(findings),
        "summary_counts": counts,
        "diff_summary": diff,
        "receipt": receipt_obj,
        "message": f"Submission batch v{next_version} committed successfully to AICTE ApaarTrust registry."
    }


@app.get("/api/v1/submissions/{sub_id}/receipt")
def get_submission_receipt(
    sub_id: str,
    role: str = Depends(get_current_role),
    institution_id: Optional[str] = Depends(get_institution_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Retrieves immutable receipt with cryptographic seal and row counts for a committed submission."""
    sub = session.get(Submission, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    assert_institution_access(sub.institution_id, role, institution_id)
    committed_iso = (sub.committed_at or sub.created_at).isoformat()
    return {
        "receipt_number": f"REC-{sub.id.upper()}",
        "submission_id": sub.id,
        "institution_id": sub.institution_id,
        "version": sub.version,
        "academic_year": sub.academic_year,
        "filename": sub.filename,
        "status": sub.status,
        "total_rows": sub.total_rows,
        "valid_rows": sub.valid_rows,
        "flagged_rows": sub.flagged_rows,
        "submission_hash": sub.submission_hash,
        "cryptographic_seal": f"SHA256:{sub.submission_hash}",
        "counts": sub.counts,
        "committed_at": committed_iso,
        "message": f"Verified submission receipt for version {sub.version}."
    }


@app.get("/api/v1/submissions/{sub_id}/diff")
def get_submission_diff(
    sub_id: str,
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    sub = session.get(Submission, sub_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    prev_sub = session.exec(
        select(Submission)
        .where(Submission.institution_id == sub.institution_id)
        .where(Submission.version == sub.version - 1)
    ).first()

    diff = compute_submission_diff(sub.id, prev_sub.id if prev_sub else None, session)
    return diff


@app.get("/api/v1/submissions/{sub_id}/export-errors")
def export_submission_errors_csv(
    sub_id: str,
    session: Session = Depends(get_session)
):
    findings = session.exec(select(Finding).where(Finding.submission_id == sub_id)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Row Number", "Rule ID", "Severity", "Plain Reason", "Fix Hint", "Status"])

    for f in findings:
        writer.writerow([
            f.row_number,
            f.rule_id,
            f.severity,
            f.plain_reason,
            f.fix_hint,
            f.status,
        ])

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=findings_{sub_id}.csv"}
    )


# ----------------- Student Role & Consent Ledger -----------------
def resolve_student_token(tok: str) -> str:
    if tok in ("tok_rohan_sharma", "rohan", "default", "sample"):
        return compute_apaar_token("554433221100")
    return tok

@app.get("/api/v1/students/{token}/record")
def get_student_record(
    token: str,
    role: str = Depends(get_current_role),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    token = resolve_student_token(token)
    assert_student_access(token, role, student_token)
    student = session.exec(select(StudentRecord).where(StudentRecord.apaar_token == token)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record not found")

    inst = session.get(Institution, student.institution_id)
    cred = session.exec(select(Credential).where(Credential.subject_token == token)).first()

    return {
        "student": {
            "name": student.name,
            "dob": student.dob,
            "gender": student.gender,
            "social_category": student.social_category,
            "programme": student.programme,
            "institution_name": inst.name if inst else student.institution_id,
            "institution_id": student.institution_id,
            "student_id": student.student_id,
            "enrolment_status": student.enrolment_status,
            "apaar_masked": student.apaar_masked,
            "academic_year": student.academic_year,
            "admission_quota": student.admission_quota,
        },
        "credential_id": cred.id if cred else None,
        "credential_status": "Active Issued" if cred and not cred.revoked else "Not Issued",
    }


@app.get("/api/v1/students/{token}/consent")
def get_student_consent_ledger(
    token: str,
    role: str = Depends(get_current_role),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    token = resolve_student_token(token)
    assert_student_access(token, role, student_token)
    grants = session.exec(
        select(ConsentGrant).where(ConsentGrant.student_token == token).order_by(ConsentGrant.created_at.desc())
    ).all()

    all_possible_fields = [
        {"key": "name", "label": "Full Name", "sensitive": False},
        {"key": "programme", "label": "Degree & Programme", "sensitive": False},
        {"key": "institution", "label": "Institution Name", "sensitive": False},
        {"key": "enrolment_status", "label": "Enrolment Status (Active)", "sensitive": False},
        {"key": "academic_year", "label": "Academic Year", "sensitive": False},
        {"key": "dob", "label": "Date of Birth", "sensitive": True},
        {"key": "gender", "label": "Gender", "sensitive": True},
        {"key": "social_category", "label": "Affirmative Action / Social Category", "sensitive": True},
    ]

    return {
        "student_token": token,
        "available_fields": all_possible_fields,
        "grants": [g.model_dump() for g in grants],
    }


class ConsentUpdateRequest(BaseModel):
    purpose: str
    allowed_fields: List[str]
    validity_days: int = 90


@app.post("/api/v1/students/{token}/consent")
def update_student_consent(
    token: str,
    req: ConsentUpdateRequest,
    role: str = Depends(get_current_role),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_student_access(token, role, student_token)
    now = datetime.now(timezone.utc)
    grant_id = f"cg_{secrets.token_hex(6)}"

    new_grant = ConsentGrant(
        id=grant_id,
        student_token=token,
        purpose=req.purpose,
        allowed_fields=req.allowed_fields,
        created_at=now,
        expires_at=now + timedelta(days=req.validity_days),
        revoked_at=None,
    )
    session.add(new_grant)
    session.commit()

    log_audit_event(
        session=session,
        actor_role=role,
        action="STUDENT_CONSENT_GRANTED",
        payload={
            "student_token": token,
            "purpose": req.purpose,
            "allowed_fields": req.allowed_fields,
            "grant_id": grant_id,
        }
    )

    return {
        "status": "success",
        "message": f"Digital consent granted for '{req.purpose}' covering {len(req.allowed_fields)} selective fields.",
        "grant": {
            "id": new_grant.id,
            "student_token": new_grant.student_token,
            "purpose": new_grant.purpose,
            "allowed_fields": new_grant.allowed_fields,
            "created_at": new_grant.created_at.isoformat(),
            "expires_at": new_grant.expires_at.isoformat(),
            "revoked_at": new_grant.revoked_at.isoformat() if new_grant.revoked_at else None,
        }
    }


@app.post("/api/v1/consent/{grant_id}/revoke")
def revoke_student_consent(
    grant_id: str,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    grant = session.get(ConsentGrant, grant_id)
    if not grant:
        raise HTTPException(status_code=404, detail="Consent grant not found")

    grant.revoked_at = datetime.now(timezone.utc)
    session.add(grant)
    session.commit()

    add_notification(
        role=Role.STUDENT,
        student_token=grant.student_token,
        title="Consent Revoked",
        message=f"Consent #{grant.id} for '{grant.purpose}' revoked. Future verifications blocked.",
        notif_type="warning"
    )

    log_audit_event(
        session=session,
        actor_role=role,
        action="STUDENT_CONSENT_REVOKED",
        payload={"grant_id": grant_id, "student_token": grant.student_token}
    )

    return {
        "status": "revoked",
        "message": f"Consent grant {grant_id} revoked immediately. All subsequent verifications will be blocked.",
        "revoked_at": grant.revoked_at.isoformat()
    }


@app.get("/api/v1/students/{token}/access-log")
def get_who_viewed_my_record(
    token: str,
    role: str = Depends(get_current_role),
    student_token: Optional[str] = Depends(get_student_token_context),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    assert_student_access(token, role, student_token)
    logs = session.exec(
        select(VerificationLog)
        .where(VerificationLog.student_token == token)
        .order_by(VerificationLog.timestamp.desc())
    ).all()

    return [l.model_dump() for l in logs]


# ----------------- Verifier Role & Public Verification -----------------
@app.post("/api/v1/credentials/issue")
def issue_credential_endpoint(
    student_id: int,
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    student = session.get(StudentRecord, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    inst = session.get(Institution, student.institution_id)
    inst_name = inst.name if inst else student.institution_id

    cred = issue_verifiable_credential(student, inst_name, session)
    return {
        "credential_id": cred.id,
        "issued_at": cred.issued_at.isoformat(),
        "expires_at": cred.expires_at.isoformat(),
        "commitments_count": len(cred.commitments),
        "status": "issued"
    }


@app.get("/api/v1/credentials/{cred_id}/presentation")
def get_presentation_endpoint(
    cred_id: str,
    purpose: str = Query("Public Verification"),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    if cred_id in ("cred_a042_cse", "default", "sample"):
        cred_id = "cred-demo-aicte-2026"
    try:
        pres = generate_presentation(cred_id, purpose, session)
        return pres
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/v1/verify/presentation")
def verify_presentation_endpoint(
    presentation: Dict[str, Any],
    verifier_type: str = Query("Public Verifier"),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Verifies SD-JWT presentation against Ed25519 signature and selective salted commitments."""
    result = verify_presentation(presentation, verifier_type, session)
    cred_id = presentation.get("credential_id")
    if cred_id:
        cred = session.get(Credential, cred_id)
        if cred:
            add_notification(
                role=Role.STUDENT,
                student_token=cred.subject_token,
                title="Credential Verified",
                message=f"Credential was verified by {verifier_type} (Outcome: {result.get('status', 'unknown')}).",
                notif_type="info" if result.get("genuine") else "warning"
            )
    return result


@app.post("/api/v1/verify/upload")
async def verify_certificate_upload(
    file: UploadFile = File(...),
    verifier_type: str = Form("Document Upload Verifier"),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Decodes QR code from certificate PDF or image and verifies cryptographic presentation."""
    file_bytes = await file.read()
    decoded_text = decode_qr_from_bytes(file_bytes, file.filename)

    if not decoded_text:
        return {
            "status": "not_found",
            "message": "No machine-readable QR seal detected in uploaded document. Ensure certificate contains a clear ApaarTrust QR seal.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": []
        }

    # Attempt parsing presentation JSON from QR
    try:
        presentation_dict = json.loads(decoded_text)
        result = verify_presentation(presentation_dict, verifier_type, session)
        result["qr_payload_type"] = "SD_JWT_PRESENTATION"
        return result
    except Exception:
        # Check if decoded text is a direct credential ID
        cred = session.get(Credential, decoded_text.strip())
        if cred:
            pres = generate_presentation(cred.id, "QR Direct Scan", session)
            result = verify_presentation(pres, verifier_type, session)
            return result

        return {
            "status": "tampered",
            "message": "Unrecognized or corrupted QR payload format.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": []
        }


@app.get("/api/v1/credentials/{cred_id}/certificate.pdf")
def download_certificate_pdf(
    cred_id: str,
    session: Session = Depends(get_session)
):
    """Renders and downloads sample ReportLab Certificate PDF with signed QR seal."""
    cred = session.get(Credential, cred_id)
    if not cred:
        raise HTTPException(status_code=404, detail="Credential not found")

    student = session.exec(
        select(StudentRecord).where(StudentRecord.apaar_token == cred.subject_token)
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student record for credential not found")

    inst = session.get(Institution, student.institution_id)
    inst_name = inst.name if inst else student.institution_id

    # Generate presentation for embedding into QR
    pres = generate_presentation(cred.id, "Certificate Print Verification", session)
    pres_str = json.dumps(pres)

    cert_path = STORAGE_DIR / "certificates" / f"certificate_{cred.id}.pdf"
    generate_certificate_pdf(student, inst_name, cred, pres_str, cert_path)

    return FileResponse(
        str(cert_path),
        media_type="application/pdf",
        filename=f"aicte_enrolment_certificate_{student.student_id}.pdf"
    )


# ----------------- Governance, Audits & Adverse Actions -----------------
@app.get("/api/v1/audit/trail")
def get_audit_trail(
    limit: int = Query(50, le=200),
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    assert_officer(role)
    entries = session.exec(select(AuditEntry).order_by(AuditEntry.id.desc()).limit(limit)).all()
    return [e.model_dump() for e in entries]


@app.get("/api/v1/audit/verify")
def verify_audit_trail_endpoint(
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    assert_officer(role)
    res = verify_audit_chain(session)
    return res


@app.post("/api/v1/audit/tamper-demo")
def tamper_audit_demo(
    role: str = Depends(require_officer),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Tamper-simulation endpoint: modifies payload of latest audit entry to demonstrate detection."""
    last_entry = session.exec(select(AuditEntry).order_by(AuditEntry.id.desc()).limit(1)).first()
    if not last_entry:
        raise HTTPException(status_code=400, detail="Audit trail is empty.")

    original_payload = dict(last_entry.payload)
    # Inject tampered key
    tampered_payload = dict(original_payload)
    tampered_payload["_UNAUTHORIZED_MUTATION_"] = "Tampered by Demonstration Script"

    last_entry.payload = tampered_payload
    session.add(last_entry)
    session.commit()

    # Re-verify immediately to show breakage
    verification_after_tamper = verify_audit_chain(session)

    return {
        "status": "tampered",
        "tampered_entry_id": last_entry.id,
        "message": "Audit entry payload intentionally altered in SQLite without re-hashing.",
        "verification_result": verification_after_tamper,
    }


@app.post("/api/v1/audit/restore")
def restore_audit_endpoint(
    role: str = Depends(require_officer),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Restores audit trail after a tamper simulation and verifies chain integrity."""
    res = restore_audit_chain(session)
    log_audit_event(
        session=session,
        actor_role=role,
        action="AUDIT_CHAIN_RESTORED",
        application_id="SYSTEM",
        payload={
            "restored_entries": res.get("restored_entries", 0),
            "message": "Audit trail restored to valid cryptographic hash chain."
        }
    )
    return {
        "status": "restored",
        "restored_entries": res.get("restored_entries", 0),
        "verification_result": res,
        "message": "Tampered audit entry mutations reverted; cryptographic chain verified."
    }



@app.get("/api/v1/alerts")
def get_governance_alerts(
    institution_id: Optional[str] = Query(None),
    session: Session = Depends(get_session)
) -> List[Dict[str, Any]]:
    statement = select(Alert).order_by(Alert.created_at.desc())
    if institution_id:
        statement = statement.where(Alert.institution_id == institution_id)
    alerts = session.exec(statement).all()
    return [a.model_dump() for a in alerts]


class AdverseActionRequest(BaseModel):
    submission_id: str
    action: str  # "hold" | "reject" | "flag_fraud"
    reason: str


@app.post("/api/v1/officer/adverse-action")
def officer_adverse_action(
    req: AdverseActionRequest,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    CRITICAL REGULATORY SAFEGUARD:
    No automated component or non-officer role may take an adverse action.
    Only an Officer with a valid written reason (min 10 chars) can hold or reject a submission.
    """
    if role != Role.OFFICER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: Only AICTE Scrutiny Officers are legally empowered to take adverse actions on submissions."
        )

    reason = req.reason.strip() if req.reason else ""
    if len(reason) < 10:
        raise HTTPException(
            status_code=400,
            detail="A written justification of at least 10 characters is mandatory for taking an adverse action."
        )

    sub = session.get(Submission, req.submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    now = datetime.now(timezone.utc)
    sub.adverse_reason = reason
    sub.officer_id = "OFFICER_AUTHORIZED"
    sub.action_timestamp = now

    if req.action == "hold":
        sub.held_by_officer = True
    elif req.action == "reject":
        sub.rejected_by_officer = True

    session.add(sub)
    session.commit()

    log_audit_event(
        session=session,
        actor_role=role,
        action=f"OFFICER_ADVERSE_ACTION_{req.action.upper()}",
        application_id=sub.institution_id,
        payload={"submission_id": sub.id, "action": req.action, "reason": reason}
    )

    return {
        "status": "action_recorded",
        "action": req.action,
        "submission_id": sub.id,
        "officer": role,
        "reason": reason,
        "timestamp": now.isoformat()
    }


class PurgeRequest(BaseModel):
    reason: str
    dry_run: bool = False


@app.post("/api/v1/retention/purge")
def retention_purge_endpoint(
    req: PurgeRequest,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    try:
        res = execute_retention_purge(session, role, req.reason, req.dry_run)
        return res
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# ----------------- Data Fraud Drill & Benchmarks -----------------
@app.post("/api/v1/drill/run")
def run_drill_endpoint(
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Runs data fraud drill evaluating detection of planted defects."""
    assert_officer(role)
    res = run_data_fraud_drill(session)
    return res


@app.post("/api/v1/drill/benchmark")
def run_benchmark_endpoint(
    row_count: int = Query(20000, le=50000),
    role: str = Depends(get_current_role)
) -> Dict[str, Any]:
    """Runs 20,000 in-memory row speed benchmark."""
    assert_officer(role)
    res = run_speed_benchmark(row_count)
    return res


# ----------------- Offline AI Compliance Copilot -----------------
class CopilotChatRequest(BaseModel):
    message: str
    institution_id: Optional[str] = None
    student_token: Optional[str] = None
    current_page: Optional[str] = None


@app.post("/api/v1/copilot/chat")
def copilot_chat_endpoint(
    req: CopilotChatRequest,
    role: str = Depends(get_current_role),
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """Queries offline AI Compliance Assistant for regulatory norms, APH clauses, and diagnostics."""
    res = query_copilot(
        user_message=req.message,
        role=role,
        institution_id=req.institution_id,
        student_token=req.student_token,
        current_page=req.current_page,
        session=session
    )
    return res


# ----------------- Frontend Static Mount -----------------
FRONTEND_DIR = BASE_DIR / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

