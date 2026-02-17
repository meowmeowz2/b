const viewer = document.getElementById('viewer');
const urlInput = document.getElementById('urlInput');
const status = document.getElementById('status');

const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const goBtn = document.getElementById('goBtn');

function normalizeInput(rawValue) {
  const value = rawValue.trim();
  if (!value) return 'https://example.com';

  const looksLikeUrl = /^https?:\/\//i.test(value) || /\./.test(value);
  if (looksLikeUrl) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

function navigate(nextTarget) {
  const target = normalizeInput(nextTarget);
  urlInput.value = target;
  status.textContent = `Loading ${target}...`;
  viewer.src = target;
}

viewer.addEventListener('load', () => {
  // Cross-origin content blocks access to viewer.contentWindow.location in many cases.
  // We keep the typed URL and update status only.
  status.textContent = `Loaded ${urlInput.value}`;
});

backBtn.addEventListener('click', () => {
  status.textContent = 'Trying to go back...';
  viewer.contentWindow?.history.back();
});

forwardBtn.addEventListener('click', () => {
  status.textContent = 'Trying to go forward...';
  viewer.contentWindow?.history.forward();
});

reloadBtn.addEventListener('click', () => {
  status.textContent = 'Reloading...';
  viewer.contentWindow?.location.reload();
});

goBtn.addEventListener('click', () => navigate(urlInput.value));

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    navigate(urlInput.value);
  }
});

navigate(urlInput.value);
