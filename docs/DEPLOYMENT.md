# ApaarTrust Deployment & Hosting Guide 🚀

**Platform**: ApaarTrust • AICTE APAAR ID-Based Student Data Management and Verification Platform  
**Positioning**: *"One ID. Verified students. Zero exposure." AI only advises; officers decide.*  
**Local Development**: Default port `8080` via `python run.py`.

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────┐           ┌───────────────────────────────────┐
│          GitHub Pages           │           │         Render Free Tier          │
│   https://<user>.github.io/     │           │   https://<api>.onrender.com      │
│          ApaarTrust/            │           │                                   │
│  - Static HTML5/CSS3/ES6        │  HTTPS    │  - FastAPI Web Service (512 MB)   │
│  - Dynamic API_BASE injection   │ ────────> │  - Lean requirements-render.txt   │
│  - Relative asset resolution    │  CORS     │  - Background Seed on Boot        │
│  - Offline AI Copilot           │           │  - Ephemeral SQLite & In-Memory   │
└─────────────────────────────────┘           └───────────────────────────────────┘
```

---

## 👨‍⚖️ For Judges & Evaluators

Welcome to the **ApaarTrust** deployment evaluation guide.

### 🌐 Live Deployment URL & Access
- **Primary Live URL**: `https://apaartrust-api.snapdeploy.dev` (or Render / GitHub Pages / localtunnel)
- **Zero-Server Preview Mode**: If the host is sleeping or offline, click **"View preview without server"** on the landing page or wake-up modal. ApaarTrust loads instantly using pre-recorded deterministic fixtures with zero server dependency.
- **Local Instant Run**: `python run.py` (binds to `http://127.0.0.1:8080` and opens browser automatically).

### 💤 Free Host Sleep Behaviour
- This prototype is hosted on free-tier container infrastructure (SnapDeploy / Render: 100 free hours/month).
- **Sleep Policy**: The container automatically sleeps after **15 minutes of inactivity** to conserve hours.
- **Waking Up**: Visiting the site or clicking **"Wake the server"** triggers a container wake-up. Spin-up typically takes **30–60 seconds**.
- **In-App Client Safeguard**: The client uses the Page Visibility API and activity monitors to halt background API traffic when hidden or idle > 5 minutes. After 10 minutes idle, a calm banner *"Paused to save free server hours. Resume"* appears and halts all network requests until clicked.
- **Probe Limit**: Wake-up probing automatically stops after 5 minutes with a clean *"Try again"* button and instant option to view the no-server preview.

### 🔍 Preview Mode vs Live Mode
- **Persistent Ribbon**: When preview mode is active, an amber ribbon at the top clearly indicates:  
  `Preview mode: recorded sample data, not the live server` with a `Try the live server` button.
- **Deterministic Samples**: All five personas (Officer, College Registrar, Student, Verifier, Assistant) browse pre-recorded GET responses across 37 realistic fixtures.
- **Mutation Safety**: Mutating actions (uploads, unmasking reveals, triage decisions, consent revocations) display a friendly toast:  
  *"Preview mode: start the live server to try this"*.
- **Offline Assistant**: The AI Compliance Assistant answers questions client-side from the bundled knowledge base (`knowledge_base.yaml`), or displays *"The assistant needs the live server"* with suggested topics.
- **Verifier Outcomes**: All 5 cryptographic verification outcomes (`Genuine`, `Revoked`, `Expired`, `Tampered`, `Not Found`) can be tested directly from recorded results.

### 🎬 Video Walkthrough Placeholder & Script
- **Configurable Video Slot**: A 16:9 demo video slot is embedded on the landing page (configured via `VIDEO_URL` in `frontend/config.js`). When unset, a stable placeholder is shown.
- **Walkthrough Script**: A detailed 3-minute scripted tour with exact click instructions is published at [docs/DEMO_SCRIPT.md](DEMO_SCRIPT.md).

### ⚖️ Honest Platform Limits & Boundaries
1. **DEMO Seat Matrix Values**: Seat caps and supernumerary quotas (TFW 5%, EWS 10%, KM, NRI) are DEMO VALUES for software validation, not statutory AICTE rules. In production, configure directly from the AICTE Approval Process Handbook.
2. **AI Only Advises; Human Decides**: The AI Compliance Assistant provides assistive explanations grounded in YAML rules. AI cannot legally alter regulatory status; adverse actions strictly require human officer authorization and a written justification.
3. **Synthetic Archetype Data**: All institutions (Aryabhata, Bhaskara, Chanakya, Dronacharya, Eklavya) and student records are 100% synthetic. Zero real student PII is included.
4. **Mock Central Registry**: The APAAR Central Registry adapter interfaces with a high-fidelity local mock engine. Production deployments would connect via Government API Setu.
5. **SD-JWT Format**: The selective disclosure format is inspired by the IETF SD-JWT draft specification, optimized for educational credential presentation.
6. **Accessibility**: Targeted towards WCAG 2.2 AA design goals with full keyboard operability, skip links, and high-contrast color tokens.

---

## 🛠️ Step 1: Deploy Backend on Render (Blueprint)

ApaarTrust includes a root-level `render.yaml` Blueprint specification.

1. **Log in to Render:** Go to [dashboard.render.com](https://dashboard.render.com).
2. **Create New Blueprint Instance:**
   - Click **New +** -> **Blueprint**.
   - Connect your GitHub repository.
   - Branch: `main`.
3. **Verify Blueprint Settings:**
   Render reads `render.yaml` and configures:
   - **Environment:** Python 3.12+
   - **Build Command:** `pip install -r requirements-render.txt`
   - **Start Command:** `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
4. **Click "Apply":** Render builds and deploys the service.
5. **Verify Health:** Visit `https://<your-service>.onrender.com/health` in your browser. It should return:
   ```json
   { "status": "ok", "ready": true, "demo_mode": true }
   ```

---

## 🌐 Step 2: Configure GitHub Pages

The frontend deploys static HTML, CSS, and vanilla JavaScript with relative asset paths.

1. On GitHub, navigate to your repository **Settings** -> **Pages**.
2. Under **Build and deployment** -> **Source**, select **GitHub Actions**.
3. Set the repository variable `API_BASE_URL` under **Settings** -> **Secrets and variables** -> **Actions** to point to your live backend.

---

## ⚙️ Environment Variables Reference

| Variable | Default (Local) | Purpose |
| :--- | :--- | :--- |
| `PORT` | `8080` | Web server binding port |
| `SECRET_KEY` | Auto-derived | Session security & Fernet key derivation |
| `FERNET_KEY` | Derived / .env | Student record Fernet (AES-128-CBC with HMAC-SHA256) key at rest |
| `CORS_ORIGINS` | `http://localhost:8080...` | Allowed origins for cross-origin API calls |
| `DEMO_MODE` | `1` | Enables prototype defaults and synthetic archetypes |
| `LOW_MEMORY` | `0` | Limits memory usage for 512 MB containers |
| `LLM_PROVIDER` | `template` | Default offline rule-grounded Copilot |

---

## 🛡️ Production Notice
Production access would require formal authorization and a security review; we have not assessed those requirements.
Seat caps and supernumerary quotas are DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook.
Accessibility target: WCAG 2.2 AA as a design goal (not audited; does not claim GIGW certification).
