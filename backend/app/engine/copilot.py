import logging
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
import yaml
import httpx
from sqlmodel import Session, select, func
from backend.app.config import settings
from backend.app.models import Institution, Finding, StudentRecord, ConsentGrant

try:
    import rapidfuzz.fuzz as fuzz
except ImportError:
    import difflib

    class FuzzFallback:
        @staticmethod
        def partial_ratio(s1: str, s2: str) -> float:
            return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio() * 100

        @staticmethod
        def token_set_ratio(s1: str, s2: str) -> float:
            return difflib.SequenceMatcher(None, s1.lower(), s2.lower()).ratio() * 100

    fuzz = FuzzFallback()

logger = logging.getLogger("apaartrust.copilot")

SEAT_DISCLAIMER = "DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook"
COPILOT_FOOTER = "Demo assistant. Not legal or regulatory advice."


def _load_yaml_file(filename: str) -> Dict[str, Any]:
    candidates = [
        Path("rules") / filename,
        Path("backend/rules") / filename,
        Path("backend/knowledge") / filename,
        Path(__file__).resolve().parent.parent.parent.parent / "rules" / filename,
        Path(__file__).resolve().parent.parent.parent / "rules" / filename,
        Path(__file__).resolve().parent.parent.parent / "knowledge" / filename,
    ]
    for p in candidates:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict):
                        return data
            except Exception as e:
                logger.warning(f"Failed to load yaml {p}: {e}")
    return {}


def _load_kb() -> List[Dict[str, Any]]:
    candidates = [
        Path("backend/knowledge/knowledge_base.yaml"),
        Path("docs/knowledge/knowledge_base.yaml"),
        Path(__file__).resolve().parent.parent.parent / "knowledge" / "knowledge_base.yaml",
    ]
    for p in candidates:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    if isinstance(data, dict) and "entries" in data:
                        return data["entries"]
            except Exception as e:
                logger.warning(f"Failed to load kb {p}: {e}")
    return []


GLOSSARY: Dict[str, Dict[str, Any]] = {
    "apaar": {
        "title": "APAAR (Automated Permanent Academic Account Registry)",
        "file_key": "glossary: apaar",
        "text": (
            "A 12-digit unique lifelong digital ID issued under the Academic Bank of Credits (ABC) / "
            "Ministry of Education, GoI. Anchors all higher education qualifications."
        ),
        "is_seat": False,
    },
    "sanctioned_intake": {
        "title": "Sanctioned Intake Capacity",
        "file_key": "glossary: sanctioned_intake",
        "text": (
            "The maximum number of regular students an AICTE-approved institution is legally licensed to admit "
            "into a degree course for that academic session."
        ),
        "is_seat": True,
    },
    "supernumerary_seats": {
        "title": "Supernumerary Seats",
        "file_key": "glossary: supernumerary_seats",
        "text": (
            "Special quota seats permitted above the sanctioned regular intake. Includes Tuition Fee Waiver (TFW 5%), "
            "EWS (10%), Kashmiri Migrants (KM 3 fixed), PMSSS (2 fixed), and NRI/FN/OCI (up to 15%)."
        ),
        "is_seat": True,
    },
    "privacy_sdjwt": {
        "title": "Zero-Exposure & Selective Disclosure (SD-JWT Inspired)",
        "file_key": "glossary: privacy_sdjwt",
        "text": (
            "A privacy architecture where each student claim (programme, name, DOB) is independently committed "
            "using a salted cryptographic hash (sha256(salt:claim)). Third-party verifiers can authenticate valid enrolment "
            "without discovering undisclosed attributes."
        ),
        "is_seat": False,
    },
    "dry_run": {
        "title": "Dry-Run Simulation",
        "file_key": "glossary: dry_run",
        "text": (
            "A risk-free pre-flight validation mechanism that runs all 14 validation checks without persisting anything "
            "to the database, giving registrars a chance to fix errors."
        ),
        "is_seat": False,
    },
}


STOP_WORDS = {
    "what", "is", "the", "in", "today", "how", "do", "i", "can", "you", "for", "my",
    "to", "a", "an", "of", "and", "this", "that", "it", "with", "from", "are", "about",
    "write", "poem", "weather", "invest", "stock", "market", "tell", "me"
}


def _tokenize(text: str) -> List[str]:
    words = [w for w in re.findall(r"\w+", text.lower()) if len(w) > 2]
    return [w for w in words if w not in STOP_WORDS]


