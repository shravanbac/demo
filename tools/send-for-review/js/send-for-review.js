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

/** Collect authored page context */
function getContext() {
  const refUrl = document.referrer ? new URL(document.referrer) : null;
  const host = refUrl?.host || '';
  const path = refUrl?.pathname || '';
  const title = refUrl ? '' : document.title;

  let ref = '';
  let site = '';
  let org = '';
  const match = host.match(/^([^-]+)--([^-]+)--([^.]+)\.aem\.(page|live)$/);
  if (match) [, ref, site, org] = match;

  const env = host.includes('.aem.live') ? 'live' : 'page';

  return {
    ref,
    site,
    org,
    env,
    path: path.replace(/^\//, ''),
    title,
    host,
    isoNow: new Date().toISOString(),
  };
}

/** Build full payload */
async function buildPayload(ctx) {
  const {
    ref, site, org, host, path, isoNow, title, env,
  } = ctx;

  const cleanPath = path.replace(/^\/+/, '');
  const name = (cleanPath.split('/').filter(Boolean).pop() || 'index')
    .replace(/\.[^.]+$/, '') || 'index';

  const submittedBy = await resolveSubmitter();

  let liveHost;
  if (ref && site && org) {
    liveHost = `${ref}--${site}--${org}.aem.live`;
  } else if (host?.endsWith('.aem.page')) {
    liveHost = host.replace('.aem.page', '.aem.live');
  } else {
    liveHost = host || 'localhost';
  }

  let previewHost;
  if (ref && site && org) {
    previewHost = `${ref}--${site}--${org}.aem.page`;
  } else {
    previewHost = host || 'localhost';
  }

  return {
    title,
    url: `https://${liveHost}/${cleanPath}`,
    name,
    publishedDate: isoNow,
    submittedBy,
    path: `/${cleanPath}`,
    previewUrl: `https://${previewHost}/${cleanPath}`,
    liveUrl: `https://${liveHost}/${cleanPath}`,
    host,
    env,
    org,
    site,
    ref,
    source: 'DA.live',
    lang: document.documentElement?.lang || undefined,
    locale: navigator.language || undefined,
    headings: [], // no parent DOM access
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

/** Show toast notification instead of alert (lint-safe) */
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
