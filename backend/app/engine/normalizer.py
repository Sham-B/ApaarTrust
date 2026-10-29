import re
import yaml
from typing import List, Dict
from rapidfuzz import fuzz
from backend.app.config import BASE_DIR, RULES_DIR

# Load name normalization rules
NAME_RULES_PATH = RULES_DIR / "name_normalizer.yaml"
if not NAME_RULES_PATH.exists():
    NAME_RULES_PATH = BASE_DIR / "rules" / "name_normalizer.yaml"

HONORIFICS: List[str] = [
    "mr", "mr.", "ms", "ms.", "mrs", "mrs.", "dr", "dr.", "shri", "smt", "smt.",
    "kumari", "km", "km.", "master", "shaikh", "sheikh", "sai", "sri", "prof", "prof."
]
TRANSLIT_MAP: Dict[str, str] = {}

if NAME_RULES_PATH.exists():
    try:
        with open(NAME_RULES_PATH, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
            HONORIFICS = [h.lower() for h in data.get("honorifics", HONORIFICS)]
            for group in data.get("transliteration_groups", []):
                canonical = group.get("canonical", "")
                for variant in group.get("variants", []):
                    TRANSLIT_MAP[variant.lower()] = canonical.lower()
    except Exception:
        pass



def normalize_indian_name(name_str: str) -> str:
    """
    Cleans honorifics, punctuation, collapses transliteration variants,
    and strips excess whitespace for robust cross-system matching.
    """
    if not name_str:
        return ""

    # Lowercase & replace periods/commas with space
    text = str(name_str).lower()
    text = re.sub(r"[.,\-–_/\\]", " ", text)
    tokens = text.split()

    cleaned_tokens: List[str] = []
    for token in tokens:
        # Strip honorifics
        if token in HONORIFICS:
            continue
        # Map transliteration variants
        normalized_token = TRANSLIT_MAP.get(token, token)
        cleaned_tokens.append(normalized_token)

    return " ".join(cleaned_tokens).strip()


def compute_name_similarity(name1: str, name2: str) -> float:
    """
    Computes normalized token-sort similarity score [0.0 - 1.0].
    """
    norm1 = normalize_indian_name(name1)
    norm2 = normalize_indian_name(name2)
    if not norm1 or not norm2:
        return 0.0

    if norm1 == norm2:
        return 1.0

    # Token sort ratio handles rearranged first/last names or initials
    score = fuzz.token_sort_ratio(norm1, norm2) / 100.0
    return round(score, 3)


def get_phonetic_blocking_key(name: str, dob: str) -> str:
    """
    Generates a deterministic blocking key combining normalized initials + surname + DOB
    for efficient candidate pair clustering.
    """
    norm = normalize_indian_name(name)
    tokens = norm.split()
    initials = "".join([t[0] for t in tokens if t]) if tokens else "x"
    last_word = tokens[-1] if tokens else "unknown"
    dob_clean = str(dob).strip().replace("-", "")
    return f"{initials[:2]}_{last_word[:4]}_{dob_clean}"
