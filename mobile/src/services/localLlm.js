import { Platform } from 'react-native';

import { DEFAULT_AI_PROMPT, MAX_NOTE_CHARS_FOR_LLM } from '../constants';

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
