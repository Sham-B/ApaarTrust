import yaml
from typing import Dict, Any, List
from backend.app.config import BASE_DIR, RULES_DIR
from backend.app.models import QuotaEnum


SEAT_RULES_PATH = RULES_DIR / "seat_rules.yaml"
if not SEAT_RULES_PATH.exists():
    SEAT_RULES_PATH = BASE_DIR / "rules" / "seat_rules.yaml"

_RULES_CACHE: Dict[str, Any] = {}


def get_seat_rules() -> Dict[str, Any]:
    global _RULES_CACHE
    if _RULES_CACHE:
        return _RULES_CACHE

    if SEAT_RULES_PATH.exists():
        try:
            with open(SEAT_RULES_PATH, "r", encoding="utf-8") as f:
                _RULES_CACHE = yaml.safe_load(f) or {}
                return _RULES_CACHE
        except Exception:
            pass

    # Default fallback rules
    _RULES_CACHE = {
        "seat_quotas": {
            "regular": {"max_percentage_intake": 100},
            "tfw": {"max_percentage_intake": 5},
            "ews": {"max_percentage_intake": 10},
            "km": {"max_fixed_seats_per_course": 3},
            "pmsss": {"max_fixed_seats_per_course": 2},
            "nri": {"max_percentage_intake": 5},
            "fn_oci": {"max_percentage_intake": 15},
        }
    }
    return _RULES_CACHE


def calculate_supernumerary_caps(approved_intake: int) -> Dict[str, int]:
    """Calculates permissible seat numbers for supernumerary categories given sanctioned regular intake."""
    rules = get_seat_rules().get("seat_quotas", {})

    caps = {}
    # TFW: default 5%
    tfw_pct = rules.get("tfw", {}).get("max_percentage_intake", 5)
    caps["TFW"] = max(1, int(approved_intake * tfw_pct / 100))

    # EWS: default 10%
    ews_pct = rules.get("ews", {}).get("max_percentage_intake", 10)
    caps["EWS"] = max(1, int(approved_intake * ews_pct / 100))

    # KM: fixed seats
    caps["KM"] = rules.get("km", {}).get("max_fixed_seats_per_course", 3)

    # PMSSS: fixed seats
    caps["PMSSS"] = rules.get("pmsss", {}).get("max_fixed_seats_per_course", 2)

    # NRI: default 5%
    nri_pct = rules.get("nri", {}).get("max_percentage_intake", 5)
    caps["NRI"] = max(1, int(approved_intake * nri_pct / 100))

    # FN_OCI: default 15%
    fn_pct = rules.get("fn_oci", {}).get("max_percentage_intake", 15)
    caps["FN_OCI"] = max(1, int(approved_intake * fn_pct / 100))

    return caps


def evaluate_seat_compliance(
    programme: str,
    approved_intake: int,
    student_records: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Evaluates regular and supernumerary seat intake compliance for a specific programme.
    Returns structured gauge data and violations.
    """
    caps = calculate_supernumerary_caps(approved_intake)

    quota_counts: Dict[str, int] = {
        "Regular": 0,
        "TFW": 0,
        "EWS": 0,
        "KM": 0,
        "PMSSS": 0,
        "NRI": 0,
        "FN_OCI": 0,
        "Other": 0,
    }

    for s in student_records:
        q = str(s.get("admission_quota", "Regular")).strip()
        if q in ("Regular", QuotaEnum.REGULAR):
            quota_counts["Regular"] += 1
        elif q == "TFW":
            quota_counts["TFW"] += 1
        elif q == "EWS":
            quota_counts["EWS"] += 1
        elif q == "KM":
            quota_counts["KM"] += 1
        elif q == "PMSSS":
            quota_counts["PMSSS"] += 1
        elif q in ("NRI", QuotaEnum.NRI):
            quota_counts["NRI"] += 1
        elif q in ("FN", "OCI", "FN_OCI", QuotaEnum.FN, QuotaEnum.OCI):
            quota_counts["FN_OCI"] += 1
        else:
            quota_counts["Other"] += 1

    regular_admitted = quota_counts["Regular"]
    regular_overflow = max(0, regular_admitted - approved_intake)

    supernumerary_violations: List[Dict[str, Any]] = []
    for cat, cap in caps.items():
        actual = quota_counts.get(cat, 0)
        if actual > cap:
            supernumerary_violations.append({
                "category": cat,
                "admitted": actual,
                "cap": cap,
                "excess": actual - cap,
            })

    total_admitted = sum(quota_counts.values())
    utilization_pct = round((regular_admitted / approved_intake * 100.0), 1) if approved_intake > 0 else 0.0

    return {
        "programme": programme,
        "approved_intake": approved_intake,
        "regular_admitted": regular_admitted,
        "regular_overflow": regular_overflow,
        "regular_utilization_pct": utilization_pct,
        "supernumerary_caps": caps,
        "quota_counts": quota_counts,
        "supernumerary_violations": supernumerary_violations,
        "total_admitted": total_admitted,
        "status": "violation" if (regular_overflow > 0 or len(supernumerary_violations) > 0) else "compliant"
    }
