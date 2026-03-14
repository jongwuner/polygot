// ═══════════════════════════════════════════
// POLYGLOT CONTENT SCRIPT
// Shadow DOM panel for style isolation
// ═══════════════════════════════════════════

let panelHost = null;
let fabHost = null;

function isInvalidatedContextError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('extension context invalidated')
    || message.includes('message port closed')
    || message.includes('receiving end does not exist');
}

function getRefreshRequiredMessage() {
  return 'Extension updated. Refresh this tab once and try again.';
}

function sendRuntimeMessageSafe(message, callback) {
  try {
    chrome.runtime.sendMessage(message, callback);
    return true;
  } catch (err) {
    if (isInvalidatedContextError(err)) {
      showPageToast(getRefreshRequiredMessage(), true);
      return false;
    }
    throw err;
  }
}

function getSyncStorageSafe(keys, callback) {
  try {
    chrome.storage.sync.get(keys, callback);
    return true;
  } catch (err) {
    if (isInvalidatedContextError(err)) {
      showPageToast(getRefreshRequiredMessage(), true);
      return false;
    }
    throw err;
  }
}

// ── Message listener ─────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'getSelection') {
    const text = window.getSelection().toString().trim();
    sendResponse({ text: text || '' });
    return;
  }

  if (msg.action === 'showTranslation') {
    showPanel(msg.data);
    return;
  }

  if (msg.action === 'saveTranslationToObsidian') {
    saveToObsidian(msg.data, { silent: true });
    return;
  }

  if (msg.action === 'polyglotToast') {
    showPageToast(msg.message, msg.isError);
  }
});

// ═══════════════════════════════════════════
// DRAG-TO-TRANSLATE: floating button on selection
// ═══════════════════════════════════════════
document.addEventListener('mouseup', (e) => {
  // Ignore clicks inside our own UI
  if (panelHost?.contains(e.target) || fabHost?.contains(e.target)) return;

  setTimeout(() => {
    const text = window.getSelection().toString().trim();
    if (text.length > 0) {
      showFab(e.clientX, e.clientY);
    } else {
      removeFab();
    }
  }, 10);
});

// ── Close on Escape / click-outside ──────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { removePanel(); removeFab(); }
});
document.addEventListener('mousedown', (e) => {
  if (panelHost && !panelHost.contains(e.target)) removePanel();
  if (fabHost && !fabHost.contains(e.target) && !panelHost?.contains(e.target)) removeFab();
});

