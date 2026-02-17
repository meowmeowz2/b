const viewer = document.getElementById('viewer');
const internalPage = document.getElementById('internalPage');
const urlInput = document.getElementById('urlInput');
const status = document.getElementById('status');

const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const goBtn = document.getElementById('goBtn');

const EXTENSIONS_KEY = 'duck.extensions.v1';

function readExtensions() {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXTENSIONS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.code === 'string');
  } catch {
    return [];
  }
}

function writeExtensions(extensions) {
  localStorage.setItem(EXTENSIONS_KEY, JSON.stringify(extensions));
}

function runBrowserExtensions(context) {
  for (const ext of readExtensions()) {
    if (ext.type !== 'browser') continue;
    try {
      const runner = new Function('context', ext.code);
      runner(context);
    } catch (error) {
      status.textContent = `Browser extension failed: ${ext.name || 'unnamed'}`;
      console.error(error);
    }
  }
}

function injectPageExtensions(targetUrl) {
  const pageExtensions = readExtensions().filter((item) => item.type === 'page');
  if (!pageExtensions.length) return;

  const payload = pageExtensions
    .map((ext) => `try { ${ext.code} } catch (e) { console.error('Page extension failed:', e); }`)
    .join('\n');

  try {
    if (viewer.contentDocument?.documentElement) {
      const script = viewer.contentDocument.createElement('script');
      script.textContent = payload;
      viewer.contentDocument.documentElement.append(script);
    }
  } catch {
    status.textContent = `Loaded ${targetUrl} (page extensions blocked by cross-origin policy)`;
  }
}

function normalizeInput(rawValue) {
  const value = rawValue.trim();
  if (!value) return 'duck://newtab';

  if (value.startsWith('duck://')) return value;

  const looksLikeUrl = /^https?:\/\//i.test(value) || /\./.test(value);
  if (looksLikeUrl) {
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  }

  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

function showInternalPage(html) {
  viewer.hidden = true;
  viewer.removeAttribute('src');
  internalPage.hidden = false;
  internalPage.innerHTML = html;
}

function showWebPage(target) {
  internalPage.hidden = true;
  internalPage.innerHTML = '';
  viewer.hidden = false;
  viewer.src = target;
}

function renderNewTab() {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  showInternalPage(`
    <section class="newtab">
      <h1>duck://newtab</h1>
      <div class="clock">${time}</div>
      <p class="date">${date}</p>
      <div class="quick-links">
        <button data-go="https://example.com">Example</button>
        <button data-go="https://developer.mozilla.org">MDN</button>
        <button data-go="duck://extensions">Extensions</button>
      </div>
      <p class="muted">Tip: use the URL bar above to navigate.</p>
    </section>
  `);

  internalPage.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => navigate(btn.getAttribute('data-go') || 'duck://newtab'));
  });
}

function renderExtensionsPage() {
  const extensions = readExtensions();
  const rows = extensions
    .map(
      (ext, idx) => `
      <tr>
        <td>${ext.name || `Extension ${idx + 1}`}</td>
        <td>${ext.type}</td>
        <td><button data-remove="${idx}">Remove</button></td>
      </tr>`
    )
    .join('');

  showInternalPage(`
    <section class="extensions">
      <h1>duck://extensions</h1>
      <p class="muted">Create tiny extensions by pasting JavaScript.</p>
      <form id="extForm" class="ext-form">
        <input id="extName" type="text" placeholder="Extension name" />
        <select id="extType">
          <option value="browser">Browser extension (can modify browser UI/state)</option>
          <option value="page">Page extension (runs inside iframe pages when same-origin allows)</option>
        </select>
        <textarea id="extCode" rows="10" placeholder="// JS code\n// Browser extension receives: context\n// context = { navigate, urlInput, status, viewer, internalPage }"></textarea>
        <button type="submit">Save extension</button>
      </form>

      <h2>Installed</h2>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Action</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No extensions installed yet.</td></tr>'}</tbody>
      </table>
    </section>
  `);

  const form = document.getElementById('extForm');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = document.getElementById('extName').value.trim();
    const type = document.getElementById('extType').value;
    const code = document.getElementById('extCode').value.trim();

    if (!code) {
      status.textContent = 'Cannot save empty extension code.';
      return;
    }

    const next = readExtensions();
    next.push({ name, type, code });
    writeExtensions(next);
    status.textContent = `Saved ${type} extension${name ? `: ${name}` : ''}`;
    renderExtensionsPage();
  });

  internalPage.querySelectorAll('[data-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const index = Number(button.getAttribute('data-remove'));
      const next = readExtensions();
      next.splice(index, 1);
      writeExtensions(next);
      status.textContent = 'Removed extension.';
      renderExtensionsPage();
    });
  });
}

function navigate(nextTarget) {
  const target = normalizeInput(nextTarget);
  urlInput.value = target;

  if (target === 'duck://newtab') {
    status.textContent = 'Opened duck://newtab';
    renderNewTab();
    runBrowserExtensions({ navigate, urlInput, status, viewer, internalPage });
    return;
  }

  if (target === 'duck://extensions') {
    status.textContent = 'Opened duck://extensions';
    renderExtensionsPage();
    runBrowserExtensions({ navigate, urlInput, status, viewer, internalPage });
    return;
  }

  status.textContent = `Loading ${target}...`;
  showWebPage(target);
  runBrowserExtensions({ navigate, urlInput, status, viewer, internalPage });
}

viewer.addEventListener('load', () => {
  status.textContent = `Loaded ${urlInput.value}`;
  injectPageExtensions(urlInput.value);
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
  if (urlInput.value.startsWith('duck://')) {
    navigate(urlInput.value);
    return;
  }

  status.textContent = 'Reloading...';
  viewer.contentWindow?.location.reload();
});

goBtn.addEventListener('click', () => navigate(urlInput.value));

urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    navigate(urlInput.value);
  }
});

setInterval(() => {
  if (urlInput.value === 'duck://newtab' && !internalPage.hidden) {
    renderNewTab();
  }
}, 30_000);

navigate(urlInput.value);