ROLE_SUGGESTIONS: Dict[str, List[str]] = {
    "officer": [
        "Which institutions are over intake?",
        "Explain this finding",
        "Why was this duplicate flagged?",
    ],
    "institution": [
        "How do I fix my file?",
        "What does dry run mean?",
        "What is the Tuition Fee Waiver (TFW) limit?",
    ],
    "student": [
        "Who can see my data?",
        "How do I revoke consent?",
        "What is my Digital Student ID?",
    ],
    "public": [
        "How does verification work?",
        "What does Verified Genuine mean?",
        "What does a tampered seal mean?",
    ],
}


def _execute_read_only_tool(
    query: str,
    norm_role: str,
    institution_id: Optional[str],
    student_token: Optional[str],
    session: Optional[Session],
) -> Optional[Tuple[str, str, bool, Optional[str], Optional[str]]]:
    """Executes live, role-scoped read-only database metrics."""
    q = query.lower()
    if not session:
        return None

    # Finding count tool
    if any(k in q for k in ["how many open findings", "open findings count", "count of open findings"]):
        if norm_role == "officer":
            count = session.exec(select(func.count(Finding.id)).where(Finding.status == "open")).one()
            text = f"There are currently {count} open regulatory findings awaiting scrutiny across all monitored institutions."
            return ("tools: findings_count", text, False, "#/officer/findings", "Open Findings")
        elif norm_role == "institution":
            inst_id = institution_id or "1-1090123456"
            count = session.exec(
                select(func.count(Finding.id)).where(Finding.institution_id == inst_id, Finding.status == "open")
            ).one()
            text = f"Your institution ({inst_id}) has {count} open validation findings requiring compliance action."
            return ("tools: college_findings_count", text, False, "#/college/todos", "View To-Dos")
        else:
            return None  # Students/Public cannot query internal regulatory findings

    # Student count tool
    if any(k in q for k in ["how many students are enrolled", "total enrolled students", "student count"]):
        if norm_role == "institution":
            inst_id = institution_id or "1-1090123456"
            count = session.exec(
                select(func.count(StudentRecord.id)).where(StudentRecord.institution_id == inst_id)
            ).one()
            text = f"Your institution ({inst_id}) has {count} active student enrolment records committed to the central registry."
            return ("tools: college_student_count", text, False, "#/college/students", "View Students")
        elif norm_role == "officer":
            count = session.exec(select(func.count(StudentRecord.id))).one()
            text = f"There are currently {count} verified student enrolment records anchored across all approved institutions."
            return ("tools: national_student_count", text, False, "#/officer/overview", "View Overview")

    # Consent count tool
    if any(k in q for k in ["how many active consent", "active grants count", "my consent grants"]):
        if norm_role == "student":
            tok = student_token or "tok_rohan_sharma"
            count = session.exec(
                select(func.count(ConsentGrant.id)).where(
                    ConsentGrant.student_token == tok,
                    ConsentGrant.revoked_at.is_(None)
                )
            ).one()
            text = f"You currently have {count} active third-party verification consent grants."
            return ("tools: student_consent_count", text, False, "#/student/consent", "Manage Consent")

    return None


