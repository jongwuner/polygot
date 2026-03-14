// ═══════════════════════════════════════════
// CHINESE INPUT HANDLER
// ═══════════════════════════════════════════
function handleCnKey(e) {
  var key = e.key;

  // If candidates are showing, number keys select
  if(cnCandidates.length > 0 && key >= '1' && key <= '9') {
    var idx = parseInt(key) - 1;
    if(idx < cnCandidates.length) {
      e.preventDefault();
      selectCandidate(idx);
      return;
    }
  }

  // Enter: commit pinyin as-is
  if(key === 'Enter') {
    if(cnBuffer) { e.preventDefault(); commitBuffer(); return; }
    return;
  }
  // Escape: cancel buffer
  if(key === 'Escape') {
    if(cnBuffer || cnCandidates.length) { e.preventDefault(); cnBuffer=''; hideCandidates(); updateImeDisplay(); return; }
    return;
  }
  // Backspace
  if(key === 'Backspace') {
    if(cnBuffer) {
      e.preventDefault();
      cnBuffer = cnBuffer.slice(0,-1);
      hideCandidates();
      updateImeDisplay();
      return;
    }
    return;
  }

  // Space: look up hanzi candidates
  if(key === ' ') {
    if(cnBuffer) {
      e.preventDefault();
      var lookup = cnBuffer.replace(/[āáǎà]/g,'a').replace(/[ēéěè]/g,'e').replace(/[īíǐì]/g,'i')
                   .replace(/[ōóǒò]/g,'o').replace(/[ūúǔù]/g,'u').replace(/[ǖǘǚǜ]/g,'v').toLowerCase();
      lookup = lookup.replace(/[^a-z]/g,'');
      var hz = PY2HZ[lookup] || PY2HZ[lookup.replace(/v/g,'u')];
      if(hz) {
        var chars = hz.split('');
        showCandidates(chars);
      } else {
        insertText(cnBuffer + ' ');
        cnBuffer = '';
        updateImeDisplay();
      }
      return;
    }
    return;
  }

  // Tone numbers 1-4 (when buffer has content and no candidates showing)
  if(cnBuffer && cnCandidates.length === 0 && key >= '1' && key <= '4') {
    e.preventDefault();
    cnBuffer = addToneMark(cnBuffer, parseInt(key));
    updateImeDisplay();
    return;
  }
  // Tone 5 (neutral - strip existing tone marks)
  if(cnBuffer && cnCandidates.length === 0 && key === '5') {
    e.preventDefault();
    cnBuffer = stripTones(cnBuffer);
    updateImeDisplay();
    return;
  }

  // Only intercept letters
  if(key.length !== 1 || !key.match(/[a-zA-Z]/)) return;

  e.preventDefault();
  hideCandidates();
  cnBuffer += key.toLowerCase();
  updateImeDisplay();
}
