// ═══════════════════════════════════════════
// POPUP — Settings + Quick Translate
// ═══════════════════════════════════════════

const SETTINGS_KEYS = ['sourceLang', 'targetLang', 'obsidianVault', 'archiveBase', 'archiveLang'];

// ── Load saved settings ──────────────────
chrome.storage.sync.get(SETTINGS_KEYS, (s) => {
  document.getElementById('sourceLang').value  = s.sourceLang  || 'auto';
  document.getElementById('targetLang').value  = s.targetLang  || 'ko';
  document.getElementById('vaultName').value   = s.obsidianVault || '';
  document.getElementById('archiveBase').value = s.archiveBase || '4. Archive';
  document.getElementById('archiveLang').value = s.archiveLang || 'auto';
  updatePathPreview();
  refreshQueueStatus();
});

// ── Swap source ↔ target ─────────────────
document.getElementById('swapBtn').addEventListener('click', () => {
  const src = document.getElementById('sourceLang');
  const tgt = document.getElementById('targetLang');

  // Can't swap if source is auto
  if (src.value === 'auto') return;

  const tmp = src.value;
  src.value = tgt.value;
  tgt.value = tmp;
});

// ── Save settings ────────────────────────
document.getElementById('saveSettings').addEventListener('click', () => {
  chrome.storage.sync.set({
    sourceLang:    document.getElementById('sourceLang').value,
    targetLang:    document.getElementById('targetLang').value,
    obsidianVault: document.getElementById('vaultName').value.trim(),
    archiveBase:   document.getElementById('archiveBase').value.trim() || '4. Archive',
    archiveLang:   document.getElementById('archiveLang').value
  }, () => {
    const btn = document.getElementById('saveSettings');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save Settings'; }, 1200);
    refreshQueueStatus();
  });
});

// ── Path preview ─────────────────────────
document.getElementById('archiveBase').addEventListener('input', updatePathPreview);
document.getElementById('archiveLang').addEventListener('change', updatePathPreview);

function updatePathPreview() {
  const base = document.getElementById('archiveBase').value.trim() || '4. Archive';
  const lang = document.getElementById('archiveLang').value;
  const folder = lang === 'auto' ? '{감지된 언어}' : lang;
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('pathPreview').textContent =
    base + '/' + folder + '/polygot/' + today + '/' + today + '_1430_example-com.md';
}

// ── Quick Translate ──────────────────────
document.getElementById('translateBtn').addEventListener('click', async () => {
  const text = document.getElementById('inputText').value.trim();
  if (!text) return;

  const btn = document.getElementById('translateBtn');
  btn.textContent = 'Translating...';
  btn.disabled = true;

  const sourceLang = document.getElementById('sourceLang').value;
  const targetLang = document.getElementById('targetLang').value;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      text,
      sourceLang,
      targetLang
    });

    const result = document.getElementById('resultArea');
    if (response?.data) {
      const d = response.data;
      let html = '<div class="result-meta">' + esc(d.sourceLang) + ' → ' + esc(d.targetLang) + '</div>' +
        esc(d.translated);
      if (d.pronunciation) {
        const label = d.targetKey === 'cn' ? 'Pinyin' : 'Romaji';
        html += '<div class="result-pron">' + label + ': ' + esc(d.pronunciation) + '</div>';
      }
      const queueResult = await queueTranslationFromPopup(d);
      if (queueResult.ok) {
        html += '<div class="result-meta">Queued → ' + esc(queueResult.note.filePath) + '</div>';
      } else if (queueResult.error) {
        html += '<div class="result-meta">' + esc(queueResult.error) + '</div>';
      }
      result.innerHTML = html;
      result.classList.add('active');
      refreshQueueStatus();
    } else {
      result.innerHTML = '<div class="result-meta">Error</div>' + esc(response?.error || 'Unknown error');
      result.classList.add('active');
    }
  } catch (err) {
    console.error(err);
  } finally {
    btn.textContent = 'Translate';
    btn.disabled = false;
  }
});