// ═══════════════════════════════════════════
// FAB (Floating Action Button)
// ═══════════════════════════════════════════
function showFab(x, y) {
  removeFab();

  fabHost = document.createElement('div');
  fabHost.id = 'polyglot-fab-root';
  fabHost.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:auto;';

  const shadow = fabHost.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
<style>
.pg-fab{
  display:flex;align-items:center;gap:6px;
  padding:6px 12px;
  background:#16161a;border:1px solid #2a2a32;border-radius:100px;
  font:600 12px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  color:#e8e6e3;cursor:pointer;
  box-shadow:0 8px 28px rgba(0,0,0,0.45);
  transition:all .15s ease;
  user-select:none;
  white-space:nowrap;
}
.pg-fab:hover{background:#1e1e24;border-color:#4ecdc4;box-shadow:0 8px 32px rgba(78,205,196,0.2)}
.pg-fab-logo{
  font-size:11px;font-weight:700;letter-spacing:-0.02em;
  background:linear-gradient(135deg,#4ecdc4,#c084fc);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
</style>
<div class="pg-fab" id="pgFab">
  <span class="pg-fab-logo">P</span> Translate
</div>`;

  shadow.getElementById('pgFab').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerTranslate();
  });

  document.body.appendChild(fabHost);

  // Position near cursor, offset slightly to the right
  let left = x + 10;
  let top = y - 40;
  if (left + 120 > window.innerWidth) left = window.innerWidth - 130;
  if (top < 8) top = y + 16;

  fabHost.style.left = left + 'px';
  fabHost.style.top = top + 'px';
}

function removeFab() {
  if (fabHost) { fabHost.remove(); fabHost = null; }
}

function triggerTranslate() {
  const text = window.getSelection().toString().trim();
  if (!text) return;

  removeFab();
  showPageToast('Translating...', false);

  const sent = sendRuntimeMessageSafe({ action: 'translate', text }, (response) => {
    const runtimeError = chrome.runtime.lastError;
    if (runtimeError) {
      if (isInvalidatedContextError(runtimeError)) {
        showPageToast(getRefreshRequiredMessage(), true);
      } else {
        showPageToast(runtimeError.message || 'Translation failed.', true);
      }
      return;
    }

    try {
      if (response?.data) {
        showPanel(response.data);
        saveToObsidian(response.data, { silent: true });
      } else {
        showPageToast(response?.error || 'Translation failed.', true);
      }
    } catch (err) {
      console.error('[Polyglot]', err);
      showPageToast(err?.message || 'Translation failed.', true);
    }
  });
  if (!sent) return;
}

// ═══════════════════════════════════════════
// PANEL UI (Shadow DOM)
// ═══════════════════════════════════════════
function showPanel(data) {
  removePanel();

  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const rect = sel.getRangeAt(0).getBoundingClientRect();

  // Host element
  panelHost = document.createElement('div');
  panelHost.id = 'polyglot-ext-root';
  panelHost.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:auto;';

  const shadow = panelHost.attachShadow({ mode: 'closed' });

  shadow.innerHTML = `
<style>
*{margin:0;padding:0;box-sizing:border-box}
.pg{
  width:380px;max-height:420px;overflow-y:auto;
  background:#16161a;border:1px solid #2a2a32;border-radius:14px;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  color:#e8e6e3;font-size:14px;
  box-shadow:0 12px 48px rgba(0,0,0,0.5);
}
.pg-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 16px;border-bottom:1px solid #2a2a32;
}
.pg-logo{font-size:13px;font-weight:700;letter-spacing:-0.02em;
  background:linear-gradient(135deg,#4ecdc4,#c084fc);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.pg-lang{font-size:11px;color:#72717a;font-weight:500}
.pg-close{background:none;border:none;color:#72717a;cursor:pointer;font-size:16px;padding:2px 6px;border-radius:4px}
.pg-close:hover{background:#2a2a32;color:#e8e6e3}
.pg-body{padding:14px 16px}
.pg-section{margin-bottom:12px}
.pg-label{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#72717a;margin-bottom:6px}
.pg-original{font-size:13px;color:#9998a1;line-height:1.6;
  padding:8px 12px;background:rgba(255,255,255,0.03);border-radius:8px;
  border-left:3px solid #4ecdc4;max-height:80px;overflow-y:auto}
.pg-translated{font-size:15px;color:#e8e6e3;line-height:1.7;
  padding:10px 12px;background:rgba(78,205,196,0.05);border-radius:8px;
  border-left:3px solid #c084fc}
.pg-pronunciation{
  margin-top:6px;padding:6px 12px;
  background:rgba(251,191,36,0.06);border-radius:6px;border-left:3px solid #fbbf24;
  font-size:13px;color:#fbbf24;font-style:italic;line-height:1.5;
  font-family:'Courier New',monospace;letter-spacing:0.02em}
.pg-pron-label{font-size:9px;color:#72717a;text-transform:uppercase;letter-spacing:0.06em;
  margin-bottom:2px;font-style:normal;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif}
.pg-actions{display:flex;gap:6px;padding:0 16px 14px}
.pg-btn{flex:1;padding:8px 12px;border:1px solid #2a2a32;border-radius:8px;
  background:#16161a;color:#72717a;cursor:pointer;font-size:12px;font-weight:500;
  font-family:inherit;transition:all .15s ease;text-align:center}
.pg-btn:hover{background:#1e1e24;color:#e8e6e3;border-color:#3a3a44}
.pg-btn.primary{background:rgba(78,205,196,0.1);border-color:rgba(78,205,196,0.3);color:#4ecdc4}
.pg-btn.primary:hover{background:rgba(78,205,196,0.2)}
.pg-toast{font-size:11px;text-align:center;color:#4ecdc4;padding:0 16px 10px;display:none}
</style>

<div class="pg">
  <div class="pg-header">
    <span class="pg-logo">Polyglot</span>
    <span class="pg-lang">${esc(data.sourceLang)} → ${esc(data.targetLang)}</span>
    <button class="pg-close" id="pgClose">✕</button>
  </div>
  <div class="pg-body">
    <div class="pg-section">
      <div class="pg-label">Original</div>
      <div class="pg-original">${esc(data.original)}</div>
    </div>
    <div class="pg-section">
      <div class="pg-label">Translation</div>
      <div class="pg-translated">${esc(data.translated)}</div>
      ${data.pronunciation ? `<div class="pg-pronunciation"><div class="pg-pron-label">${data.targetKey === 'cn' ? 'Pinyin' : 'Romaji'}</div>${esc(data.pronunciation)}</div>` : ''}
    </div>
  </div>
  <div class="pg-actions">
    <button class="pg-btn" id="pgCopy">Copy</button>
    <button class="pg-btn primary" id="pgSave">Queue Note</button>
  </div>
  <div class="pg-toast" id="pgToast"></div>
</div>`;

  // ── Event handlers ──
  shadow.getElementById('pgClose').onclick = removePanel;

  shadow.getElementById('pgCopy').onclick = () => {
    navigator.clipboard.writeText(data.translated).then(() => {
      flashToast(shadow, 'Copied!');
    });
  };

  shadow.getElementById('pgSave').onclick = () => {
    saveToObsidian(data);
    flashToast(shadow, 'Queued!');
  };

  document.body.appendChild(panelHost);

  // ── Position near selection ──
  const panelW = 380;
  const panelH = 300;
  let left = rect.left + rect.width / 2 - panelW / 2;
  let top = rect.bottom + 8;

  // Keep within viewport
  if (left < 8) left = 8;
  if (left + panelW > window.innerWidth - 8) left = window.innerWidth - panelW - 8;
  if (top + panelH > window.innerHeight - 8) top = rect.top - panelH - 8;

  panelHost.style.left = left + 'px';
  panelHost.style.top = top + 'px';
}

function removePanel() {
  if (panelHost) {
    panelHost.remove();
    panelHost = null;
  }
}

function showPageToast(message, isError) {
  const existing = document.getElementById('polyglot-page-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'polyglot-page-toast';
  toast.textContent = message;
  toast.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:2147483647',
    'padding:10px 14px',
    'border-radius:10px',
    'font:500 13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    'color:#f5f5f5',
    'background:' + (isError ? '#8b1e3f' : '#0f766e'),
    'box-shadow:0 12px 28px rgba(0,0,0,0.28)'
  ].join(';');

  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 1800);
}

function flashToast(shadow, msg) {
  const toast = shadow.getElementById('pgToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  setTimeout(() => { toast.style.display = 'none'; }, 1500);
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getObsidianBuilder() {
  if (typeof PolyglotObsidian !== 'undefined' && PolyglotObsidian?.buildTranslationNote) {
    return PolyglotObsidian;
  }

  return {
    buildTranslationNote(settings, data, context) {
      const now = context?.now || new Date();
      const date = now.toISOString().split('T')[0];
      const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const base = String(settings.archiveBase || '4. Archive').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      const pageUrl = context?.pageUrl || '';
      const pageTitle = context?.pageTitle || 'Polyglot Quick Translate';
      const langMap = {
        'ko': '한국어', 'en': '영어', 'ja': '일본어',
        'zh-CN': '중국어', 'zh-TW': '중국어', 'de': '독일어',
        'fr': '프랑스어', 'es': '스페인어', 'ru': '러시아어',
        'pt': '포르투갈어', 'it': '이탈리아어', 'ar': '아랍어'
      };

      let site = 'quick-translate';
      try {
        site = new URL(pageUrl).hostname.replace(/^www\./, '').replace(/\./g, '-');
      } catch (err) { /* ignore */ }

      site = site
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '') || 'quick-translate';

      const langFolder = settings.archiveLang && settings.archiveLang !== 'auto'
        ? settings.archiveLang
        : (langMap[data.sourceCode] || data.sourceLang || 'other');
      const filePath = [base, langFolder, 'polygot', date, date + '_' + hhmm + '_' + site + '.md']
        .filter(Boolean)
        .join('/');

      const lines = [
        '#### ' + data.sourceLang + ' → ' + data.targetLang + '  |  ' + date + ' ' + time,
        '',
        '> ' + data.original.replace(/\n/g, '\n> '),
        '',
        data.translated
      ];
      if (data.pronunciation) {
        const label = data.targetKey === 'cn' ? 'Pinyin' : 'Romaji';
        lines.push('', '*' + label + ': ' + data.pronunciation + '*');
      }
      if (pageUrl) {
        lines.push('', '*Source: [' + pageTitle + '](' + pageUrl + ')*');
      } else {
        lines.push('', '*Source: ' + pageTitle + '*');
      }

      const content = lines.join('\n');
      return {
        content: content,
        date: date,
        filePath: filePath,
        langFolder: langFolder,
        uri: 'obsidian://new?vault=' + encodeURIComponent(settings.obsidianVault)
          + '&file=' + encodeURIComponent(filePath)
          + '&content=' + encodeURIComponent(content)
      };
    }
  };
}

function saveToObsidian(data, options) {
  const opts = options || {};
  const loaded = getSyncStorageSafe(['obsidianVault', 'archiveBase', 'archiveLang'], (settings) => {
    const note = getObsidianBuilder().buildTranslationNote({
      obsidianVault: settings.obsidianVault || '',
      archiveBase: settings.archiveBase || '4. Archive',
      archiveLang: settings.archiveLang || 'auto'
    }, data, {
      now: new Date(),
      pageTitle: document.title,
      pageUrl: window.location.href
    });

    const sent = sendRuntimeMessageSafe({
      action: 'queuePendingNote',
      note: {
        content: note.content,
        filePath: note.filePath,
        obsidianVault: settings.obsidianVault || '',
        source: 'content-script'
      }
    }, (response) => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) {
        if (isInvalidatedContextError(runtimeError)) {
          showPageToast(getRefreshRequiredMessage(), true);
        } else {
          showPageToast(runtimeError.message || 'Queue failed.', true);
        }
        return;
      }

      if (response?.data) {
        showPageToast('Queued → ' + note.filePath, false);
      } else {
        showPageToast(response?.error || 'Queue failed.', true);
      }
    });
    if (!sent) return;
  });
  if (!loaded) return;
}
