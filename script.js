const viewer = document.getElementById('viewer');
const internalPage = document.getElementById('internalPage');
const urlInput = document.getElementById('urlInput');
const status = document.getElementById('status');

const tabBar = document.getElementById('tabBar');
const newTabBtn = document.getElementById('newTabBtn');
const backBtn = document.getElementById('backBtn');
const forwardBtn = document.getElementById('forwardBtn');
const reloadBtn = document.getElementById('reloadBtn');
const goBtn = document.getElementById('goBtn');
const extensionsMenuBtn = document.getElementById('extensionsMenuBtn');
const extensionsMenu = document.getElementById('extensionsMenu');

const EXTENSIONS_KEY = 'duck.extensions.v1';
const SETTINGS_KEY = 'duck.settings.v1';

const tabs = [];
let activeTabId = null;

function getSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      homepage: parsed.homepage || 'duck://newtab',
      searchBase: parsed.searchBase || 'https://duckduckgo.com/?q='
    };
  } catch {
    return { homepage: 'duck://newtab', searchBase: 'https://duckduckgo.com/?q=' };
  }
}

function setSettings(nextSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
}

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
  renderExtensionsMenu();
}

function getActiveTab() {
  return tabs.find((tab) => tab.id === activeTabId) || null;
}

function summarizeTabTitle(url) {
  if (url.startsWith('duck://')) return url.replace('duck://', '');
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function renderTabBar() {
  tabBar.innerHTML = tabs
    .map(
      (tab) => `
      <button class="tab-btn ${tab.id === activeTabId ? 'active' : ''}" data-tab-id="${tab.id}">
        <span>${tab.title || summarizeTabTitle(tab.url)}</span>
        <span class="tab-close" data-close-id="${tab.id}" title="Close tab">×</span>
      </button>`
    )
    .join('');

  tabBar.querySelectorAll('[data-tab-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (event.target.closest('[data-close-id]')) return;
      switchTab(Number(el.getAttribute('data-tab-id')));
    });
  });

  tabBar.querySelectorAll('[data-close-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      event.stopPropagation();
      closeTab(Number(el.getAttribute('data-close-id')));
    });
  });
}

function createTab(initialUrl = null) {
  const settings = getSettings();
  const id = Date.now() + Math.random();
  tabs.push({
    id,
    url: initialUrl || settings.homepage,
    title: 'New Tab'
  });
  activeTabId = id;
  renderTabBar();
  navigate(getActiveTab().url, { updateTab: true });
}

function closeTab(tabId) {
  if (tabs.length === 1) return;
  const idx = tabs.findIndex((tab) => tab.id === tabId);
  if (idx < 0) return;
  const wasActive = activeTabId === tabId;
  tabs.splice(idx, 1);
  if (wasActive) activeTabId = tabs[Math.max(0, idx - 1)].id;
  renderTabBar();
  switchTab(activeTabId);
}

function switchTab(tabId) {
  const tab = tabs.find((item) => item.id === tabId);
  if (!tab) return;
  activeTabId = tab.id;
  urlInput.value = tab.url;
  renderTabBar();
  navigate(tab.url, { updateTab: false });
}

