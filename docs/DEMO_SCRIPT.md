# ApaarTrust Demonstration Guide & Live Evaluator Script ⏱️

> **"One ID. Verified students. Zero exposure."**  
> *AI only advises; officers decide. 100% offline-ready. Tested on Python 3.12.*

This document provides two ready-to-present scripts for live judges, evaluators, or independent explorers:
1. **The 3-Minute Fast-Track Script**: High-velocity walkthrough of the flagship capabilities.
2. **The 8-Minute Deep-Dive Script**: Rigorous technical inspection of cryptographic guarantees, validation checks, and governance safeguards.

---

# Part 1: The 3-Minute Fast-Track Script ⏱️

### [0:00 - 0:30] Front Door & Live Privacy Simulator (#/)
1. **Launch**: Start the app with `python run.py`. Navigate to `http://127.0.0.1:8080/#/`.
2. **Hero Promise**: Show the interactive hero card: *"Selective Disclosure in Action"*.
   - Toggle **Date of birth** and **Social category** off.
   - Point out how the verifier viewport instantly blinds them with `[Withheld by student consent]`, while cryptographically verifying the student's name and active enrolment.
3. **Try 3-Minute Quick Starts**:
   - Scroll down to the *"Try ApaarTrust in 3 Minutes"* cards. Click **Launch J1: College Upload**.

---

### [0:30 - 1:15] Journey 1: College Admissions & Dry-Run Upload (#/college/upload)
1. **Template & Error Sample**:
   - In the upload dropzone, click the chip **Load Sample with 5 Errors**.
2. **Dry-Run Pre-Flight**:
   - Observe the live regular and supernumerary seat gauges update in real-time.
   - Review the **GOV.UK style Error Summary**: click on an error (e.g. `#finding-row-3`) to jump directly to the invalid row.
   - Note the clear reassurance banner: *"Nothing is saved until you submit."*
3. **Commit & Receipt**:
   - Click **Submit & Commit Roster**.
   - Review the immutable **Cryptographic Batch Receipt modal** showing the SHA-256 batch hash and committed count.
   - Click **View Enrolled Students** -> click **Certificate PDF** on any row to preview the high-res ReportLab sample certificate with Ed25519 QR seal.

---

### [1:15 - 2:00] Journey 2: Central Officer Oversight (#/officer/overview)
1. **National State Tile Map**:
   - Click the avatar in the sidebar footer and choose **Switch demo role** -> select **AICTE Officer (Ananya Rao)**.
   - In the overview, click on **Maharashtra (MH)** or **Delhi (DL)** on the state tile map to filter the institutions table by region.
2. **Bhaskara Over-Intake & Duplicate Adjudication**:
   - Select **Bhaskara College of Engineering** to show the CSE 120/90 capacity breach.
   - Navigate to **Duplicates** (`#/officer/duplicates`): inspect candidate **Rohan Aditya Sharma** enrolled concurrently at two institutions.
   - Click **Reveal Full APAAR ID**: show that unmasking strictly requires a written regulatory justification (min 10 chars).
   - Adjudicate the duplicate by choosing **Refer for Inspection** with reason *"Concurrent admission conflict across institutions"*.
3. **Tamper Detection & Report**:
   - Navigate to **Audit Log** (`#/officer/audit`): click **Simulate Tampering** to demonstrate immediate chain integrity failure, then click **Restore Chain** to re-anchor hashes.
   - Click **Download Compliance Report** to export the official ReportLab PDF with DEMO VALUES labels.

---

### [2:00 - 2:30] Journey 3: Student Sovereign Consent (#/student/record)
1. **Digital ID & Scoped Consent**:
   - Switch role to **Student (Rohan Aditya Sharma)**.
   - View the DigiLocker-style digital ID card with national tricolour accent and masked identifier (`XXXX-XXXX-1234`).
   - Navigate to **Consent Manager** (`#/student/consent`): configure an employment verification grant with expiry date, withholding Date of Birth.
   - Click **Generate Presentation Code & QR**. Copy the presentation code.
2. **Instant Revocation**:
   - Click **Revoke Consent**. Point out that subsequent verification attempts will immediately fail with a plain explanation.
   - Check **Who viewed my record** (`#/student/activity`) to see the complete immutable verification access log.

---

