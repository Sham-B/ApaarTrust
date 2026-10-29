import yaml
from typing import Dict, Any, List, Optional, Tuple
from sqlmodel import Session, select
from backend.app.config import BASE_DIR, RULES_DIR
from backend.app.models import StudentRecord
from backend.app.engine.normalizer import (
    compute_name_similarity,
    get_phonetic_blocking_key,
)
from backend.app.security import Role


WEIGHTS_PATH = RULES_DIR / "matching_weights.yaml"
if not WEIGHTS_PATH.exists():
    WEIGHTS_PATH = BASE_DIR / "rules" / "matching_weights.yaml"

DEFAULT_WEIGHTS = {
    "weights": {
        "apaar_token_exact": {"weight": 10.0},
        "dob_exact": {"weight": 4.1},
        "name_similarity_scale": {"max_weight": 3.5, "min_threshold": 0.70},
        "gender_concordance": {"weight_match": 0.8, "penalty_mismatch": -3.0},
    },
    "thresholds": {
        "definite_duplicate": 7.5,
        "probable_duplicate": 5.0,
        "review_threshold": 4.0,
    }
}


def get_matching_rules() -> Dict[str, Any]:
    if WEIGHTS_PATH.exists():
        try:
            with open(WEIGHTS_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or DEFAULT_WEIGHTS
        except Exception:
            pass
    return DEFAULT_WEIGHTS


def calculate_match_score(
    record_a: Dict[str, Any],
    record_b: Dict[str, Any]
) -> Tuple[float, List[str]]:
    """
    Computes probabilistic entity resolution score with log-odds field contributions.
    Returns (score, list_of_contributions).
    """
    rules = get_matching_rules()
    w_cfg = rules.get("weights", DEFAULT_WEIGHTS["weights"])

    score = 0.0
    contributions: List[str] = []

    # 1. APAAR token match
    token_a = record_a.get("apaar_token")
    token_b = record_b.get("apaar_token")
    if token_a and token_b and token_a == token_b:
        wt = w_cfg.get("apaar_token_exact", {}).get("weight", 10.0)
        score += wt
        contributions.append(f"exact APAAR token match (+{wt:.1f})")

    # 2. DOB exact match
    dob_a = str(record_a.get("dob", "")).strip()
    dob_b = str(record_b.get("dob", "")).strip()
    if dob_a and dob_b and dob_a == dob_b:
        wt = w_cfg.get("dob_exact", {}).get("weight", 4.1)
        score += wt
        contributions.append(f"same DOB {dob_a} (+{wt:.1f})")

    # 3. Name similarity
    name_a = record_a.get("name", "")
    name_b = record_b.get("name", "")
    sim = compute_name_similarity(name_a, name_b)
    name_cfg = w_cfg.get("name_similarity_scale", {})
    min_thresh = name_cfg.get("min_threshold", 0.70)
    max_name_wt = name_cfg.get("max_weight", 3.5)

    if sim >= min_thresh:
        name_contrib = round(sim * max_name_wt, 1)
        score += name_contrib
        contributions.append(f"name similarity {sim:.2f} (+{name_contrib:.1f})")

    # 4. Gender concordance
    gender_a = record_a.get("gender")
    gender_b = record_b.get("gender")
    g_cfg = w_cfg.get("gender_concordance", {})
    if gender_a and gender_b:
        if gender_a.lower() == gender_b.lower():
            g_match = g_cfg.get("weight_match", 0.8)
            score += g_match
            contributions.append(f"gender match {gender_a} (+{g_match:.1f})")
        else:
            g_pen = g_cfg.get("penalty_mismatch", -3.0)
            score += g_pen
            contributions.append(f"gender mismatch ({gender_a} vs {gender_b}) ({g_pen:.1f})")

    return round(score, 1), contributions


def find_intra_batch_duplicates(batch_rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detects duplicate entries within the uploaded spreadsheet."""
    seen_tokens: Dict[str, int] = {}
    seen_phonetic: Dict[str, int] = {}
    findings: List[Dict[str, Any]] = []

    for idx, row in enumerate(batch_rows, start=1):
        token = row.get("apaar_token")
        name = row.get("name", "")
        dob = row.get("dob", "")
        phonetic_key = get_phonetic_blocking_key(name, dob)

        if token and token in seen_tokens:
            prior_row = seen_tokens[token]
            findings.append({
                "row_number": idx,
                "rule_id": "DUPLICATE_IN_BATCH",
                "severity": "high",
                "plain_reason": f"Student APAAR identifier appears multiple times in this batch (first seen at row #{prior_row}).",
                "evidence": {
                    "apaar_masked": row.get("apaar_masked"),
                    "name": name,
                    "first_seen_row": prior_row,
                    "duplicate_row": idx,
                },
                "benign_hypotheses": [
                    {"title": "Internal Branch Transfer", "description": "Student was listed under previous branch and new branch roster."},
                    {"title": "Multi-round Counseling Export", "description": "Student appeared on provisional allotment and final list."}
                ],
                "fix_hint": "Remove duplicate row, retaining only the final confirmed admission quota and branch.",
            })
        elif token:
            seen_tokens[token] = idx

        if phonetic_key and phonetic_key in seen_phonetic and (not token or token not in seen_tokens):
            prior_row = seen_phonetic[phonetic_key]
            findings.append({
                "row_number": idx,
                "rule_id": "DUPLICATE_IN_BATCH",
                "severity": "high",
                "plain_reason": f"Possible duplicate student (matching DOB and phonetically identical name) seen at row #{prior_row}.",
                "evidence": {
                    "name": name,
                    "dob": dob,
                    "first_seen_row": prior_row,
                    "duplicate_row": idx,
                },
                "benign_hypotheses": [
                    {"title": "Twin Siblings", "description": "Twins or siblings with identical birth date and similar initials."}
                ],
                "fix_hint": "Confirm whether these are distinct individuals with unique APAAR IDs.",
            })
        elif phonetic_key:
            seen_phonetic[phonetic_key] = idx

    return findings


def check_cross_institution_duplicates(
    row: Dict[str, Any],
    current_institution_id: str,
    session: Session
) -> Optional[Dict[str, Any]]:
    """
    Checks if a candidate is actively enrolled at another AICTE-approved institution
    during an overlapping academic period.
    """
    token = row.get("apaar_token")
    if not token:
        return None

    # Query existing committed records across ALL other institutions
    statement = (
        select(StudentRecord)
        .where(StudentRecord.apaar_token == token)
        .where(StudentRecord.institution_id != current_institution_id)
        .where(StudentRecord.enrolment_status == "Active")
    )
    matches = session.exec(statement).all()

    if not matches:
        return None

    conflicting = matches[0]

    record_a = row
    record_b = {
        "apaar_token": conflicting.apaar_token,
        "name": conflicting.name,
        "dob": conflicting.dob,
        "gender": conflicting.gender,
    }
    score, contributions = calculate_match_score(record_a, record_b)

    return {
        "rule_id": "DUPLICATE_CROSS_INSTITUTION",
        "severity": "critical",
        "plain_reason": "Student is concurrently enrolled at another AICTE-approved institution with overlapping active tenure.",
        "raw_evidence": {
            "apaar_token": token,
            "apaar_masked": row.get("apaar_masked"),
            "conflicting_institution_id": conflicting.institution_id,
            "conflicting_programme": conflicting.programme,
            "overlap_academic_year": conflicting.academic_year,
            "match_score": score,
            "score_breakdown": ", ".join(contributions),
        },
        "benign_hypotheses": [
            {"title": "Pending Transfer Certificate", "description": "Candidate migrated from previous college; online exit not yet filed."},
            {"title": "Seat Holding During State Counseling", "description": "Candidate held round 1 seat elsewhere and joined spot admission without withdrawal."}
        ],
        "fix_hint": "Request stamped Transfer / Migration Certificate from candidate's previous institution before finalizing enrolment.",
    }


def redact_finding_for_role(finding_dict: Dict[str, Any], role: str) -> Dict[str, Any]:
    """
    CRITICAL PRIVACY GUARANTEE:
    When viewed by the Institution role, cross-institution duplicate findings MUST NOT
    disclose the name, PID, or student ID of the other college!
    """
    f = dict(finding_dict)
    rule_id = f.get("rule_id")

    if role == Role.INSTITUTION:
        if rule_id == "DUPLICATE_CROSS_INSTITUTION":
            f["plain_reason"] = "Possible enrolment at another AICTE institution: AICTE will contact you"
            ev = f.get("evidence", {})
            f["evidence"] = {
                "notice": "Privacy Protected: Institutional identities withheld pursuant to AICTE cross-institutional confidentiality norms.",
                "apaar_masked": ev.get("apaar_masked", "XXXX-XXXX-****"),
                "status": "Under Central AICTE Regional Scrutiny",
                "action_required": "Ensure student possesses formal Transfer Certificate or surrender slip from prior enrollment."
            }

    return f
