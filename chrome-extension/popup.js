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
    base + '/' + folder + '/polygot/' + today + '/...';
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
      result.innerHTML = html;
      result.classList.add('active');
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

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}