### [2:30 - 3:00] Journey 4 & 5: Public Verifier & AI Assistant
1. **5-Outcome Public Verifier (#/verify)**:
   - Navigate to `#/verify`.
   - Click **Sample Genuine**: observe the green verified badge, Ed25519 signature proof, and disclosed vs. withheld attributes.
   - Click **Sample Tampered**: observe the instant cryptographic mismatch rejection.
   - Click **Sample Revoked**: observe the clear notice that the student withdrew consent.
2. **Offline AI Compliance Assistant**:
   - Press `Ctrl+/` (or click the bottom-right floating launcher) to open the Assistant.
   - Click the chip: *"What is the maximum approved intake for CSE?"*.
   - Point out the cited rule source (`Source: rules/seat_rules.yaml`), model label, and mandatory advisory footer: *"Demo assistant. Not legal or regulatory advice."*

---

# Part 2: The 8-Minute In-Depth Evaluation Script ⏱️

### [0:00 - 1:30] Architecture & Regulatory Alignment
- **Positioning**: Explain the core AICTE problem statement: managing student data with permanent APAAR identifiers across approved colleges with zero privacy leakage.
- **Explain the Interactive Architecture Diagram**:
  - On the landing page (`#/`), navigate to the **Interactive Cryptographic Pipeline** diagram.
  - Click Block 1 (Ingestion) -> Block 2 (Seat Guard) -> Block 3 (Identity Vault) -> Block 4 (SD-JWT Studio) -> Block 5 (Audit Chain).
  - Emphasize the separation: institutions manage admissions; the cryptographic vault pseudonyms identifiers with Fernet (AES-128-CBC with HMAC-SHA256); students hold SD-JWT consent; officers audit via unbroken SHA-256 hash chains.

### [1:30 - 3:15] Deep Dive: The 14-Rule Dry-Run & Quota Engine
- Log in as **College Registrar (Aryabhata Institute)**.
- Download both the clean CSV and XLSX templates (`apaartrust_intake_template.xlsx`).
- Drop `tests/fixtures/sample_with_5_errors.csv` into the dropzone.
- Demonstrate that the dry-run simulation engine:
  - Executes all 14 AICTE validation checks (mandatory format, registry resolution, name concordance, duplicate detection, regular seat caps, supernumerary quotas).
  - Updates live capacity gauges with DEMO VALUES notices.
  - Flags row 3 (Format defect), row 7 (Over-intake), row 12 (DOB mismatch).
- Commit the roster and inspect the **Cryptographic Batch Receipt modal** showing timestamp, SHA-256 batch hash, and student count.
- Generate and open a Sample Certificate PDF: verify the ReportLab visual layout, national emblem placeholder, masked identifier, and embedded Ed25519 QR seal.

### [3:15 - 5:00] Deep Dive: Officer Scrutiny, Duplicates & Audit Chain
- Log in as **AICTE Officer (Ananya Rao)**.
- **State Tile-Grid Map**: Explain why a hand-built tile map is superior to generic maps: zero heavy GIS dependencies, clear 1-click state filtering, and color-coded compliance status.
- **Over-Intake Investigation**:
  - Open Bhaskara College of Engineering.
  - Inspect the regular CSE capacity overflow (120 admitted vs 90 approved) and TFW overflow.
- **Cross-Institution Duplicate Adjudication**:
  - Open candidate Rohan Aditya Sharma.
  - Show the probabilistic log-odds matching breakdown (exact HMAC token match +10.0, phonetic DOB match +4.1).
  - Unmask the APAAR ID by entering a logged written justification (>=10 chars).
  - Select an adverse regulatory action: **Hold Submission** with justification. Show that without a justification, the system strictly blocks the action.
- **Cryptographic Audit Ledger & Tamper Demo**:
  - Open `#/officer/audit`. Inspect the unbroken SHA-256 hash links from genesis to current event.
  - Click **Simulate Tampering**: an unauthorized background update alters a database payload.
  - Re-verify integrity: the system detects the hash break and flags the exact corrupted event ID.
  - Click **Restore Chain** to re-calculate clean cryptographic links.
- **Compliance Report PDF**: Download the ReportLab compliance report for the institution with DEMO VALUES disclaimers.

### [5:00 - 6:30] Deep Dive: Student Sovereignty & SD-JWT Verification
- Log in as **Student (Rohan Aditya Sharma)**.
- Review the citizen digital ID card with masked APAAR and active programme.
- Open **Consent Manager**:
  - Configure an employer verification grant: allow Name and Programme; withhold Date of Birth and Social Category.
  - Set an expiry timestamp.
  - Generate an SD-JWT presentation code.
- Open **Public Verifier** (`#/verify`):
  - Paste the presentation code.
  - Confirm that only consented fields are visible; withheld fields are cryptographically blinded.
- Return to Student portal and click **Revoke Consent**.
- Return to Public Verifier and re-verify the same code: the system rejects the presentation with a plain explanation that consent was revoked.
- Open **Who viewed my record**: confirm that both the successful verification and the subsequent blocked attempt are permanently recorded in the access log.

### [6:30 - 8:00] Deep Dive: Grounded AI Assistant & Guided Missions
- Open the **AI Compliance Assistant** via `Ctrl+/` or `#/assistant`.
- Demonstrate rule grounding:
  - Query: *"What is the approved intake for Computer Science?"* -> Returns exact YAML rule extract and citation.
  - Query: *"How many open findings do I have?"* -> Leverages live role-scoped database query tool.
  - Out-of-scope query: *"What is the capital of France?"* -> Standard refusal: *"Based on the demo rule set: That is not in the configured rules."*
  - Click an action link: *"Show me: Public Verifier"* -> Navigates to `#/verify` and highlights the verify card with the animated spotlight effect.
- Open **Demo Missions** panel (bottom-left):
  - Review checkable progress across all personas.
  - Toggle **Presenter Mode**: observe enlarged typography and step hints.
  - Show the **Reset Demo Data** capability for instant evaluator resets.
