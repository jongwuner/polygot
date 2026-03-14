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

  // Fetch pronunciation for Chinese (pinyin) and Japanese (romaji)
  let pronunciation = '';
  if ((targetKey === 'cn' || targetKey === 'jp') && translated) {
    pronunciation = await fetchPronunciation(translated, tl);
  }

  return {
    original: text,
    translated: translated,
    pronunciation: pronunciation,
    sourceLang: detectedName,
    sourceCode: detectedCode,
    targetLang: targetName,
    targetKey: targetKey
  };
}

// ═══════════════════════════════════════════
// PRONUNCIATION (pinyin / romaji)
// Translates target text → English with dt=rm
// to extract source-side romanization
// ═══════════════════════════════════════════
async function fetchPronunciation(text, langCode) {
  try {
    const url = 'https://translate.googleapis.com/translate_a/single'
      + '?client=gtx&sl=' + encodeURIComponent(langCode)
      + '&tl=en&dt=t&dt=rm&q=' + encodeURIComponent(text);

    const res = await fetch(url);
    if (!res.ok) return '';
    const data = await res.json();

    // Method 1: index 3 of each translation segment = source romanization
    if (data[0]) {
      let pron = '';
      for (const seg of data[0]) {
        if (typeof seg[3] === 'string') pron += seg[3] + ' ';
      }
      pron = pron.trim();
      if (pron) return pron;
    }

    // Method 2: search dt=rm arrays (typically near end of response)
    for (let i = data.length - 1; i >= 3; i--) {
      if (!Array.isArray(data[i])) continue;
      let found = '';
      for (const item of data[i]) {
        if (!Array.isArray(item)) continue;
        const candidate = item[2] || item[3];
        if (typeof candidate === 'string' && candidate.length > 0) {
          found += candidate + ' ';
        }
      }
      found = found.trim();
      if (found) return found;
    }
  } catch (e) {
    console.error('[Polyglot] Pronunciation fetch failed:', e);
  }
  return '';
}

// ═══════════════════════════════════════════
// CONTEXT MENU (Right-click)
// ═══════════════════════════════════════════
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'polyglot-translate',
    title: 'Polyglot: Translate "%s"',
    contexts: ['selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'polyglot-translate') return;
  if (!info.selectionText || !tab?.id) return;
  await translateAndShow(tab.id, info.selectionText.trim());
});

// ═══════════════════════════════════════════
// COMMAND HANDLER (Alt+T)
// ═══════════════════════════════════════════
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-selection') return;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const response = await sendTabMessage(tab.id, { action: 'getSelection' });
    if (!response?.text) {
      await sendTabMessage(tab.id, {
        action: 'polyglotToast',
        message: 'Select text first.',
        isError: true
      }).catch(() => {});
      return;
    }

    await translateAndShow(tab.id, response.text);
  } catch (err) {
    console.error('[Polyglot]', err);
    notifyError(err);
  }
});

// ═══════════════════════════════════════════
// SHARED: translate + show/save
// ═══════════════════════════════════════════
async function translateAndShow(tabId, text) {
  try {
    const settings = await chrome.storage.sync.get(['sourceLang', 'targetLang']);
    const targetLang = settings.targetLang || 'ko';
    const sourceLang = settings.sourceLang || 'auto';

    const result = await translateText(text, targetLang, sourceLang);

    // Show panel (drag/context-menu) AND save to Obsidian
    await sendTabMessage(tabId, { action: 'showTranslation', data: result });
    await sendTabMessage(tabId, { action: 'saveTranslationToObsidian', data: result });
  } catch (err) {
    console.error('[Polyglot]', err);
    try {
      await sendTabMessage(tabId, {
        action: 'polyglotToast',
        message: getUserFacingError(err),
        isError: true
      });
    } catch (e) { /* ignore */ }
  }
}

async function sendTabMessage(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (isInvalidatedContextError(err)) {
      throw new Error('TAB_REFRESH_REQUIRED');
    }
    throw err;
  }
}

function isInvalidatedContextError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('receiving end does not exist')
    || message.includes('extension context invalidated')
    || message.includes('message port closed');
}

function getUserFacingError(err) {
  if (String(err?.message || '') === 'TAB_REFRESH_REQUIRED') {
    return 'Extension updated. Refresh this tab once and try again.';
  }
  return 'Translation failed.';
}

async function notifyError(err) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await sendTabMessage(tab.id, {
        action: 'polyglotToast',
        message: getUserFacingError(err),
        isError: true
      });
    }
  } catch (e) { /* ignore */ }
}

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