// Enter key to translate
document.getElementById('inputText').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('translateBtn').click();
  }
});

document.getElementById('flushOneBtn').addEventListener('click', async () => {
  await runQueueAction('one');
});

document.getElementById('flushAllBtn').addEventListener('click', async () => {
  await runQueueAction('all');
});

document.getElementById('clearQueueBtn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ action: 'clearPendingNotes' });
  const result = document.getElementById('resultArea');
  if (response?.data) {
    result.innerHTML = '<div class="result-meta">Queue</div>Cleared pending queue.';
    result.classList.add('active');
  } else {
    result.innerHTML = '<div class="result-meta">Queue Error</div>' + esc(response?.error || 'Failed to clear queue.');
    result.classList.add('active');
  }
  refreshQueueStatus();
});

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function getPopupObsidianSettings() {
  return {
    obsidianVault: document.getElementById('vaultName').value.trim(),
    archiveBase: document.getElementById('archiveBase').value.trim() || '4. Archive',
    archiveLang: document.getElementById('archiveLang').value
  };
}

async function getActiveTabContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) {
      return {
        pageTitle: 'Polyglot Quick Translate',
        pageUrl: ''
      };
    }

    return {
      pageTitle: tab.title || 'Polyglot Quick Translate',
      pageUrl: tab.url || ''
    };
  } catch (err) {
    return {
      pageTitle: 'Polyglot Quick Translate',
      pageUrl: ''
    };
  }
}

async function saveTranslationFromPopup(data) {
  return queueTranslationFromPopup(data);
}

async function queueTranslationFromPopup(data) {
  const settings = getPopupObsidianSettings();
  const context = await getActiveTabContext();
  const note = PolyglotObsidian.buildTranslationNote(settings, data, {
    now: new Date(),
    pageTitle: context.pageTitle,
    pageUrl: context.pageUrl
  });

  const response = await chrome.runtime.sendMessage({
    action: 'queuePendingNote',
    note: {
      content: note.content,
      filePath: note.filePath,
      obsidianVault: settings.obsidianVault || '',
      source: 'popup'
    }
  });

  if (response?.data) {
    return { ok: true, note: note };
  }
  return { ok: false, error: response?.error || 'Queue failed.' };
}

async function refreshQueueStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getPendingNotesSummary' });
  const countEl = document.getElementById('queueCount');
  const previewEl = document.getElementById('queuePreview');
  const flushOneBtn = document.getElementById('flushOneBtn');
  const flushAllBtn = document.getElementById('flushAllBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  if (!response?.data) {
    countEl.textContent = 'Queue unavailable';
    previewEl.textContent = response?.error || 'Failed to load queue.';
    flushOneBtn.disabled = true;
    flushAllBtn.disabled = true;
    clearQueueBtn.disabled = true;
    return;
  }

  const summary = response.data;
  countEl.textContent = summary.count + ' queued';
  previewEl.textContent = summary.latestPath || 'Queue is empty.';
  flushOneBtn.disabled = summary.count === 0;
  flushAllBtn.disabled = summary.count === 0;
  clearQueueBtn.disabled = summary.count === 0;
}

async function runQueueAction(mode) {
  const response = await chrome.runtime.sendMessage({
    action: 'flushPendingNotes',
    mode: mode
  });
  const result = document.getElementById('resultArea');

  if (response?.data) {
    const flushedCount = response.data.flushedCount || 0;
    const remainingCount = response.data.remainingCount || 0;
    result.innerHTML = '<div class="result-meta">Queue</div>'
      + 'Opened ' + esc(String(flushedCount)) + ' queued note'
      + (flushedCount === 1 ? '' : 's')
      + ' for Obsidian. Remaining: ' + esc(String(remainingCount));
    result.classList.add('active');
  } else {
    result.innerHTML = '<div class="result-meta">Queue Error</div>' + esc(response?.error || 'Failed to open Obsidian.');
    result.classList.add('active');
  }

  refreshQueueStatus();
}
