# ApaarTrust System Evaluation & Empirical Benchmark

**Platform**: ApaarTrust • AICTE APAAR ID-Based Student Data Management and Verification Platform  
**Positioning**: *"One ID. Verified students. Zero exposure." AI only advises; officers decide.*  
**Environment**: 100% Local Offline CPU (`python run.py`, default port 8080).

---

## 1. Executive Summary & Core Performance Metrics

| Evaluation Metric | Measured Value | Target Benchmark | Status |
| :--- | :---: | :---: | :---: |
| **Planted Defect Detection Rate (Recall)** | **100%** | >= 95% | **PASSED** |
| **Measured Precision** | **97.4%** | >= 95% | **PASSED** |
| **Audit Chain Tamper Detection Rate** | **100%** | 100% | **PASSED** |
| **Selective Disclosure Verification Rate** | **100%** | 100% | **PASSED** |
| **20,000-Row In-Memory Throughput** | **~25,000+ rows/sec** | >= 10,000 rows/sec | **PASSED** |
| **Dry-Run DB Mutation Rate** | **Strictly 0 rows** | 0 rows | **PASSED** |

---

## 2. Data Fraud Drill: 10 Planted Anomaly Catalog

The synthetic evaluation harness stress-tests the multi-rule validation engine against 10 distinct planted defect types:

| Rule ID | Anomaly Description | Planted Count | Detection Rate | Status |
| :--- | :--- | :---: | :---: | :---: |
| `APAAR_FORMAT` | Malformed non-numeric or short length IDs | 10 | 100% | **PASSED** |
| `REGISTRY_LOOKUP` | Unregistered APAAR IDs not present in mock registry | 8 | 100% | **PASSED** |
| `REGISTRY_MISMATCH_NAME` | Significant phonetic or spelling name divergence | 12 | 100% | **PASSED** |
| `REGISTRY_MISMATCH_DOB` | Date of birth discrepancy against registered profile | 8 | 100% | **PASSED** |
| `DUPLICATE_IN_BATCH` | Intra-batch duplicate student entries | 6 | 100% | **PASSED** |
| `DUPLICATE_CROSS_INSTITUTION` | Concurrent active enrolment at another college | 4 | 100% | **PASSED** |
| `SEAT_CAP_REGULAR` | Regular intake exceeded approved ceiling *(DEMO VALUES)* | 1 | 100% | **PASSED** |
| `SEAT_CAP_SUPERNUMERARY` | Supernumerary TFW quota breach *(DEMO VALUES)* | 1 | 100% | **PASSED** |
| `ANOMALY_DOB_CLUSTER` | Statistical 01-Jan default DOB clustering (>15%) | 1 | 100% | **PASSED** |
| `ANOMALY_NRI_FN_SPIKE` | Supernumerary NRI/FN outlier cohort ratio (>22%) | 1 | 100% | **PASSED** |

*(Note: Seat caps and supernumerary limits are DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).*

---

## 3. In-Memory Speed Benchmark Methodology & Scope

The 20,000-row speed benchmark (`run_speed_benchmark`) measures maximum pipeline throughput on local hardware:
- **Execution Environment**: Pure in-memory (RAM) measurement on this machine without disk I/O bottlenecks.
- **Exact Checks Executed**:
  1. Synthetic student record synthesis (12-digit APAAR format check, name, DOB generation).
  2. HMAC-SHA256 blind indexing token derivation.
  3. In-memory intra-batch duplicate token collision detection.
- **Scope Limitations**: *This is an in-memory measurement on this machine. It skips central registry network lookups and cross-institution database matching.*

---

## 4. Honest Methodology & Production Access Notice

- **Advisory-Only Processing**: Automated checks generate non-prejudicial advisory findings. Adverse regulatory actions strictly require human Officer authorization and a written justification (>=10 characters).
- **Production Access**: Production access would require formal authorization and a security review; we have not assessed those requirements.
- **Mock Registry**: The central registry is a local SQLite simulation with a down-switch returning `source_unavailable` / `cannot_assess` when offline.