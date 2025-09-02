const DEFAULT_WEBHOOK = 'https://hook.us2.make.com/6wpuu9mtglv89lsj6acwd8tvbgrfbnko';

/** Toast notification */
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

/** Main handler */
export default async function sendForReview() {
  try {
    showToast('⚡ Button clicked, preparing request...', 'info');

    // Derive page name from document.referrer
    let pageName = 'index';
    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        pageName = (refUrl.pathname.split('/').filter(Boolean).pop() || 'index')
          .replace(/\.[^.]+$/, '') || 'index';
      } catch {
        pageName = 'index';
      }
    }

    const payload = { page: pageName };

    const res = await fetch(DEFAULT_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    showToast(`✅ Sent for review: ${pageName}`, 'success');
  } catch (err) {
    showToast(`❌ Failed: ${err.message}`, 'error');
  }
}
