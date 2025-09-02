const DEFAULT_WEBHOOK = 'https://hook.us2.make.com/6wpuu9mtglv89lsj6acwd8tvbgrfbnko';

/** Resolve webhook URL */
function resolveWebhook() {
  return (
    window.SFR_WEBHOOK_URL ||
    document.querySelector('meta[name="sfr:webhook"]')?.content?.trim() ||
    DEFAULT_WEBHOOK
  );
}

/** Collect authored page context */
function getContext() {
  const host = window.location.host || '';
  const path = window.location.pathname || '';
  const title = document.title || '';

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

/** Build payload */
function buildPayload(ctx) {
  const { ref, site, org, host, path, isoNow, title, env } = ctx;
  const cleanPath = path.replace(/^\/+/, '');
  const name =
    (cleanPath.split('/').filter(Boolean).pop() || 'index').replace(
      /\.[^.]+$/,
      ''
    ) || 'index';

  let liveHost =
    ref && site && org
      ? `${ref}--${site}--${org}.aem.live`
      : host.replace('.aem.page', '.aem.live');

  let previewHost =
    ref && site && org ? `${ref}--${site}--${org}.aem.page` : host;

  return {
    title,
    url: `https://${liveHost}/${cleanPath}`,
    name,
    publishedDate: isoNow,
    path: `/${cleanPath}`,
    previewUrl: `https://${previewHost}/${cleanPath}`,
    liveUrl: `https://${liveHost}/${cleanPath}`,
    host,
    env,
    org,
    site,
    ref,
    source: 'DA.live',
    lang: document.documentElement.lang || undefined,
    locale: navigator.language || undefined,
  };
}

/** Send payload to webhook */
async function postToWebhook(payload) {
  const res = await fetch(resolveWebhook(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }
  return res;
}

/** Main */
(async function sendForReview() {
  try {
    const ctx = getContext();
    const payload = buildPayload(ctx);
    await postToWebhook(payload);

    alert('✅ Review request submitted successfully!');
  } catch (err) {
    alert(`❌ Review request failed: ${err.message}`);
  }
})();
