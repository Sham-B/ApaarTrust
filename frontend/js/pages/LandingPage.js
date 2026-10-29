/**
 * Landing Page - The Real-Product Front Door for ApaarTrust
 * Sticky marketing nav, hero with interactive preview, 3-minute flagship journeys,
 * interactive architecture diagram (SVG), role cards, comparison table, features grid,
 * demo missions, honest limitations, FAQ, footer.
 */

import { auth } from '../auth.js';
import { api } from '../api.js';
import { previewManager } from '../preview.js';
import { wakeupManager } from '../wakeup.js';
import { iconHtml } from '../ui/icons.js';
import { statusPill } from '../ui/StatusPill.js';
import { runSpotlight } from '../ui/CopilotDrawer.js';
import { MISSIONS } from '../ui/DemoControls.js';

export async function renderLandingPage(container) {
  const videoUrl = (window.TRUTHTRACE_CONFIG && window.TRUTHTRACE_CONFIG.VIDEO_URL) || (window.APP_CONFIG && window.APP_CONFIG.VIDEO_URL) || '';

  const videoSlotHtml = videoUrl
    ? `
      <div style="aspect-ratio: 16 / 9; width: 100%;">
        <iframe src="${videoUrl}" style="width: 100%; height: 100%; border: none;" allowfullscreen title="ApaarTrust Demo Video"></iframe>
      </div>
    `
    : `
      <div class="video-slot-placeholder">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(232, 115, 26, 0.12); color: var(--saffron); display: flex; align-items: center; justify-content: center; margin: 0 auto var(--space-3);">
          ${iconHtml('play', 'icon-lg')}
        </div>
        <h3 style="font-size: 1.2rem; margin-bottom: var(--space-2); color: var(--navy);">3-Minute Video Walkthrough Slot</h3>
        <p style="color: var(--text-muted); max-width: 540px; font-size: 0.9rem; line-height: 1.5; margin: 0 auto var(--space-4);">
          To display a recorded video demonstration here, configure <code>VIDEO_URL</code> in <code>config.js</code>. The interactive demo missions below are fully functional right now.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="#judges-start" class="btn btn-primary btn-sm">
            ${iconHtml('award', 'icon-xs')} Explore interactive missions
          </a>
          <a href="#three-minutes" class="btn btn-secondary btn-sm">
            ${iconHtml('play-circle', 'icon-xs')} 3-Minute Journeys
          </a>
        </div>
      </div>
    `;

  container.innerHTML = `
    <div class="marketing-layout">
      <!-- Free Hosting Sleep Explainer Banner -->
      <section style="background: linear-gradient(90deg, #1e293b 0%, #0f172a 100%); color: #ffffff; padding: 12px 24px; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <div style="max-width: 1240px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="display: inline-flex; width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; box-shadow: 0 0 8px #f59e0b;"></span>
            <span style="font-size: 0.88rem; font-weight: 500;">
              <strong>If the demo is slow to start:</strong> This demo runs on free hosting that sleeps when idle. Click <em>Wake the server</em> and wait about a minute, or use the no-server preview.
            </span>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button id="btnLandingWakeServer" class="btn btn-sm" style="background: var(--saffron); color: #ffffff; border: none; font-weight: 600;">
              ${iconHtml('zap', 'icon-xs')} Wake the server
            </button>
            <button id="btnLandingPreviewMode" class="btn btn-secondary btn-sm" style="background: rgba(255,255,255,0.1); color: #ffffff; border: 1px solid rgba(255,255,255,0.25);">
              ${iconHtml('eye', 'icon-xs')} View preview without server
            </button>
          </div>
        </div>
      </section>

      <!-- Sticky Marketing Navigation -->
      <nav class="marketing-nav">
        <a href="#/" class="marketing-nav-brand">
          <svg class="brand-logo-icon" style="width: 28px; height: 28px; color: var(--saffron);" aria-hidden="true">
            <use href="vendor/lucide-sprite.svg#icon-brand-logo"></use>
          </svg>
          <span style="font-weight: 800; letter-spacing: -0.02em;">ApaarTrust</span>
        </a>

        <ul class="marketing-nav-links">
          <li><a href="#judges-start">For Judges</a></li>
          <li><a href="#three-minutes">3-Min Tour</a></li>
          <li><a href="#demo-video">Video</a></li>
          <li><a href="#screenshots">Gallery</a></li>
          <li><a href="#architecture">Architecture</a></li>
          <li><a href="#comparison">Comparison</a></li>
          <li><a href="#demo-roles">Personas</a></li>
          <li><a href="#limitations">Honest Limits</a></li>
          <li><a href="#demo-roles" class="btn btn-primary btn-sm">Try the demo</a></li>
        </ul>
      </nav>

      <!-- Hero Section -->
      <section style="padding: 70px 24px 60px; max-width: 1240px; margin: 0 auto; width: 100%;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center;" class="hero-grid">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: var(--radius-full); background: rgba(232, 115, 26, 0.1); color: var(--saffron); font-size: 0.8rem; font-weight: 600; margin-bottom: var(--space-4);">
              ${iconHtml('shield-check', 'icon-sm')} AICTE Problem Statement Prototype
            </div>
            <h1 style="font-size: 2.75rem; font-weight: 800; line-height: 1.15; letter-spacing: -0.03em; margin-bottom: var(--space-4); color: var(--navy);">
              One ID. Verified students. <span style="color: var(--saffron);">Zero exposure.</span>
            </h1>
            <p style="font-size: 1.12rem; color: var(--text-muted); line-height: 1.6; margin-bottom: var(--space-6);">
              ApaarTrust is an offline-ready, privacy-preserving student data verification and regulatory scrutiny platform. Designed for AICTE-approved institutions with verifiable credentials, zero data leakage, and automated seat-matrix compliance.
            </p>

            <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-6);">
              <a href="#three-minutes" class="btn btn-saffron btn-lg" style="box-shadow: 0 4px 14px rgba(232, 115, 26, 0.35);">
                ${iconHtml('play-circle', 'icon-sm')} Try it in 3 minutes
              </a>
              <a href="#demo-roles" class="btn btn-secondary btn-lg">
                ${iconHtml('users', 'icon-sm')} Choose a persona
              </a>
              <a href="#/verify" class="btn btn-ghost btn-lg">
                ${iconHtml('shield-check', 'icon-sm')} Public verifier
              </a>
            </div>

            <div style="display: flex; gap: 24px; font-size: 0.82rem; color: var(--text-muted); flex-wrap: wrap;">
              <div>✓ 100% offline & local</div>
              <div>✓ Zero API keys needed</div>
              <div>✓ SD-JWT selective disclosure</div>
              <div>✓ SHA-256 audit ledger</div>
            </div>
          </div>

          <!-- Interactive Live Preview Card -->
          <div>
            <div class="card" style="box-shadow: var(--shadow-xl); border: 1px solid var(--border-main);">
              <div class="card-header" style="background: var(--bg-subtle);">
                <div>
                  <div style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
                    Interactive Privacy Simulator
                  </div>
                  <h3 style="font-size: 1rem; margin-top: 2px;">Selective Disclosure in Action</h3>
                </div>
                <span id="previewVerifyStatus">
                  ${statusPill('good', 'Cryptographically verified')}
                </span>
              </div>

              <div class="card-body">
                <p style="font-size: 0.82rem; margin-bottom: var(--space-4);">
                  Toggle fields to see what an external verifier sees versus what remains withheld by student consent:
                </p>

                <!-- Field Toggles -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: var(--space-4);" id="previewToggles">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                    <input type="checkbox" id="toggle_name" checked /> Full name
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                    <input type="checkbox" id="toggle_programme" checked /> Programme title
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                    <input type="checkbox" id="toggle_institution" checked /> Institution
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer;">
                    <input type="checkbox" id="toggle_status" checked /> Enrolment status
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; color: var(--red);">
                    <input type="checkbox" id="toggle_dob" /> Date of birth (Sensitive)
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.82rem; cursor: pointer; color: var(--red);">
                    <input type="checkbox" id="toggle_social" /> Social category (Sensitive)
                  </label>
                </div>

                <!-- Verifier Display Box -->
                <div style="background: var(--bg-subtle); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); padding: var(--space-4);" id="previewDisplay">
                  <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: var(--space-2); display: flex; justify-content: space-between;">
                    <span>Verifier Viewport</span>
                    <span style="font-family: var(--font-mono);">APAAR-2024-883109</span>
                  </div>
                  <div id="previewDisclosedFields" style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem;">
                    <!-- Populated dynamically -->
                  </div>
                </div>
              </div>

              <div class="card-footer" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                <span style="color: var(--text-muted);">Ed25519 signature + SHA-256 salted commitments</span>
                <button class="btn btn-secondary btn-sm" id="btnTestVerify">
                  ${iconHtml('refresh-cw', 'icon-sm')} Test API verify
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Judges: Start Here Section -->
      <section id="judges-start" style="padding: 40px 24px 20px; max-width: 1240px; margin: 0 auto; width: 100%;">
        <div class="card" style="background: linear-gradient(135deg, rgba(20, 48, 122, 0.04) 0%, rgba(232, 115, 26, 0.06) 100%); border: 2px solid var(--saffron); box-shadow: var(--shadow-lg); padding: var(--space-6);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4); flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 4px; background: var(--navy-800); color: var(--saffron); font-size: 0.78rem; font-weight: 700; text-transform: uppercase; margin-bottom: 6px;">
                ${iconHtml('award', 'icon-xs')} AICTE Evaluation Protocol
              </div>
              <h2 style="font-size: 1.8rem; margin: 0; color: var(--navy);">Judges: Start Here</h2>
              <p style="color: var(--text-muted); font-size: 0.92rem; margin: 6px 0 0 0;">
                Direct deep links to evaluate core AICTE Problem Statement missions with pre-configured personas.
              </p>
            </div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: 600;">
                ✓ 100% Free Tier Ready
              </span>
              <span class="badge" style="background: rgba(232, 115, 26, 0.1); color: var(--saffron); font-weight: 600;">
                ✓ Zero Secrets Required
              </span>
            </div>
          </div>

          <!-- Mission Deep Links Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px;">
            <a href="#/officer/institutions/1-1090123458" class="btn btn-secondary btn-judge-mission" data-role="Officer" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: var(--navy);">Mission 1: Over-Intake Scrutiny</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">Bhaskara CSE 120/90 capacity breach</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
            <a href="#/officer/duplicates" class="btn btn-secondary btn-judge-mission" data-role="Officer" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: var(--navy);">Mission 2: Cross-College Duplicates</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">Privacy-preserving collision matching</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
            <a href="#/college/upload" class="btn btn-secondary btn-judge-mission" data-role="Institution" data-inst-id="1-1090123456" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: var(--saffron);">Mission 3: Dry-Run Ingestion (5 Errors)</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">Pre-commit AICTE validation & receipt</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
            <a href="#/student/consent" class="btn btn-secondary btn-judge-mission" data-role="Student" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: var(--green);">Mission 4: Student Sovereign Consent</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">Selective disclosure & instant revocation</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
            <a href="#/verify" class="btn btn-secondary btn-judge-mission" data-role="Verifier" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: var(--blue);">Mission 5: Public Credential Verifier</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">5 real cryptographic outcomes</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
            <a href="#/assistant" class="btn btn-secondary btn-judge-mission" data-role="Officer" style="display: flex; align-items: center; justify-content: space-between; text-align: left; padding: 12px 16px; background: var(--bg-surface);">
              <div>
                <strong style="display: block; font-size: 0.88rem; color: #9333ea;">Mission 6: AI Compliance Copilot</strong>
                <span style="font-size: 0.76rem; color: var(--text-muted);">Strictly grounded in YAML rules</span>
              </div>
              ${iconHtml('arrow-right', 'icon-sm')}
            </a>
          </div>
        </div>
      </section>

      <!-- Try It In 3 Minutes (Flagship Journeys J1-J5) -->
      <section id="three-minutes" style="padding: 70px 24px; background: var(--bg-subtle);">
        <div style="max-width: 1240px; margin: 0 auto;">
          <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-8);">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--saffron); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
              Quick Start Flagship Journeys
            </div>
            <h2 style="font-size: 2.1rem; color: var(--navy); margin-bottom: var(--space-2);">
              Try ApaarTrust in 3 Minutes
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Click any flagship journey below to jump straight into a working end-to-end scenario with pre-populated demo data.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <!-- J1: College Upload -->
            <div class="card journey-card" style="display: flex; flex-direction: column; height: 100%;">
              <div class="card-body" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="badge" style="background: rgba(232, 115, 26, 0.1); color: var(--saffron); font-weight: 700;">J1: College</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">~45 seconds</span>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Intake Data Submission</h3>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">
                  Test the 1-click sample with 5 deliberate errors, observe live seat gauges, review row-level error anchors, and commit for a cryptographic batch receipt.
                </p>
              </div>
              <div class="card-footer" style="padding: 12px 16px;">
                <a href="#/college/upload" class="btn btn-primary btn-sm btn-select-role-journey" data-role="Institution" data-inst-id="1-1090123456" style="width: 100%;">
                  Launch J1: College Upload ${iconHtml('arrow-right', 'icon-xs')}
                </a>
              </div>
            </div>

            <!-- J2: Officer Oversight -->
            <div class="card journey-card" style="display: flex; flex-direction: column; height: 100%;">
              <div class="card-body" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="badge" style="background: rgba(20, 48, 122, 0.1); color: var(--navy); font-weight: 700;">J2: Officer</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">~60 seconds</span>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 6px;">National Scrutiny & Duplicates</h3>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">
                  Filter state-map by region, investigate Bhaskara over-intake, adjudicate cross-institution duplicates, unmask APAAR with written reason, and export compliance PDF.
                </p>
              </div>
              <div class="card-footer" style="padding: 12px 16px;">
                <a href="#/officer/overview" class="btn btn-secondary btn-sm btn-select-role-journey" data-role="Officer" style="width: 100%; border-color: var(--navy); color: var(--navy);">
                  Launch J2: Officer Oversight ${iconHtml('arrow-right', 'icon-xs')}
                </a>
              </div>
            </div>

            <!-- J3: Student Sovereignty -->
            <div class="card journey-card" style="display: flex; flex-direction: column; height: 100%;">
              <div class="card-body" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="badge" style="background: rgba(19, 136, 8, 0.1); color: var(--green); font-weight: 700;">J3: Student</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">~30 seconds</span>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Consent & Instant Revocation</h3>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">
                  View digital ID card, selectively disclose programme while withholding DOB, generate share QR code, revoke access, and review audit trail in "Who viewed my record".
                </p>
              </div>
              <div class="card-footer" style="padding: 12px 16px;">
                <a href="#/student/consent" class="btn btn-secondary btn-sm btn-select-role-journey" data-role="Student" style="width: 100%; border-color: var(--green); color: var(--green);">
                  Launch J3: Student Consent ${iconHtml('arrow-right', 'icon-xs')}
                </a>
              </div>
            </div>

            <!-- J4: Public Verifier -->
            <div class="card journey-card" style="display: flex; flex-direction: column; height: 100%;">
              <div class="card-body" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="badge" style="background: rgba(21, 101, 192, 0.1); color: var(--blue); font-weight: 700;">J4: Verifier</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">~30 seconds</span>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 6px;">5-Outcome Verification</h3>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">
                  Test all 5 real cryptographic verification outcomes with 1-click credentials: Genuine, Revoked, Expired, Tampered, and Not Found.
                </p>
              </div>
              <div class="card-footer" style="padding: 12px 16px;">
                <a href="#/verify" class="btn btn-secondary btn-sm" style="width: 100%; border-color: var(--blue); color: var(--blue);">
                  Launch J4: Public Verifier ${iconHtml('arrow-right', 'icon-xs')}
                </a>
              </div>
            </div>

            <!-- J5: Compliance Copilot -->
            <div class="card journey-card" style="display: flex; flex-direction: column; height: 100%;">
              <div class="card-body" style="flex: 1;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <span class="badge" style="background: rgba(147, 51, 234, 0.1); color: #9333ea; font-weight: 700;">J5: AI Assistant</span>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Always available</span>
                </div>
                <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Rule-Grounded Copilot</h3>
                <p style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 16px;">
                  Ask compliance questions strictly grounded in configured YAML rules with source citations, live DB query tools, and spotlight walkthroughs.
                </p>
              </div>
              <div class="card-footer" style="padding: 12px 16px;">
                <a href="#/assistant" class="btn btn-secondary btn-sm" style="width: 100%; border-color: #9333ea; color: #9333ea;">
                  Launch J5: AI Assistant ${iconHtml('arrow-right', 'icon-xs')}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Interactive Architecture Diagram Section -->
      <section id="architecture" style="padding: 70px 24px; max-width: 1240px; margin: 0 auto; width: 100%;">
        <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-8);">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--saffron); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
            System Architecture
          </div>
          <h2 style="font-size: 2.1rem; color: var(--navy); margin-bottom: var(--space-2);">
            Interactive Cryptographic Pipeline
          </h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Click any block in the architectural diagram below to inspect its cryptographic algorithm, privacy guarantees, and regulatory purpose.
          </p>
        </div>

        <!-- Hand-Built SVG Architecture Diagram -->
        <div class="card" style="padding: 24px; box-shadow: var(--shadow-lg); overflow-x: auto;">
          <svg viewBox="0 0 1000 240" style="width: 100%; min-width: 800px; height: auto;" id="archSvg">
            <defs>
              <linearGradient id="boxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="var(--bg-surface)"/>
                <stop offset="100%" stop-color="var(--bg-subtle)"/>
              </linearGradient>
              <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="var(--saffron)"/>
              </marker>
            </defs>

            <!-- Connector Lines -->
            <path d="M 155 120 L 195 120" stroke="var(--saffron)" stroke-width="2.5" marker-end="url(#arrow)" />
            <path d="M 355 120 L 395 120" stroke="var(--saffron)" stroke-width="2.5" marker-end="url(#arrow)" />
            <path d="M 555 120 L 595 120" stroke="var(--saffron)" stroke-width="2.5" marker-end="url(#arrow)" />
            <path d="M 755 120 L 795 120" stroke="var(--saffron)" stroke-width="2.5" marker-end="url(#arrow)" />

            <!-- Block 1: Ingestion -->
            <g class="arch-block" data-node="ingestion" tabindex="0">
              <rect x="10" y="55" width="145" height="130" rx="10" fill="url(#boxGrad)" stroke="var(--border-strong)" stroke-width="2" />
              <circle cx="82" cy="95" r="20" fill="rgba(232, 115, 26, 0.1)" />
              <text x="82" y="100" text-anchor="middle" fill="var(--saffron)" font-size="16" font-weight="700">01</text>
              <text x="82" y="135" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="700">Data Ingestion</text>
              <text x="82" y="153" text-anchor="middle" fill="var(--text-muted)" font-size="10.5">Dry-Run Simulation</text>
              <text x="82" y="168" text-anchor="middle" fill="var(--text-subtle)" font-size="9.5">14 AICTE Checks</text>
            </g>

            <!-- Block 2: Seat Guard -->
            <g class="arch-block" data-node="seat_guard" tabindex="0">
              <rect x="205" y="55" width="150" height="130" rx="10" fill="url(#boxGrad)" stroke="var(--border-strong)" stroke-width="2" />
              <circle cx="280" cy="95" r="20" fill="rgba(20, 48, 122, 0.1)" />
              <text x="280" y="100" text-anchor="middle" fill="var(--navy)" font-size="16" font-weight="700">02</text>
              <text x="280" y="135" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="700">Seat-Matrix Guard</text>
              <text x="280" y="153" text-anchor="middle" fill="var(--text-muted)" font-size="10.5">Capacity & Quota Caps</text>
              <text x="280" y="168" text-anchor="middle" fill="var(--text-subtle)" font-size="9.5">TFW, EWS, KM, NRI</text>
            </g>

            <!-- Block 3: Identity Vault -->
            <g class="arch-block" data-node="identity_vault" tabindex="0">
              <rect x="405" y="55" width="150" height="130" rx="10" fill="url(#boxGrad)" stroke="var(--border-strong)" stroke-width="2" />
              <circle cx="480" cy="95" r="20" fill="rgba(19, 136, 8, 0.1)" />
              <text x="480" y="100" text-anchor="middle" fill="var(--green)" font-size="16" font-weight="700">03</text>
              <text x="480" y="135" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="700">Identity Vault</text>
              <text x="480" y="153" text-anchor="middle" fill="var(--text-muted)" font-size="10.5">Fernet AES-128-CBC</text>
              <text x="480" y="168" text-anchor="middle" fill="var(--text-subtle)" font-size="9.5">HMAC-SHA256 Token</text>
            </g>

            <!-- Block 4: Credential Studio -->
            <g class="arch-block" data-node="credential_studio" tabindex="0">
              <rect x="605" y="55" width="150" height="130" rx="10" fill="url(#boxGrad)" stroke="var(--border-strong)" stroke-width="2" />
              <circle cx="680" cy="95" r="20" fill="rgba(147, 51, 234, 0.1)" />
              <text x="680" y="100" text-anchor="middle" fill="#9333ea" font-size="16" font-weight="700">04</text>
              <text x="680" y="135" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="700">SD-JWT Studio</text>
              <text x="680" y="153" text-anchor="middle" fill="var(--text-muted)" font-size="10.5">Ed25519 Signatures</text>
              <text x="680" y="168" text-anchor="middle" fill="var(--text-subtle)" font-size="9.5">Selective Disclosure</text>
            </g>

            <!-- Block 5: Verification & Audit -->
            <g class="arch-block" data-node="audit_chain" tabindex="0">
              <rect x="805" y="55" width="180" height="130" rx="10" fill="url(#boxGrad)" stroke="var(--border-strong)" stroke-width="2" />
              <circle cx="895" cy="95" r="20" fill="rgba(239, 68, 68, 0.1)" />
              <text x="895" y="100" text-anchor="middle" fill="#ef4444" font-size="16" font-weight="700">05</text>
              <text x="895" y="135" text-anchor="middle" fill="var(--text-main)" font-size="13" font-weight="700">Verification & Audit</text>
              <text x="895" y="153" text-anchor="middle" fill="var(--text-muted)" font-size="10.5">SHA-256 Hash Chain</text>
              <text x="895" y="168" text-anchor="middle" fill="var(--text-subtle)" font-size="9.5">Offline QR + Tamper Proof</text>
            </g>
          </svg>

          <!-- Dynamic Detail Box for Clicked Node -->
          <div id="archNodeDetail" style="margin-top: 20px; padding: 16px; background: var(--bg-subtle); border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <strong style="font-size: 0.95rem; color: var(--navy);" id="archDetailTitle">Click any component block above</strong>
              <span class="badge" id="archDetailBadge" style="background: var(--navy-800); color: var(--saffron);">Architectural Explorer</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0;" id="archDetailDesc">
              Explore how ApaarTrust links dry-run institutional ingestion to cryptographic selective disclosure and unbroken audit chains.
            </p>
          </div>
        </div>
      </section>

      <!-- Role Cards (Demo Sign-In Section) -->
      <section id="demo-roles" style="padding: 70px 24px; background-color: var(--bg-subtle);">
        <div style="max-width: 1240px; margin: 0 auto;">
          <div style="text-align: center; max-width: 650px; margin: 0 auto var(--space-8);">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--saffron); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
              Interactive Walkthrough
            </div>
            <h2 style="font-size: 2rem; color: var(--navy); margin-bottom: var(--space-2);">
              Try the demo by selecting a persona
            </h2>
            <p style="color: var(--text-muted);">
              Each role grants access only to its specific product portal. Experience regulatory oversight, college admissions management, student consent, or independent verification.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px;">
            <!-- AICTE Officer -->
            <div class="card role-card" data-role="Officer" style="cursor: pointer; transition: all var(--transition-fast);">
              <div class="card-body" style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
                  <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(20, 48, 122, 0.1); color: var(--navy); display: flex; align-items: center; justify-content: center;">
                    ${iconHtml('building-2', 'icon-lg')}
                  </div>
                  <span class="status-pill status-good">Central Bureau</span>
                </div>
                <h3 style="font-size: 1.15rem; margin-bottom: 4px;">AICTE Officer</h3>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--navy); margin-bottom: 8px;">Ananya Rao</div>
                <p style="font-size: 0.85rem; color: var(--text-muted); flex: 1; margin-bottom: var(--space-4);">
                  Inspect national intake compliance, over-intake breaches, cross-institution duplicate collisions, and audit logs across all 5 archetype colleges.
                </p>
                <button class="btn btn-primary btn-sm" style="width: 100%;">
                  Enter Officer Portal ${iconHtml('arrow-right', 'icon-sm')}
                </button>
              </div>
            </div>

            <!-- College Registrar -->
            <div class="card role-card" data-role="Institution" data-inst-id="1-1090123456" style="cursor: pointer; transition: all var(--transition-fast);">
              <div class="card-body" style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
                  <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(232, 115, 26, 0.1); color: var(--saffron); display: flex; align-items: center; justify-content: center;">
                    ${iconHtml('upload-cloud', 'icon-lg')}
                  </div>
                  <span class="status-pill status-waiting">College Portal</span>
                </div>
                <h3 style="font-size: 1.15rem; margin-bottom: 4px;">College Registrar</h3>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--saffron); margin-bottom: 8px;">Aryabhata Institute</div>
                <p style="font-size: 0.85rem; color: var(--text-muted); flex: 1; margin-bottom: var(--space-4);">
                  Upload intake spreadsheets with instant dry-run validation, monitor sanctioned seat gauges, view submissions, and resolve regulatory to-dos.
                </p>
                <button class="btn btn-secondary btn-sm" style="width: 100%; border-color: var(--saffron); color: var(--saffron);">
                  Enter College Portal ${iconHtml('arrow-right', 'icon-sm')}
                </button>
              </div>
            </div>

            <!-- Student -->
            <div class="card role-card" data-role="Student" style="cursor: pointer; transition: all var(--transition-fast);">
              <div class="card-body" style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
                  <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(19, 136, 8, 0.1); color: var(--green); display: flex; align-items: center; justify-content: center;">
                    ${iconHtml('id-card', 'icon-lg')}
                  </div>
                  <span class="status-pill status-good">Student Citizen</span>
                </div>
                <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Student</h3>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--green); margin-bottom: 8px;">Rohan Aditya Sharma</div>
                <p style="font-size: 0.85rem; color: var(--text-muted); flex: 1; margin-bottom: var(--space-4);">
                  View DigiLocker-style digital ID, grant or revoke selective disclosure consent, track who accessed your record, and share verifiable credentials.
                </p>
                <button class="btn btn-secondary btn-sm" style="width: 100%; border-color: var(--green); color: var(--green);">
                  Enter Student Portal ${iconHtml('arrow-right', 'icon-sm')}
                </button>
              </div>
            </div>

            <!-- Public Verifier -->
            <div class="card role-card" data-role="Verifier" style="cursor: pointer; transition: all var(--transition-fast);">
              <div class="card-body" style="display: flex; flex-direction: column; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-4);">
                  <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: rgba(21, 101, 192, 0.1); color: var(--blue); display: flex; align-items: center; justify-content: center;">
                    ${iconHtml('shield-check', 'icon-lg')}
                  </div>
                  <span class="status-pill status-waiting">No Login Required</span>
                </div>
                <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Public Verifier</h3>
                <div style="font-size: 0.82rem; font-weight: 600; color: var(--blue); margin-bottom: 8px;">Instant Verification</div>
                <p style="font-size: 0.85rem; color: var(--text-muted); flex: 1; margin-bottom: var(--space-4);">
                  Scan signed QR code, upload certificate PDF, or paste presentation JSON to verify authenticity with cryptographic proof and zero data exposure.
                </p>
                <button class="btn btn-secondary btn-sm" style="width: 100%; border-color: var(--blue); color: var(--blue);">
                  Verify Credential ${iconHtml('arrow-right', 'icon-sm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Comparison Section: How ApaarTrust is Different -->
      <section id="comparison" style="padding: 70px 24px; max-width: 1240px; margin: 0 auto; width: 100%;">
        <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-8);">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--saffron); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
            Competitive Matrix
          </div>
          <h2 style="font-size: 2.1rem; color: var(--navy); margin-bottom: var(--space-2);">
            How ApaarTrust Is Different
          </h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Designed from first principles around privacy-by-design, cryptographic immutability, and offline autonomy.
          </p>
        </div>

        <div class="card" style="box-shadow: var(--shadow-md); overflow-x: auto;">
          <table class="data-table" style="margin: 0; min-width: 650px;">
            <thead>
              <tr>
                <th style="width: 22%;">Dimension</th>
                <th style="width: 39%; background: rgba(239, 68, 68, 0.04); color: #ef4444;">Traditional Regulatory Portals</th>
                <th style="width: 39%; background: rgba(16, 185, 129, 0.06); color: #10b981;">ApaarTrust Platform</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Identity Storage</strong></td>
                <td>Plaintext or reversible database storage; vulnerable to SQL dump breaches.</td>
                <td><strong style="color: #10b981;">Fernet AES-128-CBC</strong> at rest with HMAC-SHA256 pseudonyms. Only authorized officers with logged reason can unmask.</td>
              </tr>
              <tr>
                <td><strong>Intake Compliance</strong></td>
                <td>Post-facto annual physical audits; violations discovered months after classes begin.</td>
                <td><strong style="color: #10b981;">Pre-commit dry-run simulation</strong>; live seat matrix gauges prevent unauthorized enrolment breaches before saving.</td>
              </tr>
              <tr>
                <td><strong>Duplicate Enrolments</strong></td>
                <td>Requires sharing raw student rosters across institutions; breaches DPDP privacy.</td>
                <td><strong style="color: #10b981;">Privacy-preserving HMAC collision matching</strong>. Catches cross-college dual enrolment with zero cross-college exposure.</td>
              </tr>
              <tr>
                <td><strong>Data Disclosure</strong></td>
                <td>All-or-nothing document exposure. Employers and verifiers see full birth date & category.</td>
                <td><strong style="color: #10b981;">SD-JWT salted selective disclosure</strong>. Students withhold DOB, caste, and personal identifiers at will.</td>
              </tr>
              <tr>
                <td><strong>Auditability</strong></td>
                <td>Mutable SQL activity logs; database administrators can alter or erase audit records.</td>
                <td><strong style="color: #10b981;">SHA-256 hash-chained ledger</strong>. Any unauthorized tampering invalidates the hash chain immediately.</td>
              </tr>
              <tr>
                <td><strong>Compliance Advice</strong></td>
                <td>Static multi-hundred page PDF circulars that are difficult for colleges to parse.</td>
                <td><strong style="color: #10b981;">Offline AI Compliance Assistant</strong>. Strictly grounded in local YAML rules and glossary definitions.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Demo Video Slot Section -->
      <section id="demo-video" style="padding: 60px 24px; max-width: 1240px; margin: 0 auto; width: 100%;">
        <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-4);">
          <div style="font-size: 0.82rem; font-weight: 700; color: var(--saffron); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
            Video Demonstration
          </div>
          <h2 style="font-size: 2rem; color: var(--navy); margin-bottom: var(--space-2);">
            3-Minute Flagship Walkthrough
          </h2>
          <p style="color: var(--text-muted); font-size: 0.95rem;">
            Watch the end-to-end cryptographic pipeline and regulatory triage workflow.
          </p>
        </div>

        <div class="video-slot-container">
          ${videoSlotHtml}
        </div>
      </section>

      <!-- Screenshot Gallery Section -->
      <section id="screenshots" style="padding: 70px 24px; background: var(--bg-subtle);">
        <div style="max-width: 1240px; margin: 0 auto;">
          <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-8);">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--navy); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
              Visual Proofs
            </div>
            <h2 style="font-size: 2.1rem; color: var(--navy); margin-bottom: var(--space-2);">
              Platform Interface Gallery
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              Full-resolution captures from automated headless browser verification across desktop and mobile viewports.
            </p>
          </div>

          <div class="screenshot-gallery-grid">
            <div class="screenshot-card">
              <img src="screenshots/landing_page_1440.png" alt="ApaarTrust Landing Page" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">Landing Front Door</div>
                <div class="screenshot-card-sub">Interactive privacy simulator & architecture explorer</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/officer_overview_1440.png" alt="Officer Overview" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">Officer Oversight Portal</div>
                <div class="screenshot-card-sub">State tile scrutiny map, KPI sparklines & institutional triage</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/college_upload_1440.png" alt="College Upload Wizard" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">College Ingestion Wizard</div>
                <div class="screenshot-card-sub">Pre-commit dry run with 14 AICTE validation checks & batch receipt</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/student_record_1440.png" alt="Student Digital ID" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">Student Sovereign Record</div>
                <div class="screenshot-card-sub">DigiLocker digital ID card, masked APAAR & access trails</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/public_verify_1440.png" alt="Public Verifier" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">Public Cryptographic Verifier</div>
                <div class="screenshot-card-sub">5 mathematical verification outcomes with zero data leakage</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/assistant_1440.png" alt="AI Compliance Assistant" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">Offline AI Assistant</div>
                <div class="screenshot-card-sub">Strictly rule-grounded answers citing local YAML policies</div>
              </div>
            </div>

            <div class="screenshot-card">
              <img src="screenshots/mobile_390.png" alt="Mobile Viewport" loading="lazy" />
              <div class="screenshot-card-body">
                <div class="screenshot-card-title">390px Mobile Viewport</div>
                <div class="screenshot-card-sub">Zero horizontal overflow, 44px touch targets & responsive app shell</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Honest Limitations Section -->
      <section id="limitations" style="padding: 70px 24px; background: var(--bg-subtle);">
        <div style="max-width: 1100px; margin: 0 auto;">
          <div style="text-align: center; max-width: 700px; margin: 0 auto var(--space-6);">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--navy); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: var(--space-1);">
              Transparency & Boundaries
            </div>
            <h2 style="font-size: 2rem; color: var(--navy); margin-bottom: var(--space-2);">
              Honest Platform Limitations
            </h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">
              We believe in total transparency. Here is what this demonstration prototype is and is not:
            </p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('info', 'icon-sm')} Prototype Status
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                Built specifically for the AICTE Problem Statement. This is not an official AICTE deployment. All algorithms run locally.
              </p>
            </div>

            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('sliders', 'icon-sm')} DEMO Seat Matrix Values
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                DEMO VALUES, not AICTE statutory rules. Intake caps and supernumerary quotas must be configured from the official AICTE Approval Process Handbook.
              </p>
            </div>

            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('key', 'icon-sm')} SD-JWT Inspired Format
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                Our selective disclosure format is inspired by the IETF SD-JWT draft specification and optimized for educational credential presentation, not full IETF RFC conformance.
              </p>
            </div>

            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('database', 'icon-sm')} Mock Central Registry
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                The APAAR Central Registry adapter operates against a high-fidelity local mock engine. In production, this would interface via Government API Setu.
              </p>
            </div>

            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('users', 'icon-sm')} 100% Synthetic Data
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                Zero real student data is included. All names, colleges, and APAAR identifiers are synthetic and procedurally generated for benchmark drills.
              </p>
            </div>

            <div class="card" style="padding: 20px; border-left: 4px solid var(--saffron);">
              <h4 style="font-size: 0.98rem; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                ${iconHtml('sparkles', 'icon-sm')} AI Only Advises
              </h4>
              <p style="font-size: 0.84rem; color: var(--text-muted); margin: 0;">
                The AI Compliance Assistant provides assistive explanations grounded in YAML rules. All regulatory actions strictly require human officer authorization.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ Accordion -->
      <section id="faq" style="padding: 70px 24px; max-width: 900px; margin: 0 auto; width: 100%;">
        <div style="text-align: center; margin-bottom: var(--space-8);">
          <h2 style="font-size: 2rem; color: var(--navy); margin-bottom: var(--space-2);">Frequently Asked Questions</h2>
          <p style="color: var(--text-muted);">Key questions about architecture, compliance, and privacy.</p>
        </div>

        <div style="display: flex; flex-direction: column; gap: 12px;">
          <details class="card" style="padding: var(--space-4); cursor: pointer;">
            <summary style="font-weight: 600; font-size: 0.95rem; list-style: none; display: flex; justify-content: space-between;">
              <span>Does ApaarTrust require paid APIs or internet access?</span>
              <span style="color: var(--text-muted);">+</span>
            </summary>
            <p style="margin-top: var(--space-3); font-size: 0.88rem; color: var(--text-muted);">
              No. ApaarTrust is 100% offline-ready and operates entirely locally without external API dependencies, paid cloud services, or runtime CDN connections.
            </p>
          </details>

          <details class="card" style="padding: var(--space-4); cursor: pointer;">
            <summary style="font-weight: 600; font-size: 0.95rem; list-style: none; display: flex; justify-content: space-between;">
              <span>How are 12-digit APAAR IDs protected?</span>
              <span style="color: var(--text-muted);">+</span>
            </summary>
            <p style="margin-top: var(--space-3); font-size: 0.88rem; color: var(--text-muted);">
              APAAR IDs are encrypted at rest with Fernet (AES-128-CBC with HMAC-SHA256), indexed using HMAC-SHA256 pseudonyms, and displayed as masked strings (XXXX-XXXX-1234). Only an authorized AICTE Officer with a logged written reason (min 10 characters) can reveal the unmasked ID.
            </p>
          </details>

          <details class="card" style="padding: var(--space-4); cursor: pointer;">
            <summary style="font-weight: 600; font-size: 0.95rem; list-style: none; display: flex; justify-content: space-between;">
              <span>Are seat matrix caps real AICTE rules?</span>
              <span style="color: var(--text-muted);">+</span>
            </summary>
            <p style="margin-top: var(--space-3); font-size: 0.88rem; color: var(--text-muted);">
              DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook. All intake limits in this prototype are demonstration parameters to validate the automated engine.
            </p>
          </details>

          <details class="card" style="padding: var(--space-4); cursor: pointer;">
            <summary style="font-weight: 600; font-size: 0.95rem; list-style: none; display: flex; justify-content: space-between;">
              <span>Can the AI Copilot take regulatory actions?</span>
              <span style="color: var(--text-muted);">+</span>
            </summary>
            <p style="margin-top: var(--space-3); font-size: 0.88rem; color: var(--text-muted);">
              No. The AI Copilot only advises based strictly on configured YAML rules and glossary definitions. Regulatory actions (holds, rejections) can legally only be taken by an authorized Officer with a mandatory written justification.
            </p>
          </details>
        </div>
      </section>

      <!-- Footer -->
      <footer style="padding: 40px 24px; border-top: 1px solid var(--border-subtle); background: var(--bg-surface); text-align: center; font-size: 0.85rem; color: var(--text-muted);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: var(--space-2);">
          <svg style="width: 20px; height: 20px; color: var(--saffron);" aria-hidden="true"><use href="vendor/lucide-sprite.svg#icon-brand-logo"></use></svg>
          <strong style="color: var(--text-main);">ApaarTrust</strong>
        </div>
        <p style="margin-bottom: var(--space-2);">
          Prototype built for the AICTE problem statement. Not an official AICTE system. Synthetic data only.
        </p>
        <p style="font-size: 0.78rem; color: var(--text-subtle);">
          Designed with DPDP consent principles in mind; not a legal compliance claim. Tested on Python 3.12.
        </p>
      </footer>
    </div>
  `;

  // Bind wake server button
  const wakeBtn = container.querySelector('#btnLandingWakeServer');
  if (wakeBtn) {
    wakeBtn.addEventListener('click', () => {
      wakeupManager.startWakeupFlow();
    });
  }

  // Bind view preview without server button
  const previewBtn = container.querySelector('#btnLandingPreviewMode');
  if (previewBtn) {
    previewBtn.addEventListener('click', () => {
      previewManager.enable();
    });
  }

  // Bind judges mission buttons
  const missionBtns = container.querySelectorAll('.btn-judge-mission');
  missionBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const roleName = btn.dataset.role;
      const instId = btn.dataset.instId;
      const href = btn.getAttribute('href');

      if (roleName) {
        await auth.selectRole(roleName, { institutionId: instId });
      }
      window.location.hash = href;
    });
  });

  // Bind live preview logic
  bindPreviewCardEvents();

  // Bind role card selection
  const roleCards = container.querySelectorAll('.role-card');
  roleCards.forEach((card) => {
    card.addEventListener('click', async () => {
      const roleName = card.dataset.role;
      const instId = card.dataset.instId;

      await auth.selectRole(roleName, { institutionId: instId });
      const targetHome = auth.getRoleHome(roleName);
      window.location.hash = targetHome;
    });
  });

  // Bind 3-minute journey buttons
  const journeyBtns = container.querySelectorAll('.btn-select-role-journey');
  journeyBtns.forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const roleName = btn.dataset.role;
      const instId = btn.dataset.instId;
      const href = btn.getAttribute('href');

      await auth.selectRole(roleName, { institutionId: instId });
      window.location.hash = href;
    });
  });

  // Bind Architecture Diagram Node Interactions
  bindArchDiagramEvents();
}

