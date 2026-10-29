import logging
from collections import Counter
from datetime import datetime
from typing import Dict, Any, List, Optional
import numpy as np
from backend.app.config import settings

logger = logging.getLogger("apaartrust.anomaly")


def calculate_mad_iqr(values: List[float]) -> Dict[str, float]:
    """Computes Median, Median Absolute Deviation (MAD), and Interquartile Range (IQR)."""
    if not values:
        return {"median": 0.0, "mad": 0.0, "iqr": 0.0}

    arr = np.array(values, dtype=float)
    median = float(np.median(arr))
    mad = float(np.median(np.abs(arr - median)))
    q75, q25 = np.percentile(arr, [75, 25])
    iqr = float(q75 - q25)
    return {"median": median, "mad": mad, "iqr": iqr}


def detect_dob_clustering(batch_rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Flags statistically unnatural birth date clustering (e.g. excessive concentration on Jan 01)."""
    if len(batch_rows) < 15:
        return None

    month_days: List[str] = []
    for r in batch_rows:
        dob = str(r.get("dob", "")).strip()
        if len(dob) >= 10:
            month_days.append(dob[5:10])  # "MM-DD"

    if not month_days:
        return None

    counts = Counter(month_days)
    most_common_date, freq = counts.most_common(1)[0]
    total = len(month_days)
    pct = (freq / total) * 100.0

    # Normal uniform expectation is ~ 1/365 (~0.27%). If > 15% fall on single date (especially 01-01), flag it!
    if pct >= 15.0:
        return {
            "cluster_date": most_common_date,
            "count": freq,
            "total_students": total,
            "concentration_percentage": round(pct, 1),
            "is_jan_first": most_common_date == "01-01",
        }
    return None


def detect_nri_fn_spike(batch_rows: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Flags cohort with abnormal proportion of NRI/FN admissions (> 20%)."""
    if len(batch_rows) < 15:
        return None

    nri_fn_count = 0
    for r in batch_rows:
        q = str(r.get("admission_quota", "")).upper()
        n = str(r.get("nationality_status", "")).upper()
        if q in ("NRI", "FN", "OCI", "FN_OCI") or n in ("NRI", "FN", "OCI"):
            nri_fn_count += 1

    total = len(batch_rows)
    ratio = (nri_fn_count / total) * 100.0

    if ratio >= 20.0:
        return {
            "nri_fn_count": nri_fn_count,
            "total_students": total,
            "ratio_percentage": round(ratio, 1),
        }
    return None


def detect_age_anomalies(batch_rows: List[Dict[str, Any]], current_year: int = 2024) -> List[Dict[str, Any]]:
    """Flags students with impossible or highly irregular ages for undergraduate engineering."""
    anomalies: List[Dict[str, Any]] = []

    for idx, r in enumerate(batch_rows, start=1):
        dob = str(r.get("dob", "")).strip()
        try:
            birth_year = int(dob[:4])
            age = current_year - birth_year
            if age < 16 or age > 40:
                anomalies.append({
                    "row_number": idx,
                    "student_name": r.get("name"),
                    "dob": dob,
                    "calculated_age": age,
                    "flag": "underage" if age < 16 else "mature_learner",
                })
        except Exception:
            pass

    return anomalies


def run_isolation_forest_analysis(batch_rows: List[Dict[str, Any]]) -> List[int]:
    """
    Lazy import of IsolationForest.
    If LOW_MEMORY=1 or scikit-learn is not installed, gracefully returns empty list (skips ML, relies on MAD/IQR rules).
    Returns list of outlier row indices (1-indexed).
    """
    if settings.LOW_MEMORY:
        logger.info("LOW_MEMORY=1 active: Skipping IsolationForest in favor of rule-based MAD/IQR profiling.")
        return []

    if len(batch_rows) < 30:
        return []

    try:
        from sklearn.ensemble import IsolationForest

        # Feature matrix: [age, quota_code, admit_day_of_year]
        features = []
        for r in batch_rows:
            dob = str(r.get("dob", "2004-01-01"))
            try:
                birth_year = int(dob[:4])
                age = 2024 - birth_year
            except Exception:
                age = 20

            quota = str(r.get("admission_quota", "Regular")).upper()
            quota_code = 1.0 if quota in ("NRI", "FN", "OCI") else 0.0

            # Day of year of admission
            admit_date = str(r.get("admission_date", "2024-08-15"))
            try:
                d = datetime.strptime(admit_date, "%Y-%m-%d")
                doy = float(d.timetuple().tm_yday)
            except Exception:
                doy = 230.0

            features.append([float(age), quota_code, doy])

        X = np.array(features, dtype=float)
        clf = IsolationForest(contamination=0.03, random_state=2026, n_estimators=50)
        preds = clf.fit_predict(X)

        outlier_rows = [i + 1 for i, pred in enumerate(preds) if pred == -1]
        return outlier_rows
    except ImportError:
        logger.info("scikit-learn not available: IsolationForest skipped, pure MAD/IQR rules active.")
        return []
    except Exception as e:
        logger.warning(f"IsolationForest evaluation notice: {e}")
        return []
