// ═══════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════
var currentLang = 'ko';
var textStore = {ko:'',en:'',jp:'',cn:'',de:''};
var jpBuffer = '';
var cnBuffer = '';
var cnCandidates = [];

// ═══════════════════════════════════════════
// CORE FUNCTIONS
// ═══════════════════════════════════════════
function handleTabClick(lang) {
  switchLang(lang);
  showToast('→ ' + NAMES[lang]);
}

function switchLang(lang) {
  var ed = document.getElementById('editor');
  commitBuffer();
  textStore[currentLang] = ed.value;
  currentLang = lang;
  jpBuffer = '';
  cnBuffer = '';
  cnCandidates = [];

  var tabs = document.querySelectorAll('.lang-tab');
  for(var i=0;i<tabs.length;i++){
    tabs[i].className = tabs[i].getAttribute('data-lang')===lang ? 'lang-tab active' : 'lang-tab';
  }

  ed.value = textStore[lang];
  ed.placeholder = PLACEHOLDERS[lang];
  document.getElementById('editorCard').setAttribute('data-active',lang);
  var cl = document.getElementById('currentLang');
  cl.textContent = NAMES[lang];
  cl.style.color = ACCENTS[lang];

  updateModeBadge();
  updateImeDisplay();
  hideCandidates();
  buildQuickInsert(lang);
  buildHints(lang);
  updateStats();
  ed.focus();
}

function updateModeBadge() {
  var badge = document.getElementById('modeBadge');
  if(currentLang === 'jp') {
    badge.innerHTML = '<span class="mode-badge hira">ひら</span>';
  } else if(currentLang === 'cn') {
    badge.innerHTML = '<span class="mode-badge pinyin">拼音</span>';
  } else {
    badge.innerHTML = '';
  }
}

function updateImeDisplay() {
  var wrap = document.getElementById('imeBufferWrap');
  var label = document.getElementById('imeBufferLabel');
  var disp = document.getElementById('imeBufferDisplay');

  if(currentLang === 'jp' && jpBuffer) {
    wrap.className = 'ime-buffer-wrap active';
    label.textContent = 'Romaji';
    disp.className = 'ime-buffer jp-buf';
    disp.textContent = jpBuffer;
  } else if(currentLang === 'cn' && cnBuffer) {
    wrap.className = 'ime-buffer-wrap active';
    label.textContent = 'Pinyin';
    disp.className = 'ime-buffer';
    disp.textContent = cnBuffer;
  } else {
    wrap.className = 'ime-buffer-wrap';
  }
}

function showCandidates(chars) {
  var wrap = document.getElementById('candidatesWrap');
  var list = document.getElementById('candidatesList');
  if(!chars || !chars.length) { hideCandidates(); return; }
  cnCandidates = chars;
  var html = '';
  for(var i=0;i<chars.length && i<9;i++){
    html += '<button class="cand-btn" onclick="selectCandidate('+i+')"><span class="cand-num">'+(i+1)+'</span>'+chars[i]+'</button>';
  }
  list.innerHTML = html;
  wrap.className = 'candidates-wrap active';
}

function hideCandidates() {
  document.getElementById('candidatesWrap').className = 'candidates-wrap';
  cnCandidates = [];
}

function selectCandidate(idx) {
  if(idx < cnCandidates.length) {
    insertText(cnCandidates[idx]);
    cnBuffer = '';
    updateImeDisplay();
    hideCandidates();
    document.getElementById('editor').focus();
  }
}

function insertText(text) {
  var ed = document.getElementById('editor');
  var s = ed.selectionStart;
  var e = ed.selectionEnd;
  ed.value = ed.value.substring(0,s) + text + ed.value.substring(e);
  ed.selectionStart = ed.selectionEnd = s + text.length;
  textStore[currentLang] = ed.value;
  updateStats();
}

function commitBuffer() {
  if(currentLang === 'jp' && jpBuffer) {
    if(jpBuffer.toLowerCase() === 'n') {
      insertText('ん');
    } else if(jpBuffer) {
      insertText(jpBuffer);
    }
    jpBuffer = '';
    updateImeDisplay();
  }
  if(currentLang === 'cn' && cnBuffer) {
    insertText(cnBuffer);
    cnBuffer = '';
    updateImeDisplay();
    hideCandidates();
  }
}

// ═══════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════
function buildQuickInsert(lang) {
  var qi = document.getElementById('quickInsert');
  var chars = QUICK_CHARS[lang];
  if(!chars || !chars.length) { qi.innerHTML=''; return; }
  var labels={ko:'자모 삽입',de:'Sonderzeichen'};
  var h = '<div class="section-label">'+(labels[lang]||'Special Characters')+'</div><div class="quick-insert">';
  for(var i=0;i<chars.length;i++){
    h+='<button class="qi-btn" onclick="insertChar(\''+chars[i]+'\')">'+chars[i]+'</button>';
  }
  h+='</div>';
  qi.innerHTML=h;
}

function insertChar(ch) {
  insertText(ch);
  document.getElementById('editor').focus();
}

function buildHints(lang) {
  var el = document.getElementById('imeHint');
  var h = HINTS[lang];
  var html = '<h3>'+h.title+'</h3><div class="hint-grid">';
  for(var i=0;i<h.items.length;i++){
    html += '<div class="hint-item"><span class="hint-desc">'+h.items[i]+'</span></div>';
  }
  html += '</div>';
  el.innerHTML = html;
}

function updateStats() {
  var text = document.getElementById('editor').value;
  document.getElementById('charCount').textContent = text.length + ' chars';
  document.getElementById('lineCount').textContent = text ? text.split('\n').length : 1;
  var latin = text.match(/[a-zA-Z\u00C0-\u024F]+/g) || [];
  var cjk = text.match(/[\u3000-\u9fff\uac00-\ud7af\u3040-\u309f\u30a0-\u30ff]/g) || [];
  document.getElementById('wordCount').textContent = latin.length + cjk.length;
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show';
  clearTimeout(showToast.tid);
  showToast.tid = setTimeout(function(){ t.className='toast'; }, 2000);
}

function doCopy() {
  commitBuffer();
  var ed = document.getElementById('editor');
  if(!ed.value){showToast('Nothing to copy');return;}
  navigator.clipboard.writeText(ed.value).then(function(){showToast('✓ Copied');});
}

function doClear() {
  jpBuffer='';cnBuffer='';hideCandidates();updateImeDisplay();
  var ed = document.getElementById('editor');
  ed.value='';textStore[currentLang]='';updateStats();ed.focus();showToast('✓ Cleared');
}

function doDownload() {
  commitBuffer();
  var ed = document.getElementById('editor');
  if(!ed.value){showToast('Nothing to save');return;}
  var blob = new Blob([ed.value],{type:'text/plain;charset=utf-8'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'polyglot-'+currentLang+'-'+Date.now()+'.txt';
  a.click();URL.revokeObjectURL(a.href);showToast('✓ Downloaded');
}