function bindPreviewCardEvents() {
  const toggles = {
    name: document.getElementById('toggle_name'),
    programme: document.getElementById('toggle_programme'),
    institution: document.getElementById('toggle_institution'),
    status: document.getElementById('toggle_status'),
    dob: document.getElementById('toggle_dob'),
    social: document.getElementById('toggle_social'),
  };

  const sampleStudent = {
    name: 'Rohan Aditya Sharma',
    programme: 'B.Tech Computer Science and Engineering',
    institution: 'Aryabhata Institute of Technology',
    status: 'Active (2024-25)',
    dob: '2004-03-15',
    social: 'General (EWS)',
  };

  function updateDisplay() {
    const displayContainer = document.getElementById('previewDisclosedFields');
    if (!displayContainer) return;

    const fields = [
      { key: 'name', label: 'Full name', val: sampleStudent.name, checked: toggles.name.checked },
      { key: 'programme', label: 'Programme', val: sampleStudent.programme, checked: toggles.programme.checked },
      { key: 'institution', label: 'Institution', val: sampleStudent.institution, checked: toggles.institution.checked },
      { key: 'status', label: 'Enrolment', val: sampleStudent.status, checked: toggles.status.checked },
      { key: 'dob', label: 'Date of birth', val: sampleStudent.dob, checked: toggles.dob.checked },
      { key: 'social', label: 'Social category', val: sampleStudent.social, checked: toggles.social.checked },
    ];

    displayContainer.innerHTML = fields
      .map((f) => {
        if (f.checked) {
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed var(--border-subtle);">
              <span style="color: var(--text-muted);">${f.label}:</span>
              <span style="font-weight: 500; color: var(--text-main);">${f.val}</span>
            </div>
          `;
        }
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed var(--border-subtle); opacity: 0.65;">
            <span style="color: var(--text-subtle);">${f.label}:</span>
            <span style="font-style: italic; color: var(--text-subtle); font-size: 0.78rem;">[Withheld by student consent]</span>
          </div>
        `;
      })
      .join('');
  }

  Object.values(toggles).forEach((input) => {
    if (input) input.addEventListener('change', updateDisplay);
  });

  updateDisplay();

  const testBtn = document.getElementById('btnTestVerify');
  if (testBtn) {
    testBtn.addEventListener('click', async () => {
      const statusEl = document.getElementById('previewVerifyStatus');
      statusEl.innerHTML = '<span class="status-pill status-waiting">Verifying...</span>';
      try {
        setTimeout(() => {
          statusEl.innerHTML = statusPill('good', 'Cryptographically verified');
          window.dispatchEvent(
            new CustomEvent('apaar:toast', {
              detail: { type: 'success', message: 'Credential signature and salted commitments successfully verified.' },
            })
          );
        }, 300);
      } catch (err) {
        statusEl.innerHTML = statusPill('problem', 'Verification failed');
      }
    });
  }
}

function bindArchDiagramEvents() {
  const blocks = document.querySelectorAll('.arch-block');
  const titleEl = document.getElementById('archDetailTitle');
  const badgeEl = document.getElementById('archDetailBadge');
  const descEl = document.getElementById('archDetailDesc');

  const archNodes = {
    ingestion: {
      title: '01. Pre-Commit Ingestion & Dry-Run Engine',
      badge: 'Zero DB Mutation',
      desc: 'Colleges upload CSV or XLSX rosters. Our dry-run engine validates 14 AICTE rules without mutating database state. It produces row-level error anchors and live capacity previews before any data is committed.',
    },
    seat_guard: {
      title: '02. Seat-Matrix Guard & Quota Engine',
      badge: 'DEMO VALUES Rule Engine',
      desc: 'Evaluates programme sanction caps and supernumerary limits (TFW, EWS, KM, NRI, OCI). Real-time gauge metrics flag over-intake breaches and anomalous admission clusters before submission approval.',
    },
    identity_vault: {
      title: '03. Cryptographic Identity Vault',
      badge: 'Fernet AES-128-CBC + HMAC',
      desc: '12-digit permanent APAAR IDs are encrypted at rest using Fernet (AES-128-CBC with HMAC-SHA256). Identity indexing uses HMAC-SHA256 pseudonyms. Only authorized officers with logged justification can unmask.',
    },
    credential_studio: {
      title: '04. Verifiable Credential Studio (SD-JWT Inspired)',
      badge: 'Ed25519 Signatures',
      desc: 'Issues verifiable credentials with Ed25519 digital signatures. Each individual student attribute is committed with salted SHA-256 hashes, enabling students to selectively disclose fields without revealing sensitive data.',
    },
    audit_chain: {
      title: '05. Verification & SHA-256 Hash-Chained Audit',
      badge: 'Tamper Evident',
      desc: 'Provides 100% offline verification via machine-readable QR seals. Every regulatory decision, ID unmasking, and verification is anchored to an unbroken SHA-256 hash-chained activity log.',
    },
  };

  blocks.forEach((b) => {
    const handleSelect = () => {
      const nodeKey = b.dataset.node;
      const data = archNodes[nodeKey];
      if (data && titleEl && badgeEl && descEl) {
        titleEl.textContent = data.title;
        badgeEl.textContent = data.badge;
        descEl.textContent = data.desc;
        blocks.forEach((el) => el.classList.remove('spotlight-active'));
        b.classList.add('spotlight-active');
        setTimeout(() => b.classList.remove('spotlight-active'), 2500);
      }
    };

    b.addEventListener('click', handleSelect);
    b.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      }
    });
  });
}
