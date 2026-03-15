export const CLIENT = {
  name: 'Polyglot Mobile',
  version: '1.2.0',
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
    label: '자동 감지',
    short: 'AUTO',
    folder: 'Auto',
    accent: COLORS.amber,
  },
  ko: {
    key: 'ko',
    code: 'ko',
    label: '한국어',
    short: 'KO',
    folder: 'Korean',
    accent: COLORS.mint,
  },
  en: {
    key: 'en',
    code: 'en',
    label: '영어',
    short: 'EN',
    folder: 'English',
    accent: COLORS.accent,
  },
  jp: {
    key: 'jp',
    code: 'ja',
    label: '일본어',
    short: 'JA',
    folder: 'Japanese',
    accent: '#6a4fc2',
  },
  cn: {
    key: 'cn',
    code: 'zh-CN',
    label: '중국어',
    short: 'ZH',
    folder: 'Chinese',
    accent: '#8c6d12',
  },
  de: {
    key: 'de',
    code: 'de',
    label: '독일어',
    short: 'DE',
    folder: 'German',
    accent: COLORS.sky,
  },
};

export const SOURCE_LANGUAGE_OPTIONS = ['auto', 'ko', 'en', 'jp', 'cn', 'de'];
export const TARGET_LANGUAGE_OPTIONS = ['ko', 'en', 'jp', 'cn', 'de'];
export const ARCHIVE_LANGUAGE_OPTIONS = ['auto', 'Korean', 'English', 'Japanese', 'Chinese', 'German'];
export const ARCHIVE_LANGUAGE_LABELS = {
  auto: '자동',
  Korean: '한국어',
  English: '영어',
  Japanese: '일본어',
  Chinese: '중국어',
  German: '독일어',
};

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
  '이 Obsidian 노트를 요약하고, 실행할 일을 뽑아 짧은 마크다운으로 정리해줘.';
export const DEFAULT_QUIZ_PROMPT =
  '이 노트로 짧은 회상형, 빈칸형, 도전형 문제가 섞인 재밌는 복습 퀴즈를 만들어줘.';

export const INPUT_PLACEHOLDER =
  '여기에 문장을 붙여 넣거나 입력하세요. 번역한 뒤 Obsidian 노트로 바로 정리할 수 있어요.';
