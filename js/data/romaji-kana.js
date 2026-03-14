// ═══════════════════════════════════════════
// ROMAJI → KANA MAPPING
// ═══════════════════════════════════════════
var R2H = {
  'a':'あ','i':'い','u':'う','e':'え','o':'お',
  'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
  'sa':'さ','si':'し','shi':'し','su':'す','se':'せ','so':'そ',
  'ta':'た','ti':'ち','chi':'ち','tu':'つ','tsu':'つ','te':'て','to':'と',
  'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
  'ha':'は','hi':'ひ','hu':'ふ','fu':'ふ','he':'へ','ho':'ほ',
  'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
  'ya':'や','yu':'ゆ','yo':'よ',
  'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
  'wa':'わ','wi':'ゐ','we':'ゑ','wo':'を',
  'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
  'za':'ざ','zi':'じ','ji':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
  'da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど',
  'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
  'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
  'kya':'きゃ','kyi':'きぃ','kyu':'きゅ','kye':'きぇ','kyo':'きょ',
  'sha':'しゃ','shu':'しゅ','she':'しぇ','sho':'しょ',
  'sya':'しゃ','syu':'しゅ','syo':'しょ',
  'cha':'ちゃ','chu':'ちゅ','che':'ちぇ','cho':'ちょ',
  'tya':'ちゃ','tyu':'ちゅ','tyo':'ちょ',
  'nya':'にゃ','nyi':'にぃ','nyu':'にゅ','nye':'にぇ','nyo':'にょ',
  'hya':'ひゃ','hyi':'ひぃ','hyu':'ひゅ','hye':'ひぇ','hyo':'ひょ',
  'mya':'みゃ','myi':'みぃ','myu':'みゅ','mye':'みぇ','myo':'みょ',
  'rya':'りゃ','ryi':'りぃ','ryu':'りゅ','rye':'りぇ','ryo':'りょ',
  'gya':'ぎゃ','gyi':'ぎぃ','gyu':'ぎゅ','gye':'ぎぇ','gyo':'ぎょ',
  'ja':'じゃ','ju':'じゅ','je':'じぇ','jo':'じょ',
  'jya':'じゃ','jyu':'じゅ','jyo':'じょ',
  'bya':'びゃ','byi':'びぃ','byu':'びゅ','bye':'びぇ','byo':'びょ',
  'pya':'ぴゃ','pyi':'ぴぃ','pyu':'ぴゅ','pye':'ぴぇ','pyo':'ぴょ',
  'fa':'ふぁ','fi':'ふぃ','fe':'ふぇ','fo':'ふぉ',
  'va':'ゔぁ','vi':'ゔぃ','vu':'ゔ','ve':'ゔぇ','vo':'ゔぉ',
  'thi':'てぃ','thu':'てゅ','dhi':'でぃ','dhu':'でゅ',
  'twu':'とぅ','dwu':'どぅ',
  'tsa':'つぁ','tsi':'つぃ','tse':'つぇ','tso':'つぉ',
  'whi':'うぃ','whe':'うぇ','who':'うぉ',
  'nn':'ん',"n'":'ん',
  'xtu':'っ','xtsu':'っ','ltu':'っ','ltsu':'っ',
  'xa':'ぁ','xi':'ぃ','xu':'ぅ','xe':'ぇ','xo':'ぉ',
  'xya':'ゃ','xyu':'ゅ','xyo':'ょ',
  'xwa':'ゎ'
};

// Build katakana map (hiragana code + 96 = katakana)
var R2K = {};
(function(){
  for(var k in R2H){
    var h = R2H[k];
    var kata = '';
    for(var i=0;i<h.length;i++){
      var code = h.charCodeAt(i);
      if(code >= 0x3041 && code <= 0x3096) kata += String.fromCharCode(code + 96);
      else if(code === 0x3099 || code === 0x309A) kata += h[i];
      else kata += h[i];
    }
    R2K[k] = kata;
  }
})();

// Check if buffer could be start of a valid romaji
var R2H_KEYS = Object.keys(R2H).sort(function(a,b){return b.length - a.length;});
function couldBeRomaji(buf) {
  if(!buf) return false;
  var low = buf.toLowerCase();
  for(var i=0;i<R2H_KEYS.length;i++){
    if(R2H_KEYS[i].indexOf(low) === 0) return true;
  }
  // double consonant start
  if(low.length === 1 && 'kstcgzdbpfrhj'.indexOf(low) >= 0) return true;
  if(low.length === 2 && low[0] === low[1] && 'kstcgzdbpfrhj'.indexOf(low[0]) >= 0) return true;
  return false;
}
