// ═══════════════════════════════════════════
// EDITOR KEY HANDLER
// ═══════════════════════════════════════════
function editorKeyHandler(e) {
  if(currentLang === 'jp') { handleJpKey(e); return; }
  if(currentLang === 'cn') { handleCnKey(e); return; }
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
document.getElementById('editor').addEventListener('keydown', editorKeyHandler);
document.getElementById('editor').addEventListener('input', function(){
  if(currentLang !== 'jp' && currentLang !== 'cn') {
    textStore[currentLang] = this.value;
    updateStats();
  }
});

document.addEventListener('keydown', function(e) {
  if((e.ctrlKey||e.metaKey) && e.key>='1' && e.key<='5') {
    e.preventDefault();
    var langs=['ko','en','jp','cn','de'];
    switchLang(langs[parseInt(e.key)-1]);
    showToast('→ '+NAMES[currentLang]);
  }
});

switchLang('ko');
