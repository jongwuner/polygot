import { Platform } from 'react-native';

import { DEFAULT_AI_PROMPT, DEFAULT_QUIZ_PROMPT, MAX_NOTE_CHARS_FOR_LLM } from '../constants';
import { normalizeQuizDeck } from './quiz';

let cachedContext = null;
let cachedModelUri = null;

export function getLocalLlmStatus() {
  if (Platform.OS === 'web') {
    return {
      available: false,
      mode: 'web',
      reason: '웹에서는 네이티브 로컬 모델 런타임을 불러올 수 없어요.',
    };
  }

  return {
    available: true,
    mode: 'native',
    reason: 'React Native New Architecture 기반 개발 빌드가 필요해요.',
  };
}

export async function inspectLocalModel(modelUri) {
  const llama = await getLlamaModule();
  return llama.loadLlamaModelInfo(modelUri);
}

export async function runLocalNoteAnalysis({
  modelUri,
  noteContent,
  instruction = DEFAULT_AI_PROMPT,
  n_ctx = 2048,
  n_predict = 512,
  n_gpu_layers = 99,
  onStatus,
}) {
  if (!modelUri) {
    throw new Error('먼저 GGUF 모델을 불러와 주세요.');
  }

  const cleanNote = String(noteContent || '').trim();
  if (!cleanNote) {
    throw new Error('먼저 Obsidian 노트를 가져오고 선택해 주세요.');
  }

  const llama = await getLlamaModule();

  if (cachedContext && cachedModelUri !== modelUri) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelUri = null;
  }

  if (!cachedContext) {
    onStatus?.('모델을 불러오는 중...');
    cachedContext = await llama.initLlama(
      {
        model: modelUri,
        use_mlock: false,
        n_ctx,
        n_gpu_layers,
      },
      (progress) => {
        onStatus?.(`모델 로딩 ${Math.round(progress * 100)}%`);
      }
    );
    cachedModelUri = modelUri;
  }

  onStatus?.('답변을 생성하는 중...');

  const { prompt, wasTrimmed } = buildNotePrompt(cleanNote, instruction);
  let streamedText = '';

  const result = await cachedContext.completion(
    {
      messages: [
        {
          role: 'system',
          content:
            '너는 온디바이스 Obsidian 노트 도우미야. 필요한 경우 섹션을 나눠 간결한 한국어 마크다운으로 답변해.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      n_predict,
      temperature: 0.2,
      stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>'],
    },
    (data) => {
      if (data.token) {
        streamedText += data.token;
      }
    }
  );

  return {
    text: result?.text || streamedText,
    wasTrimmed,
    usedChars: Math.min(cleanNote.length, MAX_NOTE_CHARS_FOR_LLM),
  };
}

export async function generateLocalQuizDeck({
  modelUri,
  noteContent,
  noteName,
  instruction = DEFAULT_QUIZ_PROMPT,
  n_ctx = 2048,
  n_predict = 768,
  n_gpu_layers = 99,
  onStatus,
}) {
  if (!modelUri) {
    throw new Error('먼저 GGUF 모델을 불러와 주세요.');
  }

  const cleanNote = String(noteContent || '').trim();
  if (!cleanNote) {
    throw new Error('먼저 노트를 선택해 주세요.');
  }

  const llama = await getLlamaModule();
  const context = await getOrCreateContext(llama, modelUri, { n_ctx, n_gpu_layers }, onStatus);
  const { prompt } = buildNotePrompt(cleanNote, instruction);

  onStatus?.('퀴즈 카드를 만드는 중...');

  const schema = {
    type: 'object',
    properties: {
      quiz: {
        type: 'array',
        minItems: 4,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            prompt: { type: 'string' },
            answer: { type: 'string' },
            hint: { type: 'string' },
            source: { type: 'string' },
          },
          required: ['prompt', 'answer'],
        },
      },
    },
    required: ['quiz'],
  };

  const result = await context.completion({
    messages: [
      {
        role: 'system',
        content:
          '주어진 Obsidian 노트를 바탕으로 재밌는 복습 퀴즈를 만들어. 짧은 질문을 쓰고, 답은 간결하게 유지하고, 빈칸형·회상형·보스형 카드를 섞어 줘.',
      },
      {
        role: 'user',
        content: `노트 이름: ${noteName || '가져온 노트'}\n\n${prompt}`,
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        schema,
      },
    },
    n_predict,
    temperature: 0.4,
    stop: ['</s>', '<|end|>', '<|eot_id|>', '<|end_of_text|>'],
  });

  const parsed = parseJsonResponse(result?.text || '');
  const deck = normalizeQuizDeck(parsed?.quiz);

  if (!deck.length) {
    throw new Error('로컬 모델이 사용할 수 있는 퀴즈 카드를 돌려주지 않았어요.');
  }

  return deck;
}

export async function releaseLocalModel() {
  if (cachedContext) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelUri = null;
  }
}

async function getLlamaModule() {
  if (Platform.OS === 'web') {
    throw new Error('로컬 LLM은 iOS 또는 Android 개발 빌드에서만 실행돼요.');
  }

  try {
    return await import('llama.rn');
  } catch (error) {
    throw new Error('로컬 LLM 런타임을 찾을 수 없어요. 먼저 네이티브 개발 클라이언트를 빌드해 주세요.');
  }
}

async function getOrCreateContext(llama, modelUri, { n_ctx, n_gpu_layers }, onStatus) {
  if (cachedContext && cachedModelUri !== modelUri) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelUri = null;
  }

  if (!cachedContext) {
    onStatus?.('모델을 불러오는 중...');
    cachedContext = await llama.initLlama(
      {
        model: modelUri,
        use_mlock: false,
        n_ctx,
        n_gpu_layers,
      },
      (progress) => {
        onStatus?.(`모델 로딩 ${Math.round(progress * 100)}%`);
      }
    );
    cachedModelUri = modelUri;
  }

  return cachedContext;
}

function buildNotePrompt(noteContent, instruction) {
  const cleanInstruction = String(instruction || DEFAULT_AI_PROMPT).trim() || DEFAULT_AI_PROMPT;
  const limitedNote = noteContent.slice(0, MAX_NOTE_CHARS_FOR_LLM);
  const wasTrimmed = noteContent.length > MAX_NOTE_CHARS_FOR_LLM;

  const prompt = [
    `지시: ${cleanInstruction}`,
    '',
    wasTrimmed
      ? `온디바이스 컨텍스트에 맞추기 위해 노트 앞 ${MAX_NOTE_CHARS_FOR_LLM}자까지만 사용했어요.`
      : '노트 전체를 아래에 포함했어요.',
    '',
    'Obsidian 노트:',
    limitedNote,
  ].join('\n');

  return {
    prompt,
    wasTrimmed,
  };
}

function parseJsonResponse(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw error;
  }
}
