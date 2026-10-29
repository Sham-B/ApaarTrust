# 🚀 100% Free Hosting Guide for ApaarTrust (Zero Credit Card Required)

> **Note on Hugging Face Spaces**: Hugging Face recently moved Docker/Gradio compute behind their paid PRO tier for new accounts, keeping only static HTML spaces free.
> 
> Below are the top **genuinely free alternatives** that support Python 3.12 (FastAPI), SQLite, and the complete frontend SPA with **zero cost and no credit card required**.

---

## 🏆 Recommendation 1: Zeabur (Cloud Hosting, No Credit Card)

**Zeabur** is the closest direct alternative to Render:
- **Cost**: 100% Free Plan.
- **Credit Card**: **NOT required**. Sign up with your GitHub account.
- **Auto-Detection**: Automatically detects our pre-configured [Dockerfile](file:///d:/apaartrust/Dockerfile) or [zeabur.json](file:///d:/apaartrust/zeabur.json).
- **Public Domain**: Provides a free public HTTPS domain (e.g., `https://<your-app>.zeabur.app`).

### Step-by-Step Deployment (Takes ~2 minutes):

1. Go to [zeabur.com](https://zeabur.com/) and click **Login** $\to$ **Sign in with GitHub**.
2. Click **Create Project** (select any region, e.g., Asia Pacific or US).
3. Click **Deploy Service** $\to$ **Git** $\to$ **GitHub**.
4. Select your `apaartrust` repository and click **Deploy**.
   - Zeabur will automatically read the [Dockerfile](file:///d:/apaartrust/Dockerfile) and [zeabur.json](file:///d:/apaartrust/zeabur.json), install dependencies from `requirements-render.txt`, and start the app.
5. In your project dashboard, click your service $\to$ go to the **Networking** or **Domains** tab $\to$ click **Generate Domain**.
6. Your prototype is immediately live worldwide on your free `.zeabur.app` HTTPS domain!

---

## ⚡ Recommendation 2: Instant Public HTTPS Tunnel (Zero Signup, Instant Access)

If you need a live public HTTPS link **right this second** for judges, evaluators, or colleagues without waiting for cloud builds or creating accounts:

You can expose your already-running local ApaarTrust app (`http://127.0.0.1:8080`) to the entire world over secure HTTPS with one command:

### Option A: Via Localtunnel (Built-in with Node.js)
In PowerShell, run:
```powershell
npx -y localtunnel --port 8080
```
This prints an instant public HTTPS URL like:
```
your url is: https://quick-green-fish.loca.lt
```
Anyone in the world can open that URL in their phone or browser and interact with ApaarTrust with zero cold starts and 100% of your PC's CPU and RAM!

### Option B: Via Cloudflare Quick Tunnel (No account, no card, fast CDN)
Download the standalone `cloudflared.exe` or run:
```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://127.0.0.1:8080
```
Gives an instant `https://<random-id>.trycloudflare.com` global HTTPS link.

---

## 🥈 Recommendation 3: SnapDeploy (Docker Cloud)

**SnapDeploy** offers free container hosting without a credit card:
- **Cost**: Free tier (4 containers, 100 container hours/month).
- **Credit Card**: Not required.
- **Workflow**: Connect GitHub $\to$ select `apaartrust` $\to$ deploys via [Dockerfile](file:///d:/apaartrust/Dockerfile).
- Website: [snapdeploy.dev](https://snapdeploy.dev)

---

## 📋 Pre-Configured Files in this Repository

| File | Purpose |
| :--- | :--- |
| [zeabur.json](file:///d:/apaartrust/zeabur.json) | Zero-config deployment file for Zeabur. |
| [Dockerfile](file:///d:/apaartrust/Dockerfile) | Universal container for Zeabur, SnapDeploy, and Docker hosts. |
| [Procfile](file:///d:/apaartrust/Procfile) | Web process declaration for buildpack hosts. |
| [requirements-render.txt](file:///d:/apaartrust/requirements-render.txt) | Lean, optimized dependencies for fast sub-2-minute cloud builds. |
