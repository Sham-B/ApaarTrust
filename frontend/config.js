/**
 * ApaarTrust Global Configuration
 * Supports single API_BASE or optional comma-separated failover list: API_BASE_URLS.
 * Only hosts on the allowlist or confirmed via manual-connect prompt are accepted.
 * Holds optional demo VIDEO_URL with graceful placeholder fallback.
 */

var DEFAULT_API_BASE = "https://truthtrace-api-l4cs.onrender.com";

// Allowed domain patterns for secure host filtering
var TRUSTED_HOST_PATTERNS = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^0\.0\.0\.0$/,
  /\.onrender\.com$/,
  /\.zeabur\.app$/,
  /\.snapdeploy\.dev$/,
  /\.loca\.lt$/,
  /\.trycloudflare\.com$/,
  /\.github\.io$/
];

function isHostAllowed(urlStr) {
  if (!urlStr) return true; // relative path
  try {
    var parsed = new URL(urlStr, window.location.origin);
    var hostname = parsed.hostname;

    // Check trusted pattern list
    for (var i = 0; i < TRUSTED_HOST_PATTERNS.length; i++) {
      if (TRUSTED_HOST_PATTERNS[i].test(hostname)) {
        return true;
      }
    }

    // Check previous manual confirmation in localStorage
    var confirmedKey = 'apaar_allow_host_' + hostname;
    if (localStorage.getItem(confirmedKey) === 'true') {
      return true;
    }

    // Prompt user for manual-connect confirmation
    var confirmed = window.confirm(
      'ApaarTrust Security Guard:\n\n' +
      'Connect to custom API host "' + hostname + '"?\n\n' +
      'Only confirm if you trust this server.'
    );

    if (confirmed) {
      localStorage.setItem(confirmedKey, 'true');
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Config object
window.TRUTHTRACE_CONFIG = {
  // Primary base URL
  API_BASE: (window.location.port === "5500")
    ? "http://127.0.0.1:8080"
    : ((window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "")
      ? ""
      : DEFAULT_API_BASE),

  // Comma-separated failover candidate list
  API_BASE_URLS: "http://127.0.0.1:8080, https://apaartrust-api.snapdeploy.dev, https://truthtrace-api-l4cs.onrender.com",

  // Demo video URL (e.g. YouTube/Vimeo embed or MP4, empty string shows placeholder)
  VIDEO_URL: ""
};

// Mirror onto window.APP_CONFIG
window.APP_CONFIG = window.TRUTHTRACE_CONFIG;

/**
 * Returns full API URL for a given relative endpoint path.
 * If API_BASE is empty, returns clean path (same origin).
 */
function apiUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }

  var rememberedBase = localStorage.getItem('apaar_active_api_base');
  var base = rememberedBase || (window.TRUTHTRACE_CONFIG && window.TRUTHTRACE_CONFIG.API_BASE) || "";

  var isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "";
  if (!base && !isLocal) {
    base = DEFAULT_API_BASE;
  }

  var cleanBase = base.replace(/\/+$/, "");
  var cleanPath = path.startsWith("/") ? path : "/" + path;
  return cleanBase ? cleanBase + cleanPath : cleanPath;
}

/**
 * Helper fetch wrapper that automatically prepends apiUrl(path).
 */
function api(path, options) {
  return fetch(apiUrl(path), options);
}

/**
 * Optional failover resolver: tries candidate base URLs in order
 * and remembers the first that answers /health with ready=true.
 */
async function resolveApiFailover() {
  var rawList = (window.TRUTHTRACE_CONFIG && window.TRUTHTRACE_CONFIG.API_BASE_URLS) || "";
  var candidates = rawList
    .split(",")
    .map(function (u) { return u.trim().replace(/\/+$/, ""); })
    .filter(Boolean);

  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!isHostAllowed(candidate)) continue;

    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, 2500);
      var resp = await fetch(candidate + "/health", {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      clearTimeout(timeoutId);

      if (resp.ok) {
        var json = await resp.json();
        if (json.ready === true || json.status === "ok") {
          window.TRUTHTRACE_CONFIG.API_BASE = candidate;
          window.APP_CONFIG.API_BASE = candidate;
          localStorage.setItem('apaar_active_api_base', candidate);
          console.log("[Failover] Active API resolved to:", candidate);
          return candidate;
        }
      }
    } catch (e) {
      // try next
    }
  }
  return null;
}

// Expose globally
window.apiUrl = apiUrl;
window.api = api;
window.isHostAllowed = isHostAllowed;
window.resolveApiFailover = resolveApiFailover;