def _retrieve_grounded_answer(
    user_message: str,
    role: str = "Officer",
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
    session: Optional[Session] = None,
) -> Optional[Tuple[str, str, bool, Optional[str], Optional[str], Optional[str]]]:
    """
    Retrieves grounded answer from KB and rules.
    Returns (file_key, answer_text, is_seat, action_url, action_label, tour_target) or None.
    """
    msg = user_message.lower().strip()
    norm_role = role.lower().strip()

    # 1. Check live role-scoped tools first
    tool_res = _execute_read_only_tool(msg, norm_role, institution_id, student_token, session)
    if tool_res:
        f_key, t_text, is_s, a_url, a_lbl = tool_res
        return (f_key, t_text, is_s, a_url, a_lbl, None)

    # 2. Check 56+ Structured KB entries with BM25 + RapidFuzz
    kb_entries = _load_kb()
    q_tokens = set(_tokenize(msg))
    if not q_tokens:
        return None

    best_score = 0.0
    best_entry: Optional[Dict[str, Any]] = None
    role_leakage_blocked = False

    for entry in kb_entries:
        # Check role permission
        allowed_roles = [r.lower() for r in entry.get("roles", [])]
        is_allowed = norm_role in allowed_roles or "public" in allowed_roles

        # Score calculation
        entry_q = entry.get("question", "").lower()
        synonyms = [s.lower() for s in entry.get("synonyms", [])]
        doc_tokens = set(_tokenize(entry_q + " " + " ".join(synonyms) + " " + entry.get("answer", "")))

        # Token overlap score - must have at least 1 content token overlap
        overlap = len(q_tokens.intersection(doc_tokens))
        if overlap == 0:
            continue

        token_score = (overlap / max(len(q_tokens), 1)) * 55.0

        # Token set ratio handles word order permutations accurately
        fuzz_q = fuzz.token_set_ratio(msg, entry_q)
        fuzz_syn = max([fuzz.token_set_ratio(msg, s) for s in synonyms], default=0.0)
        fuzzy_score = max(fuzz_q, fuzz_syn) * 0.45

        total_score = token_score + fuzzy_score

        if total_score > best_score:
            if is_allowed:
                best_score = total_score
                best_entry = entry
            else:
                if total_score > 50.0:
                    role_leakage_blocked = True

    # If an unauthorized role-specific query matched strongly, do not fall back to other roles
    if role_leakage_blocked and (not best_entry or best_score < 50.0):
        return None

    # High confidence threshold
    if best_entry and best_score >= 38.0:
        return (
            best_entry.get("file_key", "knowledge_base"),
            best_entry.get("answer", ""),
            best_entry.get("is_seat", False),
            best_entry.get("action_url"),
            best_entry.get("action_label"),
            best_entry.get("tour_target"),
        )

    # If blocked by role scoping
    if role_leakage_blocked:
        return None

    # 3. Fall back to standard configured rule files
    seat_rules = _load_yaml_file("seat_rules.yaml")
    val_rules = _load_yaml_file("validation_rules.yaml").get("rules", {})
    benign_rules = _load_yaml_file("benign_hypotheses.yaml").get("findings", {})
    retention_rules = _load_yaml_file("retention.yaml")
    quotas = seat_rules.get("seat_quotas", {})

    # TFW
    if any(w in msg for w in ["tfw", "tuition fee waiver"]):
        q = quotas.get("tfw", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        desc = q.get("description", "Tuition Fee Waiver supernumerary scheme")
        pct = q.get("max_percentage_intake", 5)
        text = f"Code: {q.get('code', 'TFW')}. Description: {desc}. Max percentage intake: {pct}% over sanctioned intake.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.tfw", text, True, "#/officer/rules", "View Seat Rules", None)

    # EWS
    if any(w in msg for w in ["ews", "economically weaker"]):
        q = quotas.get("ews", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        desc = q.get("description", "Economically Weaker Section reserved supernumerary allocation")
        pct = q.get("max_percentage_intake", 10)
        text = f"Code: {q.get('code', 'EWS')}. Description: {desc}. Max percentage intake: {pct}% over sanctioned intake.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.ews", text, True, "#/officer/rules", "View Seat Rules", None)

    # Kashmiri Migrants (KM)
    if any(w in msg for w in ["kashmiri", "km quota"]):
        q = quotas.get("km", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        desc = q.get("description", "Kashmiri Migrants quota")
        fixed = q.get("max_fixed_seats_per_course", 3)
        text = f"Code: {q.get('code', 'KM')}. Description: {desc}. Max seats per course: {fixed} fixed supernumerary seats.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.km", text, True, "#/officer/rules", "View Seat Rules", None)

    # PMSSS
    if any(w in msg for w in ["pmsss", "prime minister special scholarship"]):
        q = quotas.get("pmsss", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        desc = q.get("description", "Prime Minister Special Scholarship Scheme")
        fixed = q.get("max_fixed_seats_per_course", 2)
        text = f"Code: {q.get('code', 'PMSSS')}. Description: {desc}. Max seats per course: {fixed} fixed supernumerary seats.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.pmsss", text, True, "#/officer/rules", "View Seat Rules", None)

    # NRI / FN / OCI
    if any(w in msg for w in ["nri", "foreign national", "fn_oci", "oci"]):
        q_nri = quotas.get("nri", {})
        q_fn = quotas.get("fn_oci", {})
        cit_nri = f" (Citation: {q_nri.get('citation')})" if q_nri.get("citation") else ""
        cit_fn = f" (Citation: {q_fn.get('citation')})" if q_fn.get("citation") else ""
        text = (
            f"NRI: {q_nri.get('description', 'Non-Resident Indian')}, max intake: {q_nri.get('max_percentage_intake', 5)}%{cit_nri}. "
            f"FN/OCI: {q_fn.get('description', 'Foreign Nationals & OCI')}, max intake: {q_fn.get('max_percentage_intake', 15)}%{cit_fn}."
        )
        return ("rules/seat_rules.yaml: seat_quotas.nri_and_fn_oci", text, True, "#/officer/rules", "View Seat Rules", None)

    # Lateral Entry
    if any(w in msg for w in ["lateral entry", "diploma entry"]):
        q = quotas.get("lateral_entry", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        text = f"Code: {q.get('code', 'LATERAL_ENTRY')}. Description: {q.get('description')}. Max percentage: {q.get('max_percentage_intake', 10)}%.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.lateral_entry", text, True, "#/officer/rules", "View Seat Rules", None)

    # Regular Sanctioned Intake
    if any(w in msg for w in ["regular intake", "sanctioned intake", "seat matrix", "seat capacity"]):
        q = quotas.get("regular", {})
        cit = f" Citation: {q.get('citation')}" if q.get("citation") else ""
        text = f"Code: {q.get('code', 'REGULAR')}. Description: {q.get('description', 'Sanctioned AICTE Intake')}. Max percentage: {q.get('max_percentage_intake', 100)}%.{cit}"
        return ("rules/seat_rules.yaml: seat_quotas.regular", text, True, "#/officer/rules", "View Seat Rules", None)

    # Supernumerary general
    if "supernumerary" in msg:
        g = GLOSSARY["supernumerary_seats"]
        return (g["file_key"], g["text"], True, "#/officer/rules", "View Seat Rules", None)

    # Cross-Institution Duplicate
    if any(w in msg for w in ["duplicate", "concurrent", "two college", "another college", "double enrolment"]):
        vr = val_rules.get("DUPLICATE_CROSS_INSTITUTION", {})
        bh = benign_rules.get("DUPLICATE_CROSS_INSTITUTION", {})
        fix = bh.get("fix_hint", "Collect College Leaving Certificate or Transfer Certificate from prior institution.")
        text = f"Rule DUPLICATE_CROSS_INSTITUTION: {vr.get('description', 'Concurrent enrolment at another institution')}. Fix Hint: {fix}"
        return ("rules/validation_rules.yaml: DUPLICATE_CROSS_INSTITUTION", text, False, "#/officer/duplicates", "Inspect Duplicates", None)

    # Intra-Batch Duplicate
    if any(w in msg for w in ["intra-batch", "same batch duplicate"]):
        vr = val_rules.get("DUPLICATE_IN_BATCH", {})
        bh = benign_rules.get("DUPLICATE_IN_BATCH", {})
        text = f"Rule DUPLICATE_IN_BATCH: {vr.get('description')}. Fix Hint: {bh.get('fix_hint', 'Deduplicate rows before upload.')}"
        return ("rules/validation_rules.yaml: DUPLICATE_IN_BATCH", text, False, "#/college/upload", "Go to Upload", None)

    # Format
    if any(w in msg for w in ["format", "12-digit", "apaar format"]):
        vr = val_rules.get("APAAR_FORMAT", {})
        bh = benign_rules.get("APAAR_FORMAT", {})
        text = f"Rule APAAR_FORMAT: {vr.get('description')}. Fix Hint: {bh.get('fix_hint', 'Ensure 12 numeric digits.')}"
        return ("rules/validation_rules.yaml: APAAR_FORMAT", text, False, "#/college/upload", "Go to Upload", None)

    # Retention
    if any(w in msg for w in ["retention", "purge", "horizon", "delete data"]):
        rh = retention_rules.get("retention_horizons_days", {})
        text = (
            f"Configured retention horizons (days): Dry-run submissions: {rh.get('dry_run_submissions', 7)} days; "
            f"Uncommitted findings: {rh.get('uncommitted_findings', 14)} days; "
            f"Verification logs: {rh.get('verification_logs', 180)} days; "
            f"Audit trail: {rh.get('audit_trail', 365)} days. Purges require officer authentication and written justification."
        )
        return ("rules/retention.yaml: retention_horizons_days", text, False, "#/officer/audit", "View Audit Trail", None)

    # Dry Run
    if any(w in msg for w in ["dry run", "dry-run", "pre-flight"]):
        g = GLOSSARY["dry_run"]
        return (g["file_key"], g["text"], False, "#/college/upload", "Try Dry Run", None)

    # Privacy
    if any(w in msg for w in ["privacy", "sd-jwt", "selective disclosure", "zero-exposure", "masking"]):
        g = GLOSSARY["privacy_sdjwt"]
        return (g["file_key"], g["text"], False, "#/student/share", "Share Credential", None)

    # APAAR ID
    if any(w in msg for w in ["what is apaar", "apaar id", "apaar meaning", "automated permanent academic account"]):
        g = GLOSSARY["apaar"]
        return (g["file_key"], g["text"], False, "#/help", "Open Help Center", None)

    return None


