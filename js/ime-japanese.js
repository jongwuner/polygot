// ═══════════════════════════════════════════
// JAPANESE INPUT HANDLER
// ═══════════════════════════════════════════
function handleJpKey(e) {
  var key = e.key;

  // Enter: commit buffer
  if(key === 'Enter') {
    if(jpBuffer) { e.preventDefault(); commitBuffer(); return; }
    return;
  }
  // Escape: cancel buffer
  if(key === 'Escape') {
    if(jpBuffer) { e.preventDefault(); jpBuffer=''; updateImeDisplay(); return; }
    return;
  }
  // Backspace: delete from buffer first
  if(key === 'Backspace') {
    if(jpBuffer) { e.preventDefault(); jpBuffer = jpBuffer.slice(0,-1); updateImeDisplay(); return; }
    return;
  }
  // Space: commit n as ん then let space through
  if(key === ' ') {
    if(jpBuffer) {
      e.preventDefault();
      if(jpBuffer.toLowerCase() === 'n') { insertText(jpBuffer === 'N' || jpBuffer === jpBuffer.toUpperCase() ? 'ン' : 'ん'); }
      else { insertText(jpBuffer); }
      jpBuffer = '';
      insertText(' ');
      updateImeDisplay();
      return;
    }
    return;
  }

  // Only intercept letters
  if(key.length !== 1 || !key.match(/[a-zA-Z'-]/)) return;

  e.preventDefault();
  var isUpper = (key === key.toUpperCase() && key !== key.toLowerCase());
  var lower = key.toLowerCase();

  jpBuffer += key;
  var bufLow = jpBuffer.toLowerCase();
  var useKata = false;

  // Determine katakana or hiragana
  if(jpBuffer === jpBuffer.toUpperCase() && jpBuffer !== jpBuffer.toLowerCase()) useKata = true;

  // Check for double consonant → っ/ッ
  if(bufLow.length >= 2 && bufLow[bufLow.length-1] === bufLow[bufLow.length-2] && 'ksctgzdbpfrhj'.indexOf(bufLow[bufLow.length-1]) >= 0) {
    var tsu = useKata ? 'ッ' : 'っ';
    insertText(tsu);
    jpBuffer = jpBuffer.slice(-1);
    updateImeDisplay();
    return;
  }

  // Check n before consonant (not n, y, vowel)
  if(bufLow.length >= 2 && bufLow[bufLow.length-2] === 'n' && 'aiueony'.indexOf(bufLow[bufLow.length-1]) < 0) {
    var nn = useKata ? 'ン' : 'ん';
    insertText(nn);
    jpBuffer = jpBuffer.slice(-1);
    bufLow = jpBuffer.toLowerCase();
  }

  // Try to match from longest
  var map = useKata ? R2K : R2H;
  var matched = false;
  for(var len = Math.min(bufLow.length, 4); len >= 1; len--) {
    var sub = bufLow.substring(bufLow.length - len);
    var prefix = bufLow.substring(0, bufLow.length - len);
    if(map[bufLow]) {
      insertText(map[bufLow]);
      jpBuffer = '';
      matched = true;
      break;
    }
  }

  if(!matched && map[bufLow]) {
    insertText(map[bufLow]);
    jpBuffer = '';
  } else if(!matched) {
    // Check if it could still become valid
    if(!couldBeRomaji(bufLow)) {
      // Output what we can't match
      if(bufLow.length > 1) {
        var rest = jpBuffer.slice(-1);
        var failed = jpBuffer.slice(0,-1);
        var fLow = failed.toLowerCase();
        if(map[fLow]) {
          insertText(map[fLow]);
        } else {
          insertText(failed);
        }
        jpBuffer = rest;
      }
    }
  }

  updateImeDisplay();
}
