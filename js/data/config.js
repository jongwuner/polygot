// ═══════════════════════════════════════════
// PINYIN TONE SYSTEM
// ═══════════════════════════════════════════
var TONE_MAP = {
  'a': ['ā','á','ǎ','à'], 'e': ['ē','é','ě','è'],
  'i': ['ī','í','ǐ','ì'], 'o': ['ō','ó','ǒ','ò'],
  'u': ['ū','ú','ǔ','ù'], 'ü': ['ǖ','ǘ','ǚ','ǜ'],
  'v': ['ǖ','ǘ','ǚ','ǜ']
};

function stripTones(str) {
  return str
    .replace(/[āáǎà]/g,'a').replace(/[ēéěè]/g,'e').replace(/[īíǐì]/g,'i')
    .replace(/[ōóǒò]/g,'o').replace(/[ūúǔù]/g,'u').replace(/[ǖǘǚǜ]/g,'v');
}

function addToneMark(syllable, tone) {
  if(tone < 1 || tone > 4) return syllable;
  var t = tone - 1;
  var stripped = stripTones(syllable);
  var s = stripped.toLowerCase();
  var vowels = 'aeiouüv';
  if(s.indexOf('a') >= 0) return replaceTone(stripped, 'a', t);
  if(s.indexOf('e') >= 0) return replaceTone(stripped, 'e', t);
  if(s.indexOf('ou') >= 0) return replaceTone(stripped, 'o', t);
  for(var i = s.length-1; i >= 0; i--){
    if(vowels.indexOf(s[i]) >= 0) return replaceTone(stripped, s[i], t);
  }
  return stripped;
}

function replaceTone(str, vowel, toneIdx) {
  var idx = str.toLowerCase().indexOf(vowel);
  if(idx < 0) return str;
  var replacement = TONE_MAP[vowel] ? TONE_MAP[vowel][toneIdx] : vowel;
  return str.substring(0, idx) + replacement + str.substring(idx + 1);
}

// ═══════════════════════════════════════════
// UI CONFIGURATION
// ═══════════════════════════════════════════
var ACCENTS = {ko:'#4ecdc4',en:'#ff6b6b',jp:'#c084fc',cn:'#fbbf24',de:'#60a5fa'};
var NAMES = {ko:'한국어',en:'English',jp:'日本語',cn:'中文',de:'Deutsch'};
var PLACEHOLDERS = {ko:'여기에 입력하세요...',en:'Start typing here...',jp:'ローマ字で入力 (例: konnichiha → こんにちは)',cn:'拼音으로 입력 (例: nihao + Space → 你好)',de:'Hier eingeben...'};

var QUICK_CHARS = {
  ko:[
    'ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ',
    'ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'
  ],
  en:[],jp:[],cn:[],
  de:['ä','ö','ü','Ä','Ö','Ü','ß','€']
};

var HINTS = {
  ko:{title:'입력 방법',items:['OS 한/영 키로 전환하여 한글 입력','Windows: 한/영 키 또는 Right Alt','Mac: ⌘ + Space 또는 Caps Lock']},
  en:{title:'Typing Tips',items:['Type directly — standard QWERTY layout','Use Ctrl+1~5 to switch languages']},
  jp:{title:'ローマ字入力ガイド',items:[
    '소문자 입력 → ひらがな (hiragana): konnichiha → こんにちは',
    'SHIFT+대문자 입력 → カタカナ (katakana): KONNICHIHA → コンニチハ',
    'nn 또는 n+자음 → ん: shinbun → しんぶん',
    '같은 자음 2개 → っ: kitte → きって',
    'Enter: 버퍼 확정 / Esc: 버퍼 취소'
  ]},
  cn:{title:'拼音输入指南',items:[
    '핀인 입력 후 Space → 한자 후보 표시',
    '숫자 1~4 → 성조 부호 추가/변경 (ā á ǎ à)',
    'v → ü (예: nv3 → nǚ)',
    '후보에서 숫자 키로 선택',
    'Enter: 핀인 그대로 확정 / Esc: 버퍼 취소'
  ]},
  de:{title:'Eingabetipps',items:['Sonderzeichen über die Buttons unten einfügen','Mac: Option+U dann Vokal für Umlaute','ß = Option+S (Mac) / Alt+225 (Win)']}
};
