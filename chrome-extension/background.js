// ═══════════════════════════════════════════
// LANGUAGE CONFIG
// ═══════════════════════════════════════════
const LANG = {
  ko: { code: 'ko',    name: '한국어' },
  en: { code: 'en',    name: 'English' },
  jp: { code: 'ja',    name: '日本語' },
  cn: { code: 'zh-CN', name: '中文' },
  de: { code: 'de',    name: 'Deutsch' }
};

const CODE_TO_NAME = {
  'ko': '한국어', 'en': 'English', 'ja': '日本語',
  'zh-CN': '中文', 'zh-TW': '中文', 'de': 'Deutsch',
  'fr': 'Français', 'es': 'Español', 'pt': 'Português',
  'ru': 'Русский', 'it': 'Italiano', 'ar': 'العربية'
};

// ═══════════════════════════════════════════
// TRANSLATION API
// ═══════════════════════════════════════════
async function translateText(text, targetKey, sourceKey) {
  const tl = LANG[targetKey]?.code || 'ko';
  const sl = (!sourceKey || sourceKey === 'auto') ? 'auto' : (LANG[sourceKey]?.code || 'auto');

  const url = 'https://translate.googleapis.com/translate_a/single'
    + '?client=gtx&sl=' + encodeURIComponent(sl) + '&tl=' + encodeURIComponent(tl)
    + '&dt=t&q=' + encodeURIComponent(text);

  const res = await fetch(url);
  if (!res.ok) throw new Error('Translation API error: ' + res.status);

  const data = await res.json();

  let translated = '';
  if (data[0]) {
    for (const seg of data[0]) {
      if (seg[0]) translated += seg[0];
    }
  }

  const detectedCode = data[2] || 'unknown';
  const detectedName = CODE_TO_NAME[detectedCode] || detectedCode;
  const targetName = LANG[targetKey]?.name || targetKey;

  return {
    original: text,
    translated: translated,
    sourceLang: detectedName,
    sourceCode: detectedCode,
    targetLang: targetName,
    targetKey: targetKey
  };
}

// ═══════════════════════════════════════════
// COMMAND HANDLER (Alt+T)
// ═══════════════════════════════════════════
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // Get selection from content script
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelection' });
    if (!response?.text) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'polyglotToast',
        message: 'Select text first.',
        isError: true
      });
      return;
    }

    // Get user settings
    const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
    const targetLang = settings.targetLang || 'ko';
    const sourceLang = settings.sourceLang || 'auto';

    // Translate
    const result = await translateText(response.text, targetLang, sourceLang);

    // Save directly to Obsidian from the current page context.
    chrome.tabs.sendMessage(tab.id, { action: 'saveTranslationToObsidian', data: result });
  } catch (err) {
    console.error('[Polyglot]', err);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'polyglotToast',
          message: 'Translation failed.',
          isError: true
        });
      }
    } catch (toastErr) {
      console.error('[Polyglot]', toastErr);
    }
  }
});

// ═══════════════════════════════════════════
// MESSAGE HANDLER (from content script)
// ═══════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'translate') {
    (async () => {
      try {
        const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
        const sl = msg.sourceLang || settings.sourceLang || 'auto';
        const tl = msg.targetLang || settings.targetLang || 'ko';
        const result = await translateText(msg.text, tl, sl);
        sendResponse({ data: result });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep channel open for async response
  }
});
