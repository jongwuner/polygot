const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'have',
  'will', 'were', 'what', 'when', 'where', 'which', 'about', 'there', 'their',
  'then', 'than', 'into', 'while', 'because', 'also', 'just', 'like', 'been',
  'note', 'markdown', 'obsidian', 'https', 'http',
  '그리고', '하지만', '그래서', '대한', '정리', '복습', '노트', '메모', '내용', '관련',
  '사용', '기반', '이번', '다음', '먼저', '계속', '정도',
]);

const TYPE_LABEL = {
  cloze: '빈칸 스프린트',
  recall: '핵심 회상',
  heading: '보스 라운드',
  quote: '한 줄 체크',
  term: '용어 매치',
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
      prompt: `${displayNoteName(note)}에서 "${term}"은 무엇을 뜻할까요?`,
      answer: stripMarkdown(line),
      hint: '노트에서 강조된 용어를 먼저 떠올려 보세요.',
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
      prompt: `빈칸을 채워 보세요.\n${blankKeyword(stripped, keyword)}`,
      answer: keyword,
      hint: '문장에서 가장 핵심적인 단어 하나를 가린 문제예요.',
      source: stripped,
    });
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = stripMarkdown(headings[index].replace(/^#{1,6}\s+/, ''));
    const detail = findNearestDetail(lines, headings[index]);
    if (!heading || !detail) continue;
    pushCard(cards, seen, {
      type: 'heading',
      prompt: `보스 라운드: "${heading}"에서 꼭 기억해야 할 한 가지는 무엇일까요?`,
      answer: stripMarkdown(detail),
      hint: '해당 제목 아래 첫 핵심 문장을 떠올려 보세요.',
      source: detail,
    });
  }

  for (const line of quotes.slice(0, 5)) {
    const stripped = stripMarkdown(line.replace(/^>\s+/, ''));
    if (stripped.length < 18) continue;
    pushCard(cards, seen, {
      type: 'quote',
      prompt: `한 줄 체크: 이 문장이 왜 중요할까요?\n"${stripped}"`,
      answer: stripped,
      hint: '이 문장을 노트의 핵심 주제와 연결해 보세요.',
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
      prompt: `회상 라운드: 이 개념을 내 말로 설명해 보세요.\n단서: ${keyword}`,
      answer: stripped,
      hint: '단서를 바탕으로 원문 핵심을 복원해 보세요.',
      source: stripped,
    });
  }

  const deck = shuffle(cards).slice(0, 10).map((card, index) => ({
    ...card,
    id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
    title: TYPE_LABEL[card.type] || '복습 카드',
  }));

  if (!deck.length) {
    return [
      {
        id: `${Date.now()}-fallback`,
        type: 'recall',
        title: TYPE_LABEL.recall,
        prompt: `${displayNoteName(note)}의 핵심은 무엇인가요?`,
        answer: stripMarkdown(cleanContent.slice(0, 260)) || '퀴즈를 만들려면 노트에 조금 더 내용이 필요해요.',
        hint: '핵심 메시지를 1~2문장으로 정리해 보세요.',
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
      title: entry.title || TYPE_LABEL[entry.type] || '복습 카드',
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
        title: TYPE_LABEL[type] || '복습 카드',
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
  const pattern = /^[a-z0-9-]+$/i.test(keyword)
    ? new RegExp(`\\b${escaped}\\b`, 'i')
    : new RegExp(escaped, 'i');
  return text.replace(pattern, '_____');
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
  return note?.name ? `"${note.name}"` : '이 노트';
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}
