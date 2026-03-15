export const CLIENT = {
  name: 'Polyglot Mobile',
  version: '1.1.0',
};

export const CLIENT_RELEASES = {
  web: '1.3.0',
  extension: '1.5.1',
  mobile: CLIENT.version,
};

export const COLORS = {
  canvas: '#f4efe5',
  ink: '#1f1b18',
  inkSoft: '#645c54',
  card: '#fffaf2',
  cardStrong: '#1f1d1a',
  line: '#d7cbb9',
  lineStrong: '#ab9982',
  accent: '#c45a3d',
  accentStrong: '#92402a',
  accentSoft: '#edd1c7',
  mint: '#1f7666',
  mintSoft: '#d2ebe6',
  amber: '#9b6400',
  amberSoft: '#f3e0bc',
  sky: '#2b65b9',
  skySoft: '#dbe7f7',
  danger: '#8c2f39',
  dangerSoft: '#f3d9dd',
};

export const LANGUAGES = {
  auto: {
    key: 'auto',
    code: 'auto',
    label: 'Auto Detect',
    short: 'AUTO',
    folder: 'Auto',
    accent: COLORS.amber,
  },
  ko: {
    key: 'ko',
    code: 'ko',
    label: 'Korean',
    short: 'KO',
    folder: 'Korean',
    accent: COLORS.mint,
  },
  en: {
    key: 'en',
    code: 'en',
    label: 'English',
    short: 'EN',
    folder: 'English',
    accent: COLORS.accent,
  },
  jp: {
    key: 'jp',
    code: 'ja',
    label: 'Japanese',
    short: 'JA',
    folder: 'Japanese',
    accent: '#6a4fc2',
  },
  cn: {
    key: 'cn',
    code: 'zh-CN',
    label: 'Chinese',
    short: 'ZH',
    folder: 'Chinese',
    accent: '#8c6d12',
  },
  de: {
    key: 'de',
    code: 'de',
    label: 'German',
    short: 'DE',
    folder: 'German',
    accent: COLORS.sky,
  },
};

export const SOURCE_LANGUAGE_OPTIONS = ['auto', 'ko', 'en', 'jp', 'cn', 'de'];
export const TARGET_LANGUAGE_OPTIONS = ['ko', 'en', 'jp', 'cn', 'de'];
export const ARCHIVE_LANGUAGE_OPTIONS = ['auto', 'Korean', 'English', 'Japanese', 'Chinese', 'German'];

export const STORAGE_KEYS = {
  settings: 'polyglot_mobile_settings',
  history: 'polyglot_mobile_history',
  notes: 'polyglot_mobile_notes',
};

export const DEFAULT_SETTINGS = {
  sourceLang: 'auto',
  targetLang: 'ko',
  vaultName: '',
  archiveBase: '4. Archive',
  archiveLang: 'auto',
  selectedNoteId: '',
  llmModelUri: '',
  llmModelName: '',
  llmContextSize: 2048,
  llmMaxTokens: 512,
  llmGpuLayers: 99,
};

export const HISTORY_LIMIT = 50;
export const NOTE_LIMIT = 20;
export const MAX_NOTE_CHARS_FOR_LLM = 6000;
export const DEFAULT_AI_PROMPT =
  'Summarize this Obsidian note, extract action items, and answer in concise markdown.';

export const INPUT_PLACEHOLDER =
  'Paste or type text here. Translate it, then stage an Obsidian-ready note.';
