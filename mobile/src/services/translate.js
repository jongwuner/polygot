import { LANGUAGES } from '../constants';

const API_BASE = 'https://translate.googleapis.com/translate_a/single';

const CODE_TO_LABEL = {
  ko: LANGUAGES.ko.label,
  en: LANGUAGES.en.label,
  ja: LANGUAGES.jp.label,
  'zh-CN': LANGUAGES.cn.label,
  'zh-TW': LANGUAGES.cn.label,
  de: LANGUAGES.de.label,
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  it: 'Italian',
  ar: 'Arabic',
};

export async function translateText(text, targetKey, sourceKey = 'auto') {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Enter text to translate.');
  }

  const target = LANGUAGES[targetKey];
  if (!target || targetKey === 'auto') {
    throw new Error('Choose a target language.');
  }

  const source = sourceKey === 'auto' ? LANGUAGES.auto : LANGUAGES[sourceKey];
  const sl = source?.code || 'auto';
  const tl = target.code;

  const url =
    `${API_BASE}?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(cleanText)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation API error: ${response.status}`);
  }

  const data = await response.json();

  let translated = '';
  if (Array.isArray(data[0])) {
    for (const segment of data[0]) {
      if (segment?.[0]) {
        translated += segment[0];
      }
    }
  }

  if (!translated) {
    throw new Error('Translation returned an empty response.');
  }

  const detectedCode = data[2] || source?.code || 'unknown';
  const detectedName = CODE_TO_LABEL[detectedCode] || detectedCode;

  let pronunciation = '';
  if ((targetKey === 'cn' || targetKey === 'jp') && translated) {
    pronunciation = await fetchPronunciation(translated, tl);
  }

  return {
    original: cleanText,
    translated,
    pronunciation,
    sourceLang: detectedName,
    sourceCode: detectedCode,
    targetLang: target.label,
    targetKey,
  };
}

async function fetchPronunciation(text, langCode) {
  try {
    const url =
      `${API_BASE}?client=gtx&sl=${encodeURIComponent(langCode)}&tl=en&dt=t&dt=rm&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);
    if (!response.ok) {
      return '';
    }

    const data = await response.json();

    if (Array.isArray(data[0])) {
      let inlineRomanization = '';
      for (const segment of data[0]) {
        if (typeof segment?.[3] === 'string') {
          inlineRomanization += `${segment[3]} `;
        }
      }
      inlineRomanization = inlineRomanization.trim();
      if (inlineRomanization) {
        return inlineRomanization;
      }
    }

    for (let index = data.length - 1; index >= 3; index -= 1) {
      const candidateGroup = data[index];
      if (!Array.isArray(candidateGroup)) {
        continue;
      }

      let fallbackRomanization = '';
      for (const item of candidateGroup) {
        if (!Array.isArray(item)) {
          continue;
        }

        const candidate = item[2] || item[3];
        if (typeof candidate === 'string' && candidate.length > 0) {
          fallbackRomanization += `${candidate} `;
        }
      }

      fallbackRomanization = fallbackRomanization.trim();
      if (fallbackRomanization) {
        return fallbackRomanization;
      }
    }
  } catch (error) {
    console.warn('[Polyglot] pronunciation lookup failed', error);
  }

  return '';
}