def query_copilot(
    user_message: str,
    role: str = "Officer",
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
    current_page: Optional[str] = None,
    session: Optional[Session] = None,
) -> Dict[str, Any]:
    """
    Offline AI Compliance Copilot & Demo Assistant.
    - Grounded ONLY in configured YAML rules and the knowledge base.
    - Role-scoped: student assistant cannot leak officer/college data.
    - Returns source citations, mode, deep links, and follow-up chips.
    - If out-of-scope: returns 'That is not in the configured rules' + 3 suggested questions.
    """
    norm_role = role.lower().strip()
    match_result = _retrieve_grounded_answer(
        user_message=user_message,
        role=role,
        institution_id=institution_id,
        student_token=student_token,
        session=session,
    )

    suggestions = ROLE_SUGGESTIONS.get(norm_role, ROLE_SUGGESTIONS["public"])

    if match_result is None:
        reply = (
            "Based on the demo rule set: That is not in the configured rules.\n\n"
            "Suggested questions for your role:\n"
            + "\n".join([f"• {s}" for s in suggestions])
            + f"\n\n{COPILOT_FOOTER}"
        )
        return {
            "reply": reply,
            "mode": "template",
            "rule_file": "none",
            "source": "none",
            "role": role,
            "offline_mode": True,
            "action_url": None,
            "action_label": None,
            "tour_target": None,
            "follow_ups": suggestions,
        }

    file_key, config_text, is_seat, action_url, action_label, tour_target = match_result

    # Format deterministic template answer
    seat_clause = f"\n\n**Note:** {SEAT_DISCLAIMER}" if is_seat else ""

    context_note = ""
    if institution_id and session and norm_role in ["officer", "institution"]:
        try:
            inst = session.get(Institution, institution_id)
            if inst:
                open_findings = session.exec(
                    select(Finding).where(Finding.institution_id == institution_id, Finding.status == "open")
                ).all()
                context_note = f"\n\n*(Current context: {inst.name} has {len(open_findings)} open findings)*"
        except Exception:
            pass

    template_reply = (
        f"Based on the demo rule set ({file_key}):\n\n"
        f"{config_text}"
        f"{seat_clause}"
        f"{context_note}\n\n"
        f"{COPILOT_FOOTER}"
    )

    # If Ollama is enabled, send ONLY configured context
    if settings.LLM_PROVIDER == "ollama":
        try:
            system_instruction = (
                f"You are an assistive demo copilot. Answer strictly and only based on the configured snippet below. "
                f"Do not guess or add any outside knowledge. "
                f"Start your answer with 'Based on the demo rule set ({file_key}):'. "
                + (f"Include '{SEAT_DISCLAIMER}'. " if is_seat else "")
                + f"End with '{COPILOT_FOOTER}'."
            )
            prompt = (
                f"{system_instruction}\n\n"
                f"Configured Context: {config_text}\n\n"
                f"User Question: {user_message}\n\n"
                f"Answer:"
            )
            with httpx.Client(timeout=4.0) as client:
                res = client.post(
                    f"{settings.OLLAMA_URL}/api/generate",
                    json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False}
                )
                if res.status_code == 200:
                    text = res.json().get("response", "").strip()
                    if text:
                        if not text.startswith("Based on the demo rule set"):
                            text = f"Based on the demo rule set ({file_key}):\n\n" + text
                        if is_seat and SEAT_DISCLAIMER not in text:
                            text += f"\n\n**Note:** {SEAT_DISCLAIMER}"
                        if COPILOT_FOOTER not in text:
                            text += f"\n\n{COPILOT_FOOTER}"
                        return {
                            "reply": text + context_note,
                            "mode": "local model",
                            "rule_file": file_key,
                            "source": file_key,
                            "role": role,
                            "offline_mode": True,
                            "action_url": action_url,
                            "action_label": action_label,
                            "tour_target": tour_target,
                            "follow_ups": suggestions[:2],
                        }
        except Exception as e:
            logger.debug(f"Ollama query failed, falling back to template: {e}")

    return {
        "reply": template_reply,
        "mode": "template",
        "rule_file": file_key,
        "source": file_key,
        "role": role,
        "offline_mode": True,
        "action_url": action_url,
        "action_label": action_label,
        "tour_target": tour_target,
        "follow_ups": suggestions[:2],
    }
