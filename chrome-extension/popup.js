// ═══════════════════════════════════════════
// POPUP — Settings + Quick Translate
// ═══════════════════════════════════════════

const LANG_NAMES = {
  ko: '한국어', en: 'English', jp: '日本語', cn: '中文', de: 'Deutsch'
};

// ── Load saved settings ──────────────────
chrome.storage.sync.get(['targetLang', 'obsidianVault', 'archiveFile'], (s) => {
  const lang = s.targetLang || 'ko';
  setActiveChip(lang);
  document.getElementById('vaultName').value = s.obsidianVault || '';
  document.getElementById('archiveFile').value = s.archiveFile || 'Foreign Language Archive';
});

// ── Language chip selection ──────────────
document.getElementById('langOptions').addEventListener('click', (e) => {
  const chip = e.target.closest('.lang-chip');
  if (!chip) return;
  setActiveChip(chip.dataset.lang);
});

function setActiveChip(lang) {
  document.querySelectorAll('.lang-chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.lang === lang);
  });
}

function getSelectedLang() {
  const active = document.querySelector('.lang-chip.active');
  return active ? active.dataset.lang : 'ko';
}

// ── Save settings ────────────────────────
document.getElementById('saveSettings').addEventListener('click', () => {
  chrome.storage.sync.set({
    targetLang:    getSelectedLang(),
    obsidianVault: document.getElementById('vaultName').value.trim(),
    archiveFile:   document.getElementById('archiveFile').value.trim() || 'Foreign Language Archive'
  }, () => {
    const btn = document.getElementById('saveSettings');
    btn.textContent = 'Saved!';
    setTimeout(() => { btn.textContent = 'Save Settings'; }, 1200);
  });
});

// ── Quick Translate ──────────────────────
document.getElementById('translateBtn').addEventListener('click', async () => {
  const text = document.getElementById('inputText').value.trim();
  if (!text) return;

  const btn = document.getElementById('translateBtn');
  btn.textContent = 'Translating...';
  btn.disabled = true;

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      text: text
    });

    const result = document.getElementById('resultArea');
    if (response?.data) {
      const d = response.data;
      result.innerHTML =
        '<div class="result-meta">' + esc(d.sourceLang) + ' → ' + esc(d.targetLang) + '</div>' +
        esc(d.translated);
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