function updateActiveTab(url) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.url = url;
  tab.title = summarizeTabTitle(url);
  renderTabBar();
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
  if (!value) return getSettings().homepage;
  if (value.startsWith('duck://')) return value;

  const looksLikeUrl = /^https?:\/\//i.test(value) || /\./.test(value);
  if (looksLikeUrl) return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return `${getSettings().searchBase}${encodeURIComponent(value)}`;
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
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

  showInternalPage(`
    <section class="newtab">
      <h1>duck://newtab</h1>
      <div class="clock">${time}</div>
      <p class="date">${date}</p>
      <div class="quick-links">
        <button data-go="duck://settings">Settings</button>
        <button data-go="duck://extensions">Extensions</button>
        <button data-go="https://developer.mozilla.org">MDN</button>
      </div>
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
      (ext, idx) => `<tr><td>${ext.name || `Extension ${idx + 1}`}</td><td>${ext.type}</td><td><button data-remove="${idx}">Remove</button></td></tr>`
    )
    .join('');

  showInternalPage(`
    <section class="extensions">
      <h1>duck://extensions</h1>
      <p class="muted">Full extensions manager page.</p>
      <form id="extForm" class="ext-form">
        <input id="extName" type="text" placeholder="Extension name" />
        <select id="extType">
          <option value="browser">Browser extension (modifies app UI/state)</option>
          <option value="page">Page extension (injects into iframe pages when possible)</option>
        </select>
        <textarea id="extCode" rows="9" placeholder="// JS code"></textarea>
        <button type="submit">Save extension</button>
      </form>
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Action</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="3">No extensions installed.</td></tr>'}</tbody>
      </table>
    </section>
  `);

  document.getElementById('extForm')?.addEventListener('submit', (event) => {
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

function renderSettingsPage() {
  const settings = getSettings();
  showInternalPage(`
    <section class="extensions">
      <h1>duck://settings</h1>
      <form id="settingsForm" class="ext-form">
        <label>Homepage URL <input id="homeInput" type="text" value="${settings.homepage}" /></label>
        <label>Search URL base <input id="searchInput" type="text" value="${settings.searchBase}" /></label>
        <button type="submit">Save settings</button>
      </form>
    </section>
  `);

  document.getElementById('settingsForm')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const homepage = document.getElementById('homeInput').value.trim() || 'duck://newtab';
    const searchBase = document.getElementById('searchInput').value.trim() || 'https://duckduckgo.com/?q=';
    setSettings({ homepage, searchBase });
    status.textContent = 'Settings saved.';
  });
}

function renderExtensionsMenu() {
  const items = readExtensions();
  extensionsMenu.innerHTML = `
    <div class="menu-head">Installed (${items.length})</div>
    <ul class="menu-list">
      ${items
        .slice(0, 6)
        .map((ext) => `<li><strong>${ext.name || 'Unnamed'}</strong><span>${ext.type}</span></li>`)
        .join('') || '<li><em>No extensions</em></li>'}
    </ul>
    <div class="menu-actions">
      <button id="openExtensionsPage">Open full manager</button>
      <button id="openSettingsPage">Settings</button>
    </div>
  `;

  document.getElementById('openExtensionsPage')?.addEventListener('click', () => {
    extensionsMenu.hidden = true;
    navigate('duck://extensions');
  });

  document.getElementById('openSettingsPage')?.addEventListener('click', () => {
    extensionsMenu.hidden = true;
    navigate('duck://settings');
  });
}

function navigate(nextTarget, options = { updateTab: true }) {
  const target = normalizeInput(nextTarget);
  urlInput.value = target;
  if (options.updateTab) updateActiveTab(target);

  if (target === 'duck://newtab') {
    status.textContent = 'Opened duck://newtab';
    renderNewTab();
  } else if (target === 'duck://extensions') {
    status.textContent = 'Opened duck://extensions';
    renderExtensionsPage();
  } else if (target === 'duck://settings') {
    status.textContent = 'Opened duck://settings';
    renderSettingsPage();
  } else {
    status.textContent = `Loading ${target}...`;
    showWebPage(target);
  }

  runBrowserExtensions({ navigate, urlInput, status, viewer, internalPage, tabs, activeTabId });
}

viewer.addEventListener('load', () => {
  status.textContent = `Loaded ${urlInput.value}`;
  injectPageExtensions(urlInput.value);
});

newTabBtn.addEventListener('click', () => createTab('duck://newtab'));

backBtn.addEventListener('click', () => {
  if (urlInput.value.startsWith('duck://')) return;
  status.textContent = 'Trying to go back...';
  viewer.contentWindow?.history.back();
});

forwardBtn.addEventListener('click', () => {
  if (urlInput.value.startsWith('duck://')) return;
  status.textContent = 'Trying to go forward...';
  viewer.contentWindow?.history.forward();
});

reloadBtn.addEventListener('click', () => {
  if (urlInput.value.startsWith('duck://')) {
    navigate(urlInput.value);
  } else {
    status.textContent = 'Reloading...';
    viewer.contentWindow?.location.reload();
  }
});

goBtn.addEventListener('click', () => navigate(urlInput.value));
urlInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') navigate(urlInput.value);
});

extensionsMenuBtn.addEventListener('click', () => {
  renderExtensionsMenu();
  extensionsMenu.hidden = !extensionsMenu.hidden;
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.menu-wrap')) extensionsMenu.hidden = true;
});

setInterval(() => {
  if (urlInput.value === 'duck://newtab' && !internalPage.hidden) renderNewTab();
}, 30_000);

createTab();
