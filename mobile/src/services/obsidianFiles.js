import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

const NOTES_DIR = `${FileSystem.documentDirectory || ''}obsidian-notes/`;
const MODELS_DIR = `${FileSystem.documentDirectory || ''}llm-models/`;

export async function importMarkdownNotes() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/markdown', 'text/plain', '*/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) {
    return [];
  }

  if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
    const webNotes = [];
    for (const asset of result.assets) {
      const inlineContent =
        typeof asset.file?.text === 'function' ? await asset.file.text() : '';

      webNotes.push(buildNoteMetadata(asset, asset.uri, inlineContent));
    }
    return webNotes;
  }

  await ensureDirectory(NOTES_DIR);

  const importedNotes = [];
  for (const asset of result.assets) {
    if (!isMarkdownAsset(asset.name || '', asset.mimeType)) {
      continue;
    }

    const targetUri = `${NOTES_DIR}${Date.now()}-${sanitizeFileName(asset.name || 'note.md')}`;
    await FileSystem.copyAsync({
      from: asset.uri,
      to: targetUri,
    });

    const content = await FileSystem.readAsStringAsync(targetUri);
    importedNotes.push(buildNoteMetadata(asset, targetUri, content));
  }

  return importedNotes;
}

export async function loadImportedNoteContent(note) {
  if (!note) {
    return '';
  }

  if (typeof note.inlineContent === 'string') {
    return note.inlineContent;
  }

  if (!note.localUri) {
    return '';
  }

  return FileSystem.readAsStringAsync(note.localUri);
}

export async function deleteImportedNote(note) {
  if (!note?.localUri || Platform.OS === 'web') {
    return;
  }

  const info = await FileSystem.getInfoAsync(note.localUri);
  if (info.exists) {
    await FileSystem.deleteAsync(note.localUri, { idempotent: true });
  }
}

export async function importLocalModelFile() {
  if (Platform.OS === 'web') {
    throw new Error('Local GGUF models are only available in a native build.');
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: false,
  });

  if (result.canceled || !result.assets?.length) {
    return null;
  }

  const asset = result.assets[0];
  await ensureDirectory(MODELS_DIR);

  const targetUri = `${MODELS_DIR}${Date.now()}-${sanitizeFileName(asset.name || 'model.gguf')}`;
  await FileSystem.copyAsync({
    from: asset.uri,
    to: targetUri,
  });

  const info = await FileSystem.getInfoAsync(targetUri);

  return {
    uri: targetUri,
    name: asset.name || 'model.gguf',
    size: info.size || asset.size || 0,
    importedAt: new Date().toISOString(),
  };
}

function buildNoteMetadata(asset, localUri, content) {
  const text = String(content || '');
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: asset.name || 'Untitled.md',
    localUri,
    importedAt: new Date().toISOString(),
    size: asset.size || text.length,
    preview: text.slice(0, 240).trim(),
    charCount: text.length,
    sourceUri: asset.uri,
    inlineContent: Platform.OS === 'web' ? text : undefined,
  };
}

async function ensureDirectory(dirUri) {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
}

function sanitizeFileName(value) {
  return String(value || 'file')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isMarkdownAsset(name, mimeType) {
  const lower = String(name || '').toLowerCase();
  return lower.endsWith('.md') || mimeType === 'text/markdown' || mimeType === 'text/plain';
}
