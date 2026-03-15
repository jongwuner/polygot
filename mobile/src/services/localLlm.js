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
      reason: 'Web cannot load the native local model runtime.',
    };
  }

  return {
    available: true,
    mode: 'native',
    reason: 'Requires a development build with React Native New Architecture.',
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
    throw new Error('Select a GGUF model first.');
  }

  const cleanNote = String(noteContent || '').trim();
  if (!cleanNote) {
    throw new Error('Import and select an Obsidian note first.');
  }

  const llama = await getLlamaModule();

  if (cachedContext && cachedModelUri !== modelUri) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelUri = null;
  }

  if (!cachedContext) {
    onStatus?.('Loading model...');
    cachedContext = await llama.initLlama(
      {
        model: modelUri,
        use_mlock: false,
        n_ctx,
        n_gpu_layers,
      },
      (progress) => {
        onStatus?.(`Loading model ${Math.round(progress * 100)}%`);
      }
    );
    cachedModelUri = modelUri;
  }

  onStatus?.('Generating answer...');

  const { prompt, wasTrimmed } = buildNotePrompt(cleanNote, instruction);
  let streamedText = '';

  const result = await cachedContext.completion(
    {
      messages: [
        {
          role: 'system',
          content:
            'You are an on-device Obsidian note assistant. Reply in concise markdown with sections when useful.',
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
    throw new Error('Select a GGUF model first.');
  }

  const cleanNote = String(noteContent || '').trim();
  if (!cleanNote) {
    throw new Error('Select a note first.');
  }

  const llama = await getLlamaModule();
  const context = await getOrCreateContext(llama, modelUri, { n_ctx, n_gpu_layers }, onStatus);
  const { prompt } = buildNotePrompt(cleanNote, instruction);

  onStatus?.('Generating quiz cards...');

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
          'Create a fun review quiz from the provided Obsidian note. Use short prompts, keep answers concise, and mix cloze, recall, and boss-round cards.',
      },
      {
        role: 'user',
        content: `Note name: ${noteName || 'Imported note'}\n\n${prompt}`,
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
    throw new Error('The local model did not return usable quiz cards.');
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
    throw new Error('Local LLM requires an iOS or Android development build.');
  }

  try {
    return await import('llama.rn');
  } catch (error) {
    throw new Error('Local LLM runtime is unavailable. Build a native development client first.');
  }
}

async function getOrCreateContext(llama, modelUri, { n_ctx, n_gpu_layers }, onStatus) {
  if (cachedContext && cachedModelUri !== modelUri) {
    await cachedContext.release();
    cachedContext = null;
    cachedModelUri = null;
  }

  if (!cachedContext) {
    onStatus?.('Loading model...');
    cachedContext = await llama.initLlama(
      {
        model: modelUri,
        use_mlock: false,
        n_ctx,
        n_gpu_layers,
      },
      (progress) => {
        onStatus?.(`Loading model ${Math.round(progress * 100)}%`);
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
    `Instruction: ${cleanInstruction}`,
    '',
    wasTrimmed
      ? `The note was truncated to the first ${MAX_NOTE_CHARS_FOR_LLM} characters to fit on-device context.`
      : 'The full note is included below.',
    '',
    'Obsidian note:',
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
