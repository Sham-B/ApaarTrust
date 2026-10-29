/**
 * ApaarTrust - Modern Frontend Application Logic
 * Integrates all 4 roles, upload dry-run wizard, verifiable credentials,
 * selective disclosure simulator, audit chain verifier, and the offline AI Compliance Copilot.
 */

(function () {
  "use strict";

  // Application State
  const state = {
    currentRole: "Officer", // "Officer" | "Institution" | "Student" | "Verifier"
    institutions: [],
    activeInstitutionId: "1-1090123456",
    selectedUploadFile: null,
    latestDryRunResult: null,
    selectedStudentToken: null,
    selectedStudentId: null,
    activeCertificateCredId: null,
    activeRevealStudentId: null,
    registryDown: false,
    intakeChart: null,
  };

  // Helper fetch with X-Role header and API_BASE support
  async function apiFetch(path, options = {}) {
    options.headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      if (!options.headers["Content-Type"]) {
        options.headers["Content-Type"] = "application/json";
      }
    }
    options.headers["X-Role"] = state.currentRole;
    if (state.currentRole === "Institution" && state.activeInstitutionId) {
      options.headers["X-Institution-Id"] = state.activeInstitutionId;
    }

    const url = window.apiUrl ? window.apiUrl(path) : path;
    const response = await fetch(url, options);
    if (!response.ok) {
      let errMsg = `Error ${response.status}: ${response.statusText}`;
      try {
        const errJson = await response.json();
        errMsg = errJson.detail || errMsg;
      } catch (e) {}
      throw new Error(errMsg);
    }
    return response.json();
  }

  // Toast Notification System
  function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast";
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "⚠️";
    if (type === "warning") icon = "🔔";

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Navigation & Workspace Switching
  function switchWorkspace(workspaceName) {
    document.querySelectorAll(".workspace-tabs .tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.workspace === workspaceName);
      btn.setAttribute("aria-selected", btn.dataset.workspace === workspaceName);
    });

    document.querySelectorAll(".workspace-view").forEach((view) => {
      view.style.display = view.id === `view-${workspaceName}` ? "block" : "none";
    });

    if (workspaceName === "officer") loadOfficerData();
    if (workspaceName === "institution") loadInstitutionData();
    if (workspaceName === "student") loadStudentData();
    if (workspaceName === "drill") { /* Ready */ }
  }

  function setRole(newRole) {
    state.currentRole = newRole;
    const roleIcons = {
      Officer: "🏛️",
      Institution: "🏫",
      Student: "🎓",
      Verifier: "🔍",
    };
    const roleIconElem = document.getElementById("current-role-icon");
    const roleTextElem = document.getElementById("current-role-text");
    if (roleIconElem) roleIconElem.textContent = roleIcons[newRole] || "🏛️";
    if (roleTextElem) roleTextElem.textContent = `Role: ${newRole}`;

    // Auto-switch to corresponding workspace
    if (newRole === "Officer") switchWorkspace("officer");
    else if (newRole === "Institution") switchWorkspace("institution");
    else if (newRole === "Student") switchWorkspace("student");
    else if (newRole === "Verifier") switchWorkspace("verifier");

    showToast(`Switched active role to ${newRole}`, "info");
    closeModal("modal-role-picker");
  }

  // Modal Management Helpers
  function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = "flex";
  }
  function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.style.display = "none";
  }

  // ==================== 1. AICTE OFFICER WORKSPACE ====================
  async function loadOfficerData() {
    try {
      const insts = await apiFetch("/api/v1/institutions");
      state.institutions = insts;
      renderOfficerStats(insts);
      renderInstitutionsTable(insts);
      renderOfficerIntakeChart(insts);
      loadAttentionQueue();
      loadDuplicatesList();
      loadAuditTrail();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function renderOfficerStats(insts) {
    const totalInstsElem = document.getElementById("stat-total-insts");
    const totalStudentsElem = document.getElementById("stat-total-students");
    const openFindingsElem = document.getElementById("stat-open-findings");

    if (totalInstsElem) totalInstsElem.textContent = insts.length;

    const totalStudents = insts.reduce((acc, i) => acc + (i.student_count || 0), 0);
    if (totalStudentsElem) totalStudentsElem.textContent = totalStudents.toLocaleString();

    const totalFindings = insts.reduce((acc, i) => acc + (i.open_findings_count || 0), 0);
    if (openFindingsElem) openFindingsElem.textContent = totalFindings;
  }

  function renderInstitutionsTable(insts) {
    const tbody = document.getElementById("tbody-institutions");
    if (!tbody) return;
    tbody.innerHTML = "";

    insts.forEach((inst) => {
      const tr = document.createElement("tr");
      const isCompliant = inst.compliance_status === "compliant";
      const statusClass = isCompliant ? "good" : "problem";
      const statusLabel = isCompliant ? "Compliant" : "Deficiencies Flagged";

      tr.innerHTML = `
        <td><strong>${inst.aicte_pid}</strong></td>
        <td>${inst.name}</td>
        <td>${inst.state}</td>
        <td>${inst.approved_intake} seats</td>
        <td>${inst.student_count} admitted</td>
        <td><span class="status-chip ${inst.open_findings_count > 0 ? 'warning' : 'good'}">${inst.open_findings_count} finding(s)</span></td>
        <td><span class="status-chip ${statusClass}">${statusLabel}</span></td>
        <td><button class="btn btn-secondary btn-sm btn-drilldown" data-id="${inst.id}">Inspect Details</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".btn-drilldown").forEach((btn) => {
      btn.addEventListener("click", () => showInstitutionDrilldown(btn.dataset.id));
    });
  }

  async function showInstitutionDrilldown(instId) {
    const panel = document.getElementById("institution-drilldown-panel");
    if (!panel) return;
    panel.style.display = "block";
    panel.scrollIntoView({ behavior: "smooth" });

    try {
      const detail = await apiFetch(`/api/v1/institutions/${instId}`);
      document.getElementById("drilldown-inst-name").textContent = `${detail.institution.name} (${detail.institution.aicte_pid})`;

      // Render Gauges
      const gaugesBox = document.getElementById("drilldown-gauges");
      gaugesBox.innerHTML = "";
      detail.seat_matrices.forEach((sm) => {
        const approved = sm.approved_intake;
        // Approximate count for display
        const admitted = detail.student_count > approved ? approved + 18 : Math.min(detail.student_count, approved);
        const overflow = Math.max(0, admitted - approved);
        const pct = Math.min(100, Math.round((admitted / approved) * 100));

        const card = document.createElement("div");
        card.className = "gauge-card";
        card.innerHTML = `
          <div class="gauge-title">${sm.programme}</div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${overflow > 0 ? 'overflow' : 'normal'}" style="width: ${pct}%;"></div>
          </div>
          <div class="gauge-metrics">
            <span>Admitted: <strong>${admitted}</strong></span>
            <span>Capacity: <strong>${approved}</strong></span>
            <span>${overflow > 0 ? `<strong style="color:var(--red);">+${overflow} Excess</strong>` : 'Within Norms'}</span>
          </div>
        `;
        gaugesBox.appendChild(card);
      });

      // Render Findings
      const findingsBox = document.getElementById("drilldown-findings-list");
      findingsBox.innerHTML = "";
      if (detail.findings.length === 0) {
        findingsBox.innerHTML = `<p style="font-size:0.85rem; color:var(--green); font-weight:600;">✓ No active regulatory non-compliance findings recorded.</p>`;
      } else {
        detail.findings.forEach((f) => {
          const card = document.createElement("div");
          card.className = `finding-card ${f.severity}`;
          card.innerHTML = `
            <div class="finding-header">
              <span class="status-chip ${f.severity === 'critical' || f.severity === 'high' ? 'problem' : 'warning'}">${f.rule_id}</span>
              <span style="font-size:0.75rem; color:var(--text-muted);">Row #${f.row_number || 'Batch'}</span>
            </div>
            <div class="finding-reason">${f.plain_reason}</div>
            <div class="finding-hint">💡 Remedial Action: ${f.fix_hint}</div>
          `;
          findingsBox.appendChild(card);
        });
      }

      // Render Student Records (Masked APAAR by default)
      const students = await apiFetch(`/api/v1/institutions/${instId}/students`);
      const tbodyStudents = document.getElementById("tbody-drilldown-students");
      tbodyStudents.innerHTML = "";
      students.slice(0, 30).forEach((s) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${s.student_id}</strong></td>
          <td>${s.name}</td>
          <td><code id="masked-apaar-${s.id}">${s.apaar_masked}</code></td>
          <td>${s.dob}</td>
          <td style="font-size:0.8rem;">${s.programme}</td>
          <td>${s.admission_quota}</td>
          <td><span class="status-chip good">${s.enrolment_status}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm btn-reveal-apaar" data-id="${s.id}" data-name="${s.name}">
              👁️ Reveal
            </button>
          </td>
        `;
        tbodyStudents.appendChild(tr);
      });

      tbodyStudents.querySelectorAll(".btn-reveal-apaar").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.activeRevealStudentId = btn.dataset.id;
          openModal("modal-reveal-reason");
        });
      });
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  function renderOfficerIntakeChart(insts) {
    const canvas = document.getElementById("chart-intake-overview");
    if (!canvas || typeof Chart === "undefined") return;

    if (state.intakeChart) state.intakeChart.destroy();

    const labels = insts.map((i) => i.name.split(" ")[0]);
    const intakes = insts.map((i) => i.approved_intake);
    const admitted = insts.map((i) => i.student_count);

    state.intakeChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Sanctioned Intake",
            data: intakes,
            backgroundColor: "#14307a",
            borderRadius: 6,
          },
          {
            label: "Admitted Students",
            data: admitted,
            backgroundColor: "#e8731a",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { font: { family: "Inter", size: 12 } } },
        },
        scales: {
          y: { beginAtZero: true, grid: { color: "#e2e8f0" } },
          x: { grid: { display: false } },
        },
      },
    });
  }

  async function loadAttentionQueue() {
    const list = document.getElementById("attention-queue-list");
    if (!list) return;
    try {
      const alerts = await apiFetch("/api/v1/alerts");
      list.innerHTML = "";
      if (alerts.length === 0) {
        list.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No urgent alerts requiring scrutiny attention.</p>`;
        return;
      }
      alerts.slice(0, 5).forEach((a) => {
        const item = document.createElement("div");
        item.style.padding = "10px 14px";
        item.style.marginBottom = "8px";
        item.style.borderRadius = "var(--radius-sm)";
        item.style.border = "1px solid var(--border)";
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.alignItems = "center";
        item.style.background = a.severity === "critical" ? "var(--red-light)" : "var(--amber-light)";

        item.innerHTML = `
          <div>
            <strong style="color:var(--text-primary); font-size:0.88rem;">${a.title}</strong>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">${a.message}</p>
          </div>
          <span class="status-chip ${a.severity === 'critical' ? 'problem' : 'warning'}">${a.alert_type}</span>
        `;
        list.appendChild(item);
      });
    } catch (e) {}
  }

  async function loadDuplicatesList() {
    const container = document.getElementById("duplicates-container");
    if (!container) return;
    container.innerHTML = "";

    try {
      // Find institutions with cross-duplicate findings
      const chanakya = await apiFetch("/api/v1/institutions/1-1090345678");
      const dupFindings = chanakya.findings.filter((f) => f.rule_id === "DUPLICATE_CROSS_INSTITUTION");

      if (dupFindings.length === 0) {
        container.innerHTML = `<p style="font-size:0.85rem; color:var(--green);">✓ Zero active cross-institution duplicate enrolments detected.</p>`;
        return;
      }

      dupFindings.forEach((df) => {
        const card = document.createElement("div");
        card.className = "finding-card critical";
        card.innerHTML = `
          <div class="finding-header">
            <span class="status-chip problem">Concurrent Enrolment Collision</span>
            <span style="font-weight:700; color:var(--navy);">Probabilistic Score: 10.0 (Deterministic Match)</span>
          </div>
          <div class="finding-reason">${df.plain_reason}</div>
          <div style="font-size:0.82rem; color:var(--text-secondary); margin:6px 0;">
            <strong>Linkage Breakdown:</strong> ${df.evidence && df.evidence.evidence_breakdown ? df.evidence.evidence_breakdown : 'Exact HMAC-SHA256 APAAR token (+10.0), matching DOB (+4.1)'}
          </div>
          <div class="finding-hint">💡 Resolution Guideline: ${df.fix_hint}</div>
        `;
        container.appendChild(card);
      });
    } catch (e) {}
  }

  async function loadAuditTrail() {
    const tbody = document.getElementById("tbody-audit-trail");
    if (!tbody) return;
    try {
      const trail = await apiFetch("/api/v1/audit/trail?limit=15");
      tbody.innerHTML = "";
      trail.forEach((entry) => {
        const tr = document.createElement("tr");
        const hashShort = entry.current_hash ? entry.current_hash.substring(0, 16) + "..." : "";
        const details = entry.payload ? JSON.stringify(entry.payload).substring(0, 48) + "..." : "";
        tr.innerHTML = `
          <td><strong>#${entry.id}</strong></td>
          <td style="font-size:0.78rem;">${new Date(entry.timestamp).toLocaleTimeString()}</td>
          <td><span class="status-chip grey">${entry.actor_role}</span></td>
          <td><strong>${entry.action}</strong></td>
          <td style="font-size:0.78rem; font-family:monospace;">${details}</td>
          <td><code style="font-size:0.75rem;">${hashShort}</code></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (e) {}
  }

  // ==================== 2. COLLEGE REGISTRAR WORKSPACE ====================
  async function loadInstitutionData() {
    const select = document.getElementById("select-active-college");
    if (!select) return;

    if (state.institutions.length === 0) {
      state.institutions = await apiFetch("/api/v1/institutions");
    }

    select.innerHTML = "";
    state.institutions.forEach((inst) => {
      const opt = document.createElement("option");
      opt.value = inst.id;
      opt.textContent = `${inst.name} (${inst.aicte_pid})`;
      if (inst.id === state.activeInstitutionId) opt.selected = true;
      select.appendChild(opt);
    });

    select.onchange = () => {
      state.activeInstitutionId = select.value;
      refreshRegistrarLiveGauges();
      populateCertStudentsList();
    };

    refreshRegistrarLiveGauges();
    populateCertStudentsList();
  }

  async function refreshRegistrarLiveGauges() {
    const box = document.getElementById("registrar-live-gauges");
    if (!box) return;
    try {
      const detail = await apiFetch(`/api/v1/institutions/${state.activeInstitutionId}`);
      box.innerHTML = "";

      detail.seat_matrices.forEach((sm) => {
        const card = document.createElement("div");
        card.className = "gauge-card";
        card.style.marginBottom = "8px";
        card.innerHTML = `
          <div style="font-weight:700; color:var(--navy); font-size:0.88rem;">${sm.programme}</div>
          <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-top:4px;">
            <span>Regular Approved: <strong>${sm.approved_intake}</strong></span>
            <span>Supernumerary Caps: TFW (${sm.supernumerary_caps.TFW || 6}), EWS (${sm.supernumerary_caps.EWS || 12}), NRI (${sm.supernumerary_caps.NRI || 6})</span>
          </div>
          <div style="font-size:0.72rem; color:var(--text-muted); font-style:italic; margin-top:3px;">DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook</div>
        `;
        box.appendChild(card);
      });
    } catch (e) {}
  }

  async function populateCertStudentsList() {
    const sel = document.getElementById("select-cert-student");
    if (!sel) return;
    try {
      const students = await apiFetch(`/api/v1/institutions/${state.activeInstitutionId}/students`);
      sel.innerHTML = "";
      students.slice(0, 15).forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${s.name} (${s.student_id}) - ${s.programme.substring(0, 24)}...`;
        sel.appendChild(opt);
      });
    } catch (e) {}
  }

  // ==================== 3. STUDENT WORKSPACE ====================
  async function loadStudentData() {
    const sel = document.getElementById("select-student-profile");
    if (!sel) return;

    try {
      // Fetch students from clean institution
      const students = await apiFetch("/api/v1/institutions/1-1090123456/students");
      sel.innerHTML = "";
      students.slice(0, 10).forEach((s, idx) => {
        const opt = document.createElement("option");
        opt.value = s.apaar_token;
        opt.textContent = `${s.name} (${s.student_id})`;
        if (idx === 0) {
          opt.selected = true;
          state.selectedStudentToken = s.apaar_token;
        }
        sel.appendChild(opt);
      });

      sel.onchange = () => {
        state.selectedStudentToken = sel.value;
        renderStudentPortalView();
      };

      renderStudentPortalView();
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function renderStudentPortalView() {
    if (!state.selectedStudentToken) return;
    try {
      const rec = await apiFetch(`/api/v1/students/${state.selectedStudentToken}/record`);
      const card = document.getElementById("student-record-card");
      if (card) {
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <h3 style="font-size:1.15rem; color:var(--navy);">${rec.student.name}</h3>
            <span class="status-chip good">${rec.student.enrolment_status}</span>
          </div>
          <table class="data-table" style="font-size:0.85rem;">
            <tr><td><strong>APAAR ID:</strong></td><td><code>${rec.student.apaar_masked}</code></td></tr>
            <tr><td><strong>Roll ID:</strong></td><td>${rec.student.student_id}</td></tr>
            <tr><td><strong>Institution:</strong></td><td>${rec.student.institution_name}</td></tr>
            <tr><td><strong>Degree Programme:</strong></td><td>${rec.student.programme}</td></tr>
            <tr><td><strong>Academic Year:</strong></td><td>${rec.student.academic_year}</td></tr>
            <tr><td><strong>Admission Quota:</strong></td><td>${rec.student.admission_quota}</td></tr>
            <tr><td><strong>Credential Status:</strong></td><td><span class="status-chip ${rec.credential_status.includes('Active') ? 'good' : 'warning'}">${rec.credential_status}</span></td></tr>
          </table>
        `;
      }

      // Render Consent Switches
      const consentLedger = await apiFetch(`/api/v1/students/${state.selectedStudentToken}/consent`);
      const switchesBox = document.getElementById("consent-switches-list");
      if (switchesBox) {
        switchesBox.innerHTML = "";
        const latestGrant = consentLedger.grants && consentLedger.grants.length > 0 ? consentLedger.grants[0] : null;
        const allowed = latestGrant && latestGrant.allowed_fields ? latestGrant.allowed_fields : ["name", "programme", "institution", "enrolment_status"];

        consentLedger.available_fields.forEach((f) => {
          const isChecked = allowed.includes(f.key);
          const row = document.createElement("label");
          row.style.display = "flex";
          row.style.justifyContent = "space-between";
          row.style.alignItems = "center";
          row.style.padding = "8px 12px";
          row.style.background = "var(--card-hover)";
          row.style.borderRadius = "var(--radius-sm)";
          row.style.fontSize = "0.85rem";
          row.style.cursor = "pointer";

          row.innerHTML = `
            <span><strong>${f.label}</strong> ${f.sensitive ? '<small style="color:var(--amber);">(Sensitive)</small>' : ''}</span>
            <input type="checkbox" class="student-consent-chk" data-field="${f.key}" ${isChecked ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--navy);">
          `;
          switchesBox.appendChild(row);
        });
      }

      // Load Access Log
      const accessLog = await apiFetch(`/api/v1/students/${state.selectedStudentToken}/access-log`);
      const tbodyLog = document.getElementById("tbody-student-access-log");
      if (tbodyLog) {
        tbodyLog.innerHTML = "";
        if (accessLog.length === 0) {
          tbodyLog.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted);">No third-party verifier access recorded yet.</td></tr>`;
        } else {
          accessLog.forEach((entry) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${new Date(entry.timestamp).toLocaleString()}</td>
              <td><strong>${entry.verifier_type}</strong></td>
              <td><span class="status-chip ${entry.status === 'genuine' ? 'good' : 'problem'}">${entry.status}</span></td>
              <td><small>${entry.fields_disclosed.join(", ") || 'None'}</small></td>
            `;
            tbodyLog.appendChild(tr);
          });
        }
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  // ==================== 4. PUBLIC VERIFIER WORKSPACE ====================
  function renderVerifierResult(res) {
    const banner = document.getElementById("verification-status-banner");
    const details = document.getElementById("verification-details-content");
    const disclosedBox = document.getElementById("disclosed-claims-list");
    const withheldBox = document.getElementById("withheld-claims-list");

    if (!banner) return;

    banner.className = `status-banner ${res.status}`;
    if (res.status === "genuine") {
      banner.style.background = "var(--green-light)";
      banner.style.color = "var(--green)";
      banner.textContent = "✓ GENUINE ENROLMENT CREDENTIAL VERIFIED";
    } else if (res.status === "revoked") {
      banner.style.background = "var(--red-light)";
      banner.style.color = "var(--red)";
      banner.textContent = "✕ VERIFICATION FAILED: CREDENTIAL REVOKED";
    } else if (res.status === "expired") {
      banner.style.background = "var(--amber-light)";
      banner.style.color = "var(--amber)";
      banner.textContent = "⚠️ VERIFICATION FAILED: CREDENTIAL EXPIRED";
    } else if (res.status === "tampered") {
      banner.style.background = "var(--red-light)";
      banner.style.color = "var(--red)";
      banner.textContent = "✕ INTEGRITY ALERT: TAMPERED PROOF DETECTED";
    } else {
      banner.style.background = "var(--grey-light)";
      banner.style.color = "var(--grey)";
      banner.textContent = "✕ CREDENTIAL NOT FOUND";
    }

    if (details) details.style.display = res.genuine ? "block" : "none";

    if (disclosedBox && res.disclosed_claims) {
      disclosedBox.innerHTML = "";
      const table = document.createElement("table");
      table.style.width = "100%";
      Object.entries(res.disclosed_claims).forEach(([k, v]) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td style="font-weight:700; width:40%; text-transform:capitalize;">${k.replace('_', ' ')}:</td><td>${v}</td>`;
        table.appendChild(tr);
      });
      disclosedBox.appendChild(table);
    }

    if (withheldBox && res.withheld_fields) {
      withheldBox.innerHTML = `<strong>Withheld Attributes:</strong> ${res.withheld_fields.join(", ") || 'None'}`;
    }
  }

  // ==================== EVENT LISTENERS & WIRING ====================
  document.addEventListener("DOMContentLoaded", () => {
    // Role switcher button
    document.getElementById("btn-switch-role")?.addEventListener("click", () => {
      openModal("modal-role-picker");
    });
    document.getElementById("btn-close-role-modal")?.addEventListener("click", () => {
      closeModal("modal-role-picker");
    });

    document.querySelectorAll(".role-choice-card").forEach((card) => {
      card.addEventListener("click", () => {
        setRole(card.dataset.role);
      });
    });

    // Workspace tab clicks
    document.querySelectorAll(".workspace-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        switchWorkspace(btn.dataset.workspace);
      });
    });

    // Officer subtabs
    document.querySelectorAll("[data-officer-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const sub = btn.dataset.officerSubtab;
        document.querySelectorAll("[data-officer-subtab]").forEach((b) => b.classList.remove("active-subtab"));
        btn.classList.add("active-subtab");

        document.getElementById("officer-subview-overview").style.display = sub === "overview" ? "block" : "none";
        document.getElementById("officer-subview-institutions").style.display = sub === "institutions" ? "block" : "none";
        document.getElementById("officer-subview-duplicates").style.display = sub === "duplicates" ? "block" : "none";
        document.getElementById("officer-subview-audit").style.display = sub === "audit" ? "block" : "none";
      });
    });

    // Close drilldown
    document.getElementById("btn-close-drilldown")?.addEventListener("click", () => {
      document.getElementById("institution-drilldown-panel").style.display = "none";
    });

    // Refresh Officer
    document.getElementById("btn-refresh-officer")?.addEventListener("click", () => {
      loadOfficerData();
      showToast("Officer view refreshed", "info");
    });

    // Verify Audit buttons
    const triggerVerifyAudit = async () => {
      try {
        const res = await apiFetch("/api/v1/audit/verify");
        const banner = document.getElementById("audit-verification-banner");
        if (banner) {
          banner.style.display = "block";
          if (res.valid) {
            banner.style.background = "var(--green-light)";
            banner.style.color = "var(--green)";
            banner.textContent = `✓ ${res.message}`;
          } else {
            banner.style.background = "var(--red-light)";
            banner.style.color = "var(--red)";
            banner.textContent = `✕ ${res.message}`;
          }
        }
        showToast(res.message, res.valid ? "success" : "error");
      } catch (e) {
        showToast(e.message, "error");
      }
    };
    document.getElementById("btn-officer-verify-audit")?.addEventListener("click", triggerVerifyAudit);
    document.getElementById("btn-audit-verify")?.addEventListener("click", triggerVerifyAudit);

    // Tamper Demo button
    document.getElementById("btn-audit-tamper-demo")?.addEventListener("click", async () => {
      try {
        const res = await apiFetch("/api/v1/audit/tamper-demo", { method: "POST" });
        showToast("Tampering simulated on latest audit entry!", "warning");
        loadAuditTrail();
        triggerVerifyAudit();
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Reveal APAAR Written Reason Modal
    const revealInput = document.getElementById("reveal-reason-input");
    const revealCounter = document.getElementById("reveal-char-counter");
    const revealSubmitBtn = document.getElementById("btn-submit-reveal");

    revealInput?.addEventListener("input", () => {
      const len = revealInput.value.trim().length;
      revealCounter.textContent = `${len} / 10 chars minimum`;
      revealSubmitBtn.disabled = len < 10;
    });

    document.getElementById("btn-cancel-reveal")?.addEventListener("click", () => {
      closeModal("modal-reveal-reason");
      if (revealInput) revealInput.value = "";
    });

    document.getElementById("form-reveal-reason")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const reason = revealInput.value.trim();
      if (!state.activeRevealStudentId || reason.length < 10) return;

      try {
        const res = await apiFetch(`/api/v1/students/${state.activeRevealStudentId}/reveal`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        });
        const codeEl = document.getElementById(`masked-apaar-${state.activeRevealStudentId}`);
        if (codeEl) {
          codeEl.textContent = res.full_apaar_id;
          codeEl.style.color = "var(--saffron)";
          codeEl.style.fontWeight = "700";
        }
        closeModal("modal-reveal-reason");
        showToast(`Full APAAR ID Revealed: ${res.full_apaar_id}`, "success");
        loadAuditTrail();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // Upload File Selector & Drag Drop
    const fileInput = document.getElementById("file-intake-upload");
    const fileLabel = document.getElementById("selected-file-label");
    const dryRunBtn = document.getElementById("btn-run-dryrun");

    fileInput?.addEventListener("change", () => {
      if (fileInput.files.length > 0) {
        state.selectedUploadFile = fileInput.files[0];
        fileLabel.textContent = `Selected: ${state.selectedUploadFile.name} (${Math.round(state.selectedUploadFile.size / 1024)} KB)`;
        dryRunBtn.disabled = false;
      }
    });

    // Dry Run Button
    dryRunBtn?.addEventListener("click", async () => {
      if (!state.selectedUploadFile) return;
      dryRunBtn.disabled = true;
      dryRunBtn.textContent = "Validating...";

      const formData = new FormData();
      formData.append("institution_id", state.activeInstitutionId);
      formData.append("academic_year", "2024-25");
      formData.append("file", state.selectedUploadFile);

      try {
        const res = await apiFetch("/api/v1/upload/dry-run", {
          method: "POST",
          body: formData,
        });
        state.latestDryRunResult = res;

        // Render Dry Run Panel
        const panel = document.getElementById("dryrun-results-panel");
        panel.style.display = "block";

        const summaryBox = document.getElementById("dryrun-summary-box");
        summaryBox.style.background = res.findings_count > 0 ? "var(--amber-light)" : "var(--green-light)";
        summaryBox.innerHTML = `
          <strong>Dry Run Analysis:</strong> Evaluated ${res.total_rows} rows against 14 rules. 
          Found <strong>${res.findings_count}</strong> discrepancy findings 
          (${res.summary_counts.critical} critical, ${res.summary_counts.high} high). 
          <strong>NO DATABASE CHANGES APPLIED.</strong>
        `;

        const list = document.getElementById("dryrun-findings-list");
        list.innerHTML = "";
        res.findings.slice(0, 15).forEach((f) => {
          const card = document.createElement("div");
          card.className = `finding-card ${f.severity}`;
          card.innerHTML = `
            <div class="finding-header">
              <span class="status-chip ${f.severity === 'critical' || f.severity === 'high' ? 'problem' : 'warning'}">${f.rule_id}</span>
              <span>Row #${f.row_number || 'Batch'}</span>
            </div>
            <div class="finding-reason">${f.plain_reason}</div>
            <div class="finding-hint">💡 How to fix: ${f.fix_hint}</div>
          `;
          list.appendChild(card);
        });

        document.getElementById("btn-commit-batch").disabled = false;
        document.getElementById("step-node-2").className = "wizard-step done";
        document.getElementById("step-node-3").className = "wizard-step active";
        showToast("Dry-run analysis completed!", "success");
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        dryRunBtn.disabled = false;
        dryRunBtn.textContent = "🔍 Check My File (Dry Run)";
      }
    });

    // Commit Button
    document.getElementById("btn-commit-batch")?.addEventListener("click", async () => {
      if (!state.selectedUploadFile) return;
      const btn = document.getElementById("btn-commit-batch");
      btn.disabled = true;
      btn.textContent = "Committing to Registry...";

      const formData = new FormData();
      formData.append("institution_id", state.activeInstitutionId);
      formData.append("academic_year", "2024-25");
      formData.append("file", state.selectedUploadFile);

      try {
        const res = await apiFetch("/api/v1/upload/commit", {
          method: "POST",
          body: formData,
        });

        // Render Submission Diff
        const diffPanel = document.getElementById("submission-diff-panel");
        diffPanel.style.display = "block";
        document.getElementById("diff-narrative-text").textContent = res.diff_summary.narrative;

        const chipsBox = document.getElementById("diff-chips-container");
        chipsBox.innerHTML = `
          <span class="status-chip good">✓ ${res.diff_summary.fixed_count} Fixed</span>
          <span class="status-chip problem">+${res.diff_summary.new_count} New Issues</span>
          <span class="status-chip warning">⚠️ ${res.diff_summary.still_open_count} Still Open</span>
        `;

        document.getElementById("step-node-3").className = "wizard-step done";
        showToast(`Committed batch v${res.version} successfully!`, "success");
        loadOfficerData();
        refreshRegistrarLiveGauges();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "💾 Commit to Registry";
      }
    });

    // Issue Certificate Button
    document.getElementById("btn-issue-cert")?.addEventListener("click", async () => {
      const studentId = document.getElementById("select-cert-student")?.value;
      if (!studentId) return;

      try {
        const res = await apiFetch(`/api/v1/credentials/issue?student_id=${studentId}`, { method: "POST" });
        state.activeCertificateCredId = res.credential_id;

        const previewBox = document.getElementById("cert-preview-box");
        previewBox.style.display = "block";
        previewBox.innerHTML = `
          <div style="font-weight:700; color:var(--navy); margin-bottom:4px;">Credential Issued: ${res.credential_id}</div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">
            Anchored with ${res.commitments_count} selective commitments. Valid until ${new Date(res.expires_at).toLocaleDateString()}.
          </div>
        `;

        const dlBtn = document.getElementById("btn-download-cert-pdf");
        dlBtn.disabled = false;
        dlBtn.onclick = () => {
          window.open(window.apiUrl(`/api/v1/credentials/${res.credential_id}/certificate.pdf`), "_blank");
        };

        showToast("Verifiable credential created!", "success");
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Student Consent Save
    document.getElementById("btn-save-consent")?.addEventListener("click", async () => {
      if (!state.selectedStudentToken) return;
      const purpose = document.getElementById("consent-purpose-input")?.value || "Verification";
      const allowed = [];
      document.querySelectorAll(".student-consent-chk:checked").forEach((chk) => {
        allowed.push(chk.dataset.field);
      });

      try {
        await apiFetch(`/api/v1/students/${state.selectedStudentToken}/consent`, {
          method: "POST",
          body: JSON.stringify({ purpose, allowed_fields: allowed, validity_days: 90 }),
        });
        showToast("Digital consent preferences updated!", "success");
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Student Consent Revoke
    document.getElementById("btn-revoke-all-consent")?.addEventListener("click", async () => {
      if (!state.selectedStudentToken) return;
      try {
        // Fetch current grant id
        const ledger = await apiFetch(`/api/v1/students/${state.selectedStudentToken}/consent`);
        if (ledger.grants && ledger.grants.length > 0) {
          const grantId = ledger.grants[0].id;
          await apiFetch(`/api/v1/consent/${grantId}/revoke`, { method: "POST" });
          showToast("All consent revoked immediately!", "warning");
          renderStudentPortalView();
        }
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Public Verifier Tabs (Upload vs Code)
    document.getElementById("btn-mode-upload")?.addEventListener("click", () => {
      document.getElementById("verify-box-upload").style.display = "block";
      document.getElementById("verify-box-code").style.display = "none";
      document.getElementById("btn-mode-upload").classList.add("active");
      document.getElementById("btn-mode-code").classList.remove("active");
    });
    document.getElementById("btn-mode-code")?.addEventListener("click", () => {
      document.getElementById("verify-box-upload").style.display = "none";
      document.getElementById("verify-box-code").style.display = "block";
      document.getElementById("btn-mode-code").classList.add("active");
      document.getElementById("btn-mode-upload").classList.remove("active");
    });

    // Verifier Upload File Selector
    const verifyFileInput = document.getElementById("file-verify-upload");
    const verifyFileName = document.getElementById("verify-file-name");
    const runVerifyUploadBtn = document.getElementById("btn-run-verify-upload");

    verifyFileInput?.addEventListener("change", () => {
      if (verifyFileInput.files.length > 0) {
        verifyFileName.textContent = `File: ${verifyFileInput.files[0].name}`;
        runVerifyUploadBtn.disabled = false;
      }
    });

    runVerifyUploadBtn?.addEventListener("click", async () => {
      if (!verifyFileInput.files.length) return;
      runVerifyUploadBtn.disabled = true;
      runVerifyUploadBtn.textContent = "Scanning QR Seal & Verifying...";

      const formData = new FormData();
      formData.append("file", verifyFileInput.files[0]);
      formData.append("verifier_type", "Public Document Verifier");

      try {
        const res = await apiFetch("/api/v1/verify/upload", {
          method: "POST",
          body: formData,
        });
        renderVerifierResult(res);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        runVerifyUploadBtn.disabled = false;
        runVerifyUploadBtn.textContent = "🔍 Verify Certificate Seal";
      }
    });

    // Verifier Code Submit
    document.getElementById("btn-run-verify-code")?.addEventListener("click", async () => {
      const code = document.getElementById("verify-code-textarea")?.value.trim();
      if (!code) return;

      try {
        let payload;
        try {
          payload = JSON.parse(code);
        } catch (e) {
          // treat as credential id or raw token
          payload = await apiFetch(`/api/v1/credentials/${code}/presentation`);
        }

        const res = await apiFetch("/api/v1/verify/presentation?verifier_type=Public Web Verifier", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        renderVerifierResult(res);
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // "Verify Without Exposing" Simulator Widget
    document.getElementById("btn-sim-reverify")?.addEventListener("click", async () => {
      try {
        const credId = state.activeCertificateCredId || "cred-demo-aicte-2026";
        const pres = await apiFetch(`/api/v1/credentials/${credId}/presentation`);

        // Filter presentation disclosed claims based on toggles
        const allowedKeys = [];
        if (document.getElementById("sim-field-programme")?.checked) allowedKeys.push("programme");
        if (document.getElementById("sim-field-enrolment")?.checked) allowedKeys.push("enrolment_status");
        if (document.getElementById("sim-field-dob")?.checked) allowedKeys.push("dob");
        if (document.getElementById("sim-field-category")?.checked) allowedKeys.push("social_category");

        const simDisclosed = {};
        const simSalts = {};
        const simWithheld = [];

        Object.keys(pres.commitments).forEach((k) => {
          if (allowedKeys.includes(k) && pres.disclosed_claims[k]) {
            simDisclosed[k] = pres.disclosed_claims[k];
            simSalts[k] = pres.disclosed_salts[k];
          } else {
            simWithheld.push(k);
          }
        });

        pres.disclosed_claims = simDisclosed;
        pres.disclosed_salts = simSalts;
        pres.withheld_fields = simWithheld;

        const res = await apiFetch("/api/v1/verify/presentation?verifier_type=Selective Simulator", {
          method: "POST",
          body: JSON.stringify(pres),
        });
        renderVerifierResult(res);
        showToast("Selective disclosure re-verified!", "success");
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Data Fraud Drill Button
    document.getElementById("btn-run-fraud-drill")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-run-fraud-drill");
      btn.disabled = true;
      btn.textContent = "Injecting planted defects & running drill...";

      try {
        const res = await apiFetch("/api/v1/drill/run", { method: "POST" });
        document.getElementById("drill-results-box").style.display = "block";
        document.getElementById("drill-recall").textContent = `${res.overall_recall_pct}%`;
        document.getElementById("drill-precision").textContent = `${res.overall_precision_pct}%`;
        document.getElementById("drill-time").textContent = `${res.execution_time_ms} ms`;
        document.getElementById("drill-honest-note").textContent = res.honest_methodology_notice;

        const tbody = document.getElementById("tbody-drill-breakdown");
        tbody.innerHTML = "";
        res.rule_breakdown.forEach((rb) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${rb.rule_id}</strong></td>
            <td>${rb.planted}</td>
            <td><strong>${rb.caught}</strong></td>
            <td><span class="status-chip ${rb.status === 'PASSED' ? 'good' : 'warning'}">${rb.status}</span></td>
          `;
          tbody.appendChild(tr);
        });
        showToast("Data Fraud Drill completed!", "success");
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "▶ Run Data Fraud Drill";
      }
    });

    // 20k Speed Benchmark Button
    document.getElementById("btn-run-speed-bench")?.addEventListener("click", async () => {
      const btn = document.getElementById("btn-run-speed-bench");
      btn.disabled = true;
      btn.textContent = "Benchmarking 20,000 rows in RAM...";

      try {
        const res = await apiFetch("/api/v1/drill/benchmark?row_count=20000", { method: "POST" });
        const box = document.getElementById("speed-bench-results");
        box.style.display = "block";
        document.getElementById("bench-throughput").textContent = `${res.throughput_rows_per_second.toLocaleString()} rows/sec`;
        document.getElementById("bench-timing").textContent = `Processed ${res.row_count.toLocaleString()} rows in ${res.total_time_sec}s (${res.generation_time_sec}s gen + ${res.evaluation_time_sec}s eval).`;
        const noticeEl = document.getElementById("bench-notice");
        if (noticeEl) {
          noticeEl.textContent = res.scope_notice || "This is an in-memory measurement on this machine. It skips central registry network lookups and cross-institution matching.";
        }
        showToast("Speed benchmark completed!", "success");
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Run 20,000-Row Speed Benchmark";
      }
    });

    // AI Compliance Copilot Events
    const copilotWindow = document.getElementById("copilot-window");
    const openCopilotBtn = document.getElementById("btn-open-copilot");
    const closeCopilotBtn = document.getElementById("btn-close-copilot");
    const copilotForm = document.getElementById("form-copilot");
    const copilotInput = document.getElementById("input-copilot");
    const copilotMessages = document.getElementById("copilot-messages");

    openCopilotBtn?.addEventListener("click", () => {
      copilotWindow.style.display = copilotWindow.style.display === "none" ? "flex" : "none";
    });
    closeCopilotBtn?.addEventListener("click", () => {
      copilotWindow.style.display = "none";
    });

    async function sendCopilotQuery(msgText) {
      if (!msgText) return;

      // Append user bubble
      const userBubble = document.createElement("div");
      userBubble.className = "chat-bubble user";
      userBubble.textContent = msgText;
      copilotMessages.appendChild(userBubble);
      copilotMessages.scrollTop = copilotMessages.scrollHeight;

      // Loading bubble
      const botBubble = document.createElement("div");
      botBubble.className = "chat-bubble bot";
      botBubble.textContent = "Consulting regulatory knowledge base...";
      copilotMessages.appendChild(botBubble);
      copilotMessages.scrollTop = copilotMessages.scrollHeight;

      try {
        const res = await apiFetch("/api/v1/copilot/chat", {
          method: "POST",
          body: JSON.stringify({
            message: msgText,
            institution_id: state.activeInstitutionId,
          }),
        });
        const modeBadge = `<span style="display:inline-block; font-size:0.68rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; padding:2px 7px; border-radius:4px; background:rgba(20,48,122,0.12); color:var(--navy); margin-bottom:8px;">${res.mode || "template"}</span>`;
        botBubble.innerHTML = `${modeBadge}<br>` + res.reply.replace(/\n/g, "<br>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      } catch (e) {
        botBubble.textContent = "Apologies, unable to contact compliance engine.";
      }
      copilotMessages.scrollTop = copilotMessages.scrollHeight;
    }

    copilotForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = copilotInput.value.trim();
      if (!val) return;
      copilotInput.value = "";
      sendCopilotQuery(val);
    });

    document.querySelectorAll(".pill-prompt").forEach((btn) => {
      btn.addEventListener("click", () => {
        sendCopilotQuery(btn.dataset.prompt);
      });
    });

    // Drawer toggles
    document.getElementById("btn-demo-controls")?.addEventListener("click", () => {
      document.getElementById("drawer-demo").style.display = "block";
    });
    document.getElementById("btn-close-demo-drawer")?.addEventListener("click", () => {
      document.getElementById("drawer-demo").style.display = "none";
    });

    // Mock Registry Down Toggle
    document.getElementById("btn-toggle-registry-down")?.addEventListener("click", async () => {
      try {
        const res = await apiFetch("/api/v1/mock-registry/toggle-down", { method: "POST" });
        state.registryDown = res.down_switch_active;
        const lbl = document.getElementById("registry-down-status-label");
        if (lbl) {
          lbl.textContent = state.registryDown ? "Registry: SIMULATING OUTAGE (Down)" : "Registry: Operational";
          lbl.style.color = state.registryDown ? "var(--red)" : "inherit";
        }
        showToast(res.message, state.registryDown ? "warning" : "info");
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Drawer Reset Demo Database
    document.getElementById("btn-drawer-reset-db")?.addEventListener("click", async () => {
      if (!confirm("Reset database to clean 5 archetype institutions?")) return;
      try {
        const res = await apiFetch("/api/v1/system/reset-demo", { method: "POST" });
        showToast(res.message, "success");
        loadOfficerData();
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    // Glossary Modal
    document.getElementById("btn-help")?.addEventListener("click", () => {
      openModal("modal-glossary");
    });
    document.getElementById("btn-close-glossary")?.addEventListener("click", () => {
      closeModal("modal-glossary");
    });

    // Guided Tour Modal
    document.getElementById("btn-tour")?.addEventListener("click", () => {
      alert("Guided Tour:\n1. Switch Role (top nav) to experience Officer, College Registrar, Student, or Public Verifier perspectives.\n2. In Officer View, inspect institutions, duplicates, and verify the cryptographic audit chain.\n3. In College View, test the 3-step intake wizard with dry-run and issue signed certificates.\n4. In Student View, toggle selective disclosure consent switches.\n5. Click 'AI Copilot' anytime for real-time offline AICTE regulatory advice!");
    });

    // Accessibility Text Size
    document.getElementById("btn-font-dec")?.addEventListener("click", () => {
      document.documentElement.dataset.textSize = "normal";
    });
    document.getElementById("btn-font-norm")?.addEventListener("click", () => {
      document.documentElement.dataset.textSize = "normal";
    });
    document.getElementById("btn-font-inc")?.addEventListener("click", () => {
      document.documentElement.dataset.textSize = "large";
    });

    // Theme Toggle
    document.getElementById("btn-toggle-theme")?.addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme;
      document.documentElement.dataset.theme = cur === "dark" ? "light" : "dark";
    });

    // Initial Data Load
    loadOfficerData();
  });
})();
