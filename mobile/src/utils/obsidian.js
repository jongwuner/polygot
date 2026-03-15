import { DEFAULT_SETTINGS, LANGUAGES } from '../constants';

const SOURCE_LANG_FOLDER = {
  ko: LANGUAGES.ko.folder,
  en: LANGUAGES.en.folder,
  ja: LANGUAGES.jp.folder,
  'zh-CN': LANGUAGES.cn.folder,
  'zh-TW': LANGUAGES.cn.folder,
  de: LANGUAGES.de.folder,
  fr: 'French',
  es: 'Spanish',
  pt: 'Portuguese',
  ru: 'Russian',
  it: 'Italian',
  ar: 'Arabic',
};

export function buildTranslationNote(settings, data, context = {}) {
  const fileInfo = buildTranslationFilePath(settings, data, context);
  const content = buildTranslationMarkdown(data, context);
  const vaultName = String(settings?.vaultName || '').trim();

  return {
    content,
    date: fileInfo.date,
    filePath: fileInfo.filePath,
    langFolder: fileInfo.langFolder,
    uri: vaultName ? buildObsidianUri(vaultName, fileInfo.filePath, content) : '',
  };
}

export function buildTranslationFilePath(settings, data, context = {}) {
  const now = context.now ? new Date(context.now) : new Date();
  const dateParts = getDateParts(now);
  const base = normalizePathPart(settings?.archiveBase || DEFAULT_SETTINGS.archiveBase);
  const langFolder = resolveLangFolder(data, settings?.archiveLang || DEFAULT_SETTINGS.archiveLang);
  const site = sanitizeFileNameSegment(context.siteSlug || 'mobile-app', 'mobile-app');
  const filename = `${dateParts.date}_${dateParts.hhmm}_${site}.md`;

  return {
    date: dateParts.date,
    filePath: [base, langFolder, 'polygot', dateParts.date, filename].filter(Boolean).join('/'),
    langFolder,
  };
}

export function buildTranslationMarkdown(data, context = {}) {
  const now = context.now ? new Date(context.now) : new Date();
  const dateParts = getDateParts(now);
  const original = String(data?.original || '').trim();
  const translated = String(data?.translated || '').trim();
  const lines = [
    `#### ${data?.sourceLang || 'Unknown'} -> ${data?.targetLang || 'Unknown'} | ${dateParts.date} ${dateParts.time}`,
    '',
    `> ${original.replace(/\n/g, '\n> ')}`,
    '',
    translated,
  ];

  if (data?.pronunciation) {
    const label = data.targetKey === 'cn' ? 'Pinyin' : 'Romaji';
    lines.push('', `*${label}: ${data.pronunciation}*`);
  }

  lines.push('', buildSourceLine(context.pageTitle, context.pageUrl));
  return lines.join('\n');
}

export function buildPathPreview(settings, sourceCode = 'ko') {
  return buildTranslationFilePath(
    settings,
    {
      sourceCode,
      sourceLang: SOURCE_LANG_FOLDER[sourceCode] || 'Archive',
    },
    {
      now: new Date('2026-03-15T14:30:00'),
      siteSlug: 'mobile-app',
    }
  ).filePath;
}

function buildObsidianUri(vaultName, filePath, content) {
  return (
    'obsidian://new?vault=' +
    encodeURIComponent(vaultName) +
    '&file=' +
    encodeURIComponent(filePath) +
    '&content=' +
    encodeURIComponent(content)
  );
}

function buildSourceLine(pageTitle, pageUrl) {
  if (pageTitle && pageUrl) {
    return `*Source: [${pageTitle}](${pageUrl})*`;
  }
  if (pageTitle) {
    return `*Source: ${pageTitle}*`;
  }
  if (pageUrl) {
    return `*Source: ${pageUrl}*`;
  }
  return '*Source: Polyglot Mobile*';
}

function resolveLangFolder(data, archiveLang) {
  if (archiveLang && archiveLang !== 'auto') {
    return archiveLang;
  }

  return SOURCE_LANG_FOLDER[data?.sourceCode] || data?.sourceLang || 'Archive';
}

function getDateParts(now) {
  const date = now.toISOString().split('T')[0];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return {
    date,
    hhmm: `${hh}${mm}`,
    time: `${hh}:${mm}`,
  };
}

function normalizePathPart(part) {
  return String(part || '')
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

function sanitizeFileNameSegment(value, fallback) {
  const cleaned = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return cleaned || fallback;
}
