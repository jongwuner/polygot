const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
  'will', 'were', 'what', 'when', 'where', 'which', 'about', 'there', 'their',
  'then', 'than', 'into', 'while', 'because', 'also', 'just', 'like', 'been',
  'note', 'markdown', 'obsidian', 'https', 'http',
]);

const TYPE_LABEL = {
  cloze: 'Cloze Sprint',
  recall: 'Recall Round',
  heading: 'Boss Round',
  quote: 'Echo Check',
  term: 'Term Duel',
};

export function buildQuizDeck(note, noteContent) {
  const cleanContent = String(noteContent || '').replace(/\r\n/g, '\n');
  const lines = cleanContent.split('\n').map((line) => line.trim()).filter(Boolean);
  const headings = lines.filter((line) => /^#{1,6}\s+/.test(line));
  const bullets = lines.filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line));
  const quotes = lines.filter((line) => /^>\s+/.test(line));
  const plain = lines.filter((line) => !/^#{1,6}\s+/.test(line) && !/^[-*]\s+/.test(line) && !/^\d+\.\s+/.test(line) && !/^>\s+/.test(line));

  const cards = [];
  const seen = new Set();

  for (const line of extractBoldLines(lines)) {
    const term = extractKeyTerm(line);
    if (!term) continue;
    pushCard(cards, seen, {
      type: 'term',
      prompt: `In ${displayNoteName(note)}, what is "${term}" about?`,
      answer: stripMarkdown(line),
      hint: 'Look for the emphasized term in the note.',
      source: line,
    });
  }

  for (const line of bullets.slice(0, 8)) {
    const stripped = stripMarkdown(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''));
    if (stripped.length < 16) continue;
    const keyword = pickKeyword(stripped);
    if (!keyword) continue;
    pushCard(cards, seen, {
      type: 'cloze',
      prompt: `Fill the missing idea:\n${blankKeyword(stripped, keyword)}`,
      answer: keyword,
      hint: 'It is one of the strongest content words in the line.',
      source: stripped,
    });
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = stripMarkdown(headings[index].replace(/^#{1,6}\s+/, ''));
    const detail = findNearestDetail(lines, headings[index]);
    if (!heading || !detail) continue;
    pushCard(cards, seen, {
      type: 'heading',
      prompt: `Boss round: what should you remember from "${heading}"?`,
      answer: stripMarkdown(detail),
      hint: 'Summarize the first strong line under that heading.',
      source: detail,
    });
  }

  for (const line of quotes.slice(0, 5)) {
    const stripped = stripMarkdown(line.replace(/^>\s+/, ''));
    if (stripped.length < 18) continue;
    pushCard(cards, seen, {
      type: 'quote',
      prompt: `Echo check: why does this line matter?\n"${stripped}"`,
      answer: stripped,
      hint: "Try to connect the quote to the note's main idea.",
      source: stripped,
    });
  }

  for (const line of plain.slice(0, 10)) {
    const stripped = stripMarkdown(line);
    if (stripped.length < 28) continue;
    const keyword = pickKeyword(stripped);
    if (!keyword) continue;
    pushCard(cards, seen, {
      type: 'recall',
      prompt: `Recall round: explain this idea in your own words.\nCue: ${keyword}`,
      answer: stripped,
      hint: 'Use the cue to reconstruct the full point.',
      source: stripped,
    });
  }

  const deck = shuffle(cards).slice(0, 10).map((card, index) => ({
    ...card,
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title: TYPE_LABEL[card.type] || 'Review Card',
  }));

  if (!deck.length) {
    return [
      {
        id: `${Date.now()}-fallback`,
        type: 'recall',
        title: TYPE_LABEL.recall,
        prompt: `What is the main idea of ${displayNoteName(note)}?`,
        answer: stripMarkdown(cleanContent.slice(0, 260)) || 'This note needs more text before a quiz can be generated.',
        hint: 'Summarize the core message in one or two lines.',
        source: stripMarkdown(cleanContent.slice(0, 260)),
      },
    ];
  }

  return deck;
}

export function mergeQuizDecks(baseDeck, aiDeck) {
  const merged = [];
  const seen = new Set();
  for (const entry of [...(aiDeck || []), ...(baseDeck || [])]) {
    const key = `${entry.prompt}::${entry.answer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({
      ...entry,
      title: entry.title || TYPE_LABEL[entry.type] || 'Review Card',
    });
  }
  return merged.slice(0, 12);
}

export function normalizeQuizDeck(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      const prompt = String(item?.prompt || '').trim();
      const answer = String(item?.answer || '').trim();
      if (!prompt || !answer) return null;
      const type = typeof item?.type === 'string' ? item.type : 'recall';
      return {
        id: item?.id || `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        type,
        title: TYPE_LABEL[type] || 'Review Card',
        prompt,
        answer,
        hint: String(item?.hint || '').trim(),
        source: String(item?.source || answer).trim(),
      };
    })
    .filter(Boolean);
}

function extractBoldLines(lines) {
  return lines.filter((line) => /\*\*[^*]+\*\*|__[^_]+__|`[^`]+`/.test(line));
}

function extractKeyTerm(line) {
  const match = line.match(/\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/);
  return stripMarkdown(match?.[1] || match?.[2] || match?.[3] || '').trim();
}

function findNearestDetail(lines, headingLine) {
  const start = lines.indexOf(headingLine);
  if (start < 0) return '';
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^#{1,6}\s+/.test(line)) break;
    const stripped = stripMarkdown(line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/^>\s+/, ''));
    if (stripped.length >= 16) return stripped;
  }
  return '';
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/^#{1,6}\s+/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/`/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function blankKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`\\b${escaped}\\b`, 'i'), '_____');
}

function pickKeyword(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[`~!@#$%^&*()_=+\[\]{}\\|;:'",.<>/?]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word));

  return words.sort((a, b) => b.length - a.length)[0] || '';
}

function pushCard(cards, seen, card) {
  const key = `${card.prompt}::${card.answer}`;
  if (seen.has(key)) return;
  seen.add(key);
  cards.push(card);
}

function displayNoteName(note) {
  return note?.name ? `"${note.name}"` : 'this note';
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
