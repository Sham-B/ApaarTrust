import random
from datetime import date, timedelta
from typing import List, Dict, Any

from faker import Faker
from backend.app.models import QuotaEnum, NationalityEnum
from backend.app.security import compute_apaar_token, encrypt_apaar, mask_apaar

fake = Faker("en_IN")
Faker.seed(2026)
random.seed(2026)

PROGRAMMES = [
    "B.Tech Computer Science and Engineering",
    "B.Tech Electronics and Communication Engineering",
    "B.Tech Mechanical Engineering",
    "B.Tech Information Technology",
    "B.Tech Civil Engineering",
]

SOCIAL_CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"]


def generate_12digit_apaar() -> str:
    """Generate a realistic 12-digit APAAR ID."""
    prefix = random.choice(["2", "3", "4", "5", "6", "7", "8", "9"])
    rest = "".join([str(random.randint(0, 9)) for _ in range(11)])
    return f"{prefix}{rest}"


def generate_realistic_student(
    programme: str,
    academic_year: str = "2024-25",
    quota: str = QuotaEnum.REGULAR,
    dob_override: str = None,
    apaar_override: str = None,
    name_override: str = None,
    nationality: str = NationalityEnum.INDIAN,
    gender: str = None
) -> Dict[str, Any]:
    gender = gender or random.choice(["Male", "Female"])
    if gender == "Male":
        name = name_override or fake.first_name_male() + " " + fake.last_name()
    else:
        name = name_override or fake.first_name_female() + " " + fake.last_name()

    if dob_override:
        dob_str = dob_override
    else:
        # Realistic student born between 2002 and 2006 (age 18-22 in 2024)
        birth_year = random.randint(2002, 2006)
        birth_month = random.randint(1, 12)
        birth_day = random.randint(1, 28)
        dob_str = f"{birth_year:04d}-{birth_month:02d}-{birth_day:02d}"

    apaar_id = apaar_override or generate_12digit_apaar()
    apaar_masked = mask_apaar(apaar_id)
    apaar_token = compute_apaar_token(apaar_id)
    apaar_encrypted = encrypt_apaar(apaar_id)

    # Admission date inside 2024 academic cycle (Aug 1 - Sep 30)
    admit_day = random.randint(1, 30)
    admission_date = f"2024-08-{admit_day:02d}"

    category = random.choice(SOCIAL_CATEGORIES) if quota != "EWS" else "EWS"
    if quota in (QuotaEnum.NRI, QuotaEnum.FN, QuotaEnum.OCI):
        nationality = quota

    return {
        "apaar_id": apaar_id,
        "apaar_token": apaar_token,
        "apaar_id_encrypted": apaar_encrypted,
        "apaar_masked": apaar_masked,
        "name": name,
        "dob": dob_str,
        "gender": gender,
        "social_category": category,
        "nationality_status": nationality,
        "admission_quota": quota,
        "programme": programme,
        "admission_date": admission_date,
        "enrolment_status": "Active",
        "academic_year": academic_year,
    }


def generate_benchmark_dataset(count: int = 20000) -> List[Dict[str, Any]]:
    """
    Generates in-memory synthetic rows for high-throughput speed benchmarking.
    Does NOT write to disk or database.
    """
    records: List[Dict[str, Any]] = []
    base_date = date(2004, 1, 1)

    for i in range(count):
        apaar = f"9{i:011d}"
        dob = (base_date + timedelta(days=(i % 1400))).isoformat()
        records.append({
            "apaar_id": apaar,
            "apaar_token": compute_apaar_token(apaar),
            "name": f"Student Benchmark {i}",
            "dob": dob,
            "gender": "Male" if i % 2 == 0 else "Female",
            "social_category": "General",
            "nationality_status": "Indian",
            "admission_quota": "Regular",
            "programme": PROGRAMMES[i % len(PROGRAMMES)],
            "admission_date": "2024-08-15",
            "student_id": f"BENCH-{i:06d}"
        })
    return records
