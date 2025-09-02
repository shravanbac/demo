const DEFAULT_WEBHOOK = 'https://hook.fusion.adobe.com/3o5lrlkstfbbrspi35hh0y3cmjkk4gdd';
const RETRY_INTERVAL_MS = 500;

/** Resolve webhook URL */
function resolveWebhook() {
  return (
    window.SFR_WEBHOOK_URL
    || document.querySelector('meta[name="sfr:webhook"]')?.content?.trim()
    || DEFAULT_WEBHOOK
  );
}

/** Extract email from a string */
function extractEmail(text) {
  if (!text) return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : null;
}

/** Find user email in current document only (no loops, lint-safe) */
function findUserEmail(root = document) {
  if (!root) return null;
  const spans = Array.from(root.querySelectorAll('span[slot="description"], span.description'));
  const match = spans.find((span) => extractEmail(span.textContent?.trim() || ''));
  return match ? extractEmail(match.textContent?.trim() || '') : null;
}

/** Resolve submitter */
function resolveSubmitter() {
  return new Promise((resolve) => {
    const tryFind = () => {
      const email = findUserEmail();
      if (email) resolve(email);
      else setTimeout(tryFind, RETRY_INTERVAL_MS);
    };
    tryFind();
  });
}

/** Parse sidekick query params */
function getSidekickParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    ref: params.get('ref'),
    repo: params.get('repo'),
    owner: params.get('owner'),
    previewHost: params.get('previewHost'),
    liveHost: params.get('liveHost'),
    project: params.get('project'),
  };
}

/** Collect authored page context using sidekick params */
function getContext() {
  const {
    ref, repo, owner, previewHost, liveHost,
  } = getSidekickParams();

  const host = previewHost || window.location.host;

  return {
    ref,
    site: repo,
    org: owner,
    env: host.includes('.aem.live') ? 'live' : 'page',
    path: '/', // real page, not /tools/send-for-review
    title: document.title || 'Untitled Page',
    host,
    isoNow: new Date().toISOString(),
    previewHost,
    liveHost,
  };
}

/** Build full payload */
async function buildPayload(ctx) {
  const {
    ref, site, org, host, isoNow, title, env, previewHost, liveHost,
  } = ctx;

  const submittedBy = await resolveSubmitter();

  return {
    title,
    url: `https://${liveHost}`, // live page
    name: 'index',
    publishedDate: isoNow,
    submittedBy,
    path: '/', // root path (or adjust if needed)
    previewUrl: `https://${previewHost}`,
    liveUrl: `https://${liveHost}`,
    host,
    env,
    org,
    site,
    ref,
    source: 'DA.live',
    lang: document.documentElement?.lang || undefined,
    locale: navigator.language || undefined,
    headings: [], // skipping parent DOM access (CORS)
    analytics: {
      userAgent: navigator.userAgent,
      timezoneOffset: new Date().getTimezoneOffset(),
      viewport: {
        width: window.innerWidth || 0,
        height: window.innerHeight || 0,
      },
    },
  };
}

/** Post payload */
async function postToWebhook(payload) {
  const res = await fetch(resolveWebhook(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    mode: 'cors',
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Show toast notification instead of alert */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    background: type === 'error' ? '#c40000' : '#2e8540',
    color: '#fff',
    padding: '10px 16px',
    borderRadius: '6px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    zIndex: 9999,
    fontSize: '14px',
    fontFamily: 'Arial, sans-serif',
  });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/** Main handler (sidekick calls this on button click) */
export default async function sendForReview() {
  try {
    const ctx = getContext();
    const payload = await buildPayload(ctx);
    await postToWebhook(payload);

    showToast('✅ Review request submitted to Workfront!', 'success');
  } catch (err) {
    showToast(`❌ Failed to submit review: ${err.message}`, 'error');
  }
}
