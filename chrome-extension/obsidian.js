(function (global) {
  const SOURCE_LANG_FOLDER = {
    'ko': '한국어', 'en': '영어', 'ja': '일본어',
    'zh-CN': '중국어', 'zh-TW': '중국어', 'de': '독일어',
    'fr': '프랑스어', 'es': '스페인어', 'ru': '러시아어',
    'pt': '포르투갈어', 'it': '이탈리아어', 'ar': '아랍어'
  };

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

  function getDateParts(now) {
    const date = now.toISOString().split('T')[0];
    const hhmm = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const time = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    return { date, hhmm, time };
  }

  function slugifySite(url) {
    try {
      return sanitizeFileNameSegment(
        new URL(url).hostname.replace(/^www\./, '').replace(/\./g, '-'),
        'quick-translate'
      );
    } catch (err) {
      return 'quick-translate';
    }
  }

  function resolveLangFolder(data, archiveLang) {
    if (archiveLang && archiveLang !== 'auto') return archiveLang;
    return SOURCE_LANG_FOLDER[data.sourceCode] || data.sourceLang || 'other';
  }

  function buildSourceLine(pageTitle, pageUrl) {
    if (pageTitle && pageUrl) {
      return '*Source: [' + pageTitle + '](' + pageUrl + ')*';
    }
    if (pageTitle) {
      return '*Source: ' + pageTitle + '*';
    }
    if (pageUrl) {
      return '*Source: ' + pageUrl + '*';
    }
    return '*Source: Polyglot Quick Translate*';
  }

  function buildTranslationMarkdown(data, context) {
    const now = context.now || new Date();
    const dateParts = getDateParts(now);
    const lines = [
      '#### ' + data.sourceLang + ' → ' + data.targetLang + '  |  ' + dateParts.date + ' ' + dateParts.time,
      '',
      '> ' + data.original.replace(/\n/g, '\n> '),
      '',
      data.translated
    ];

    if (data.pronunciation) {
      const label = data.targetKey === 'cn' ? 'Pinyin' : 'Romaji';
      lines.push('', '*' + label + ': ' + data.pronunciation + '*');
    }

    lines.push('', buildSourceLine(context.pageTitle, context.pageUrl));
    return lines.join('\n');
  }

  function buildTranslationFilePath(settings, data, context) {
    const now = context.now || new Date();
    const dateParts = getDateParts(now);
    const base = normalizePathPart(settings.archiveBase || '4. Archive');
    const langFolder = resolveLangFolder(data, settings.archiveLang || 'auto');
    const site = sanitizeFileNameSegment(context.siteSlug || slugifySite(context.pageUrl), 'quick-translate');
    const filename = dateParts.date + '_' + dateParts.hhmm + '_' + site + '.md';
    const parts = [base, langFolder, 'polygot', dateParts.date, filename].filter(Boolean);

    return {
      date: dateParts.date,
      filePath: parts.join('/'),
      langFolder: langFolder
    };
  }

  function buildObsidianUri(vault, filePath, content) {
    return 'obsidian://new?vault=' + encodeURIComponent(vault)
      + '&file=' + encodeURIComponent(filePath)
      + '&content=' + encodeURIComponent(content);
  }

  function buildTranslationNote(settings, data, context) {
    const fileInfo = buildTranslationFilePath(settings, data, context);
    const content = buildTranslationMarkdown(data, context);

    return {
      content: content,
      date: fileInfo.date,
      filePath: fileInfo.filePath,
      langFolder: fileInfo.langFolder,
      uri: buildObsidianUri(settings.obsidianVault, fileInfo.filePath, content)
    };
  }

  function buildEditorMarkdown(data, context) {
    const now = context.now || new Date();
    const dateParts = getDateParts(now);
    const lines = [
      '#### ' + data.sourceLang + ' Note  |  ' + dateParts.date + ' ' + dateParts.time,
      '',
      data.text
    ];

    lines.push('', buildSourceLine(context.pageTitle, context.pageUrl));
    return lines.join('\n');
  }

  function buildEditorNote(settings, data, context) {
    const fileInfo = buildTranslationFilePath(settings, {
      sourceCode: data.sourceCode,
      sourceLang: data.sourceLang
    }, context);
    const content = buildEditorMarkdown(data, context);

    return {
      content: content,
      date: fileInfo.date,
      filePath: fileInfo.filePath,
      langFolder: fileInfo.langFolder,
      uri: buildObsidianUri(settings.obsidianVault, fileInfo.filePath, content)
    };
  }

  global.PolyglotObsidian = {
    buildEditorMarkdown: buildEditorMarkdown,
    buildEditorNote: buildEditorNote,
    buildTranslationFilePath: buildTranslationFilePath,
    buildTranslationMarkdown: buildTranslationMarkdown,
    buildTranslationNote: buildTranslationNote
  };
})(globalThis);
