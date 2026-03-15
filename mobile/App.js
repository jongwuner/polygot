import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import {
  ARCHIVE_LANGUAGE_OPTIONS,
  CLIENT,
  CLIENT_RELEASES,
  COLORS,
  DEFAULT_AI_PROMPT,
  DEFAULT_QUIZ_PROMPT,
  DEFAULT_SETTINGS,
  INPUT_PLACEHOLDER,
  LANGUAGES,
  SOURCE_LANGUAGE_OPTIONS,
  TARGET_LANGUAGE_OPTIONS,
} from './src/constants';
import { generateLocalQuizDeck, getLocalLlmStatus, inspectLocalModel, releaseLocalModel, runLocalNoteAnalysis } from './src/services/localLlm';
import { deleteImportedNote, importLocalModelFile, importMarkdownNotes, loadImportedNoteContent } from './src/services/obsidianFiles';
import { buildQuizDeck, mergeQuizDecks } from './src/services/quiz';
import { loadHistory, loadNotes, loadSettings, prependHistoryEntry, prependNotes, saveHistory, saveNotes, saveSettings } from './src/services/storage';
import { translateText } from './src/services/translate';
import { buildPathPreview, buildTranslationNote } from './src/utils/obsidian';

const TABS = ['translate', 'history', 'notes', 'quiz', 'ai', 'settings'];
const FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('translate');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [notes, setNotes] = useState([]);
  const [selectedNoteContent, setSelectedNoteContent] = useState('');
  const [input, setInput] = useState('');
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notesBusy, setNotesBusy] = useState(false);
  const [modelBusy, setModelBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [quizPrompt, setQuizPrompt] = useState(DEFAULT_QUIZ_PROMPT);
  const [aiOutput, setAiOutput] = useState('');
  const [modelInfo, setModelInfo] = useState(null);
  const [quizDeck, setQuizDeck] = useState([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizReveal, setQuizReveal] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizBestStreak, setQuizBestStreak] = useState(0);
  const [quizXp, setQuizXp] = useState(0);
  const [quizMode, setQuizMode] = useState('fallback');
  const [quizFinished, setQuizFinished] = useState(false);

  useEffect(() => {
    let live = true;
    Promise.all([loadSettings(), loadHistory(), loadNotes()])
      .then(([savedSettings, savedHistory, savedNotes]) => {
        if (!live) return;
        setSettings(savedSettings);
        setHistory(savedHistory);
        setNotes(savedNotes);
        setReady(true);
      })
      .catch(() => {
        if (!live) return;
        setNotice('Failed to load local data.');
        setReady(true);
      });

    return () => {
      live = false;
      releaseLocalModel().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (ready) {
      saveSettings(settings).catch(() => setNotice('Could not save settings.'));
    }
  }, [ready, settings]);

  useEffect(() => {
    if (ready) {
      saveHistory(history).catch(() => setNotice('Could not save history.'));
    }
  }, [ready, history]);

  useEffect(() => {
    if (ready) {
      saveNotes(notes).catch(() => setNotice('Could not save imported notes.'));
    }
  }, [ready, notes]);

  useEffect(() => {
    let live = true;
    const selectedNote = notes.find((note) => note.id === settings.selectedNoteId);

    if (!selectedNote) {
      setSelectedNoteContent('');
      return () => {
        live = false;
      };
    }

    loadImportedNoteContent(selectedNote)
      .then((content) => {
        if (!live) return;
        setSelectedNoteContent(content);
      })
      .catch(() => {
        if (!live) return;
        setSelectedNoteContent('');
        setNotice('Could not load the selected note.');
      });

    return () => {
      live = false;
    };
  }, [notes, settings.selectedNoteId]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 3200);
    return () => clearTimeout(id);
  }, [notice]);

  function updateSetting(key, value) {
    setSettings((state) => ({ ...state, [key]: value }));
  }

  async function resolveNoteContext(noteOverride = null) {
    const note = noteOverride || notes.find((item) => item.id === settings.selectedNoteId) || null;

    if (!note) {
      return { note: null, content: '' };
    }

    if (note.id === settings.selectedNoteId && selectedNoteContent) {
      return { note, content: selectedNoteContent };
    }

    const content = await loadImportedNoteContent(note);
    if (note.id === settings.selectedNoteId || noteOverride) {
      setSelectedNoteContent(content);
    }

    return { note, content };
  }

  function resetQuizSession(deck, mode) {
    setQuizDeck(deck);
    setQuizIndex(0);
    setQuizReveal(false);
    setQuizScore(0);
    setQuizStreak(0);
    setQuizBestStreak(0);
    setQuizXp(0);
    setQuizMode(mode);
    setQuizFinished(false);
  }

  async function onTranslate() {
    if (!input.trim()) {
      setNotice('Add text before translating.');
      return;
    }
    setBusy(true);
    try {
      const result = await translateText(input, settings.targetLang, settings.sourceLang);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        requestedSourceKey: settings.sourceLang,
        targetKey: settings.targetLang,
        ...result,
      };
      setCurrent(entry);
      setHistory((items) => prependHistoryEntry(items, entry));
      setNotice('Translation ready.');
    } catch (error) {
      setNotice(error.message || 'Translation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value, label) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setNotice(`${label} copied.`);
  }

  async function shareNote() {
    if (!current) return;
    const note = makeTranslationNote(current, settings);
    await Share.share({ message: `${note.content}\n\nPath: ${note.filePath}` });
  }

  async function openObsidian() {
    if (!current) return;
    if (!settings.vaultName.trim()) {
      setTab('settings');
      setNotice('Set a vault name first.');
      return;
    }
    await Linking.openURL(makeTranslationNote(current, settings).uri).catch(() => setNotice('Could not open Obsidian.'));
  }

  async function handleImportNotes() {
    setNotesBusy(true);
    try {
      const imported = await importMarkdownNotes();
      if (!imported.length) {
        setNotice('No markdown notes were imported.');
        return;
      }

      setNotes((items) => prependNotes(items, imported));
      setSettings((state) => ({
        ...state,
        selectedNoteId: imported[0].id,
      }));
      setTab('notes');
      setNotice(`Imported ${imported.length} note${imported.length > 1 ? 's' : ''}.`);
    } catch (error) {
      setNotice(error.message || 'Import failed.');
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleDeleteNote(note) {
    await deleteImportedNote(note).catch(() => {});
    setNotes((items) => items.filter((item) => item.id !== note.id));
    if (settings.selectedNoteId === note.id) {
      const nextNote = notes.find((item) => item.id !== note.id);
      setSettings((state) => ({
        ...state,
        selectedNoteId: nextNote?.id || '',
      }));
    }
  }

  async function handlePickModel() {
    setModelBusy(true);
    try {
      const model = await importLocalModelFile();
      if (!model) {
        setNotice('Model selection canceled.');
        return;
      }

      setSettings((state) => ({
        ...state,
        llmModelUri: model.uri,
        llmModelName: model.name,
      }));

      try {
        const info = await inspectLocalModel(model.uri);
        setModelInfo(info);
      } catch (error) {
        setModelInfo(null);
        setNotice(error.message || 'Model imported. Inspect it from a native development build.');
      }

      setTab('ai');
      setNotice(`Model ready: ${model.name}`);
    } catch (error) {
      setNotice(error.message || 'Model import failed.');
    } finally {
      setModelBusy(false);
    }
  }

  async function handleRunAi() {
    if (!settings.selectedNoteId) {
      setTab('notes');
      setNotice('Import and select an Obsidian note first.');
      return;
    }
    if (!settings.llmModelUri) {
      setNotice('Load a GGUF model first.');
      return;
    }

    setAiBusy(true);
    setAiOutput('');
    try {
      const { note, content } = await resolveNoteContext();
      if (!note) {
        throw new Error('Import and select an Obsidian note first.');
      }
      const result = await runLocalNoteAnalysis({
        modelUri: settings.llmModelUri,
        noteContent: content,
        instruction: aiPrompt,
        n_ctx: settings.llmContextSize,
        n_predict: settings.llmMaxTokens,
        n_gpu_layers: settings.llmGpuLayers,
        onStatus: setNotice,
      });
      setAiOutput(result.text || '');
      if (result.wasTrimmed) {
        setNotice(`Analysis complete. Note was truncated to ${result.usedChars} chars for on-device context.`);
      } else {
        setNotice('Analysis complete.');
      }
    } catch (error) {
      setNotice(error.message || 'Local AI failed.');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleGenerateQuiz(mode = 'smart', noteOverride = null) {
    const targetNoteId = noteOverride?.id || settings.selectedNoteId;
    if (!targetNoteId) {
      setTab('notes');
      setNotice('Import and select an Obsidian note first.');
      return;
    }

    setQuizBusy(true);
    try {
      if (noteOverride && settings.selectedNoteId !== noteOverride.id) {
        setSettings((state) => ({
          ...state,
          selectedNoteId: noteOverride.id,
        }));
      }

      const { note, content } = await resolveNoteContext(noteOverride);
      if (!note) {
        throw new Error('Import and select an Obsidian note first.');
      }

      const fallbackDeck = buildQuizDeck(note, content);
      let deck = fallbackDeck;
      let deckMode = 'fallback';

      if (mode !== 'fallback' && settings.llmModelUri && Platform.OS !== 'web') {
        try {
          const aiDeck = await generateLocalQuizDeck({
            modelUri: settings.llmModelUri,
            noteContent: content,
            noteName: note?.name,
            instruction: quizPrompt,
            n_ctx: settings.llmContextSize,
            n_predict: settings.llmMaxTokens,
            n_gpu_layers: settings.llmGpuLayers,
            onStatus: setNotice,
          });
          deck = mergeQuizDecks(fallbackDeck, aiDeck);
          deckMode = 'ai-remix';
        } catch (error) {
          setNotice(error.message || 'AI quiz failed. Falling back to note-only deck.');
        }
      } else if (mode !== 'fallback') {
        setNotice('AI remix needs a loaded GGUF model in a native build. Using note-only deck.');
      }

      resetQuizSession(deck, deckMode);
      setTab('quiz');
      setNotice(`Quiz ready: ${deck.length} cards.`);
    } catch (error) {
      setNotice(error.message || 'Quiz generation failed.');
    } finally {
      setQuizBusy(false);
    }
  }

  function handleQuizReveal() {
    if (!quizDeck.length) return;
    setQuizReveal(true);
  }

  function handleQuizResult(correct) {
    if (!quizDeck.length || quizFinished) return;

    const nextStreak = correct ? quizStreak + 1 : 0;
    const nextBest = correct ? Math.max(quizBestStreak, nextStreak) : quizBestStreak;
    const xpGain = correct ? 12 + quizStreak * 3 : 3;

    setQuizScore((value) => value + (correct ? 1 : 0));
    setQuizStreak(nextStreak);
    setQuizBestStreak(nextBest);
    setQuizXp((value) => value + xpGain);

    const isLast = quizIndex >= quizDeck.length - 1;
    if (isLast) {
      setQuizFinished(true);
      setQuizReveal(true);
      setNotice(correct ? 'Quiz cleared. Clean finish.' : 'Quiz cleared. One more loop and you own it.');
      return;
    }

    setQuizIndex((value) => value + 1);
    setQuizReveal(false);
  }

  function handleQuizRestart() {
    if (!quizDeck.length) return;
    resetQuizSession(quizDeck, quizMode);
    setNotice('Quiz restarted.');
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <Text style={styles.kicker}>React Native Client</Text>
            <Text style={styles.title}>Polyglot</Text>
            <ActivityIndicator color={COLORS.accent} size="large" />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const localLlm = getLocalLlmStatus();
  const previewCode = current?.sourceCode || (settings.sourceLang === 'auto' ? LANGUAGES.ko.code : LANGUAGES[settings.sourceLang].code);
  const pathPreview = current ? makeTranslationNote(current, settings).filePath : buildPathPreview(settings, previewCode);
  const selectedNote = notes.find((note) => note.id === settings.selectedNoteId) || null;
  const currentQuiz = quizDeck[quizIndex] || null;
  const quizProgress = quizDeck.length ? `${Math.min(quizIndex + 1, quizDeck.length)} / ${quizDeck.length}` : '0 / 0';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, styles.hero]}>
              <Text style={[styles.kicker, styles.kickerDark]}>Mobile translation + note intelligence</Text>
              <Text style={[styles.title, styles.titleDark]}>Polyglot</Text>
              <Text style={styles.heroText}>
                Bring in Obsidian archive notes, turn them into playful review quizzes, and keep translation plus on-device GGUF analysis in one mobile workspace.
              </Text>
              <Text style={styles.heroMeta}>WEB v{CLIENT_RELEASES.web}  |  EXT v{CLIENT_RELEASES.extension}  |  APP v{CLIENT.version}</Text>
            </View>

            {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}

            <View style={styles.tabs}>
              {TABS.map((name) => (
                <Pressable key={name} onPress={() => setTab(name)} style={[styles.tab, tab === name && styles.tabActive]}>
                  <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{name}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'translate' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.label}>Source language</Text>
                  <View style={styles.row}>{SOURCE_LANGUAGE_OPTIONS.map((key) => <Chip key={key} label={LANGUAGES[key].label} active={settings.sourceLang === key} color={LANGUAGES[key].accent} onPress={() => updateSetting('sourceLang', key)} />)}</View>
                  <View style={styles.split}><Text style={styles.label}>Target language</Text><Pressable onPress={() => settings.sourceLang === 'auto' ? setNotice('Choose a fixed source language to swap.') : setSettings((state) => ({ ...state, sourceLang: state.targetLang, targetLang: state.sourceLang }))}><Text style={styles.link}>Swap</Text></Pressable></View>
                  <View style={styles.row}>{TARGET_LANGUAGE_OPTIONS.map((key) => <Chip key={key} label={LANGUAGES[key].label} active={settings.targetLang === key} color={LANGUAGES[key].accent} onPress={() => updateSetting('targetLang', key)} />)}</View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Draft</Text>
                  <TextInput value={input} onChangeText={setInput} placeholder={INPUT_PLACEHOLDER} placeholderTextColor={COLORS.inkSoft} multiline textAlignVertical="top" style={styles.editor} />
                  <View style={styles.row}>
                    <Action label="Paste" tone="soft" onPress={() => Clipboard.getStringAsync().then((text) => { setInput(text); setNotice(text ? 'Clipboard pasted.' : 'Clipboard is empty.'); }).catch(() => setNotice('Clipboard access failed.'))} />
                    <Action label="Clear" tone="ghost" onPress={() => { setInput(''); setCurrent(null); }} />
                    <Action label={busy ? 'Translating...' : 'Translate'} tone="solid" disabled={busy} onPress={onTranslate} />
                  </View>
                </View>

                {current ? (
                  <View style={[styles.card, styles.dark]}>
                    <Text style={[styles.label, styles.labelDark]}>{current.sourceLang} -> {current.targetLang}</Text>
                    <Text style={styles.result}>{current.translated}</Text>
                    {current.pronunciation ? <Text style={styles.pronunciation}>{current.targetKey === 'cn' ? 'Pinyin' : 'Romaji'}: {current.pronunciation}</Text> : null}
                    <View style={styles.row}>
                      <Action label="Copy text" tone="soft" onPress={() => copyText(current.translated, 'Translation')} />
                      <Action label="Copy note" tone="soft" onPress={() => copyText(makeTranslationNote(current, settings).content, 'Note')} />
                    </View>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.label}>Obsidian note</Text>
                  <Text style={styles.path}>{pathPreview}</Text>
                  {current ? <Text style={styles.note}>{makeTranslationNote(current, settings).content}</Text> : <Text style={styles.subtle}>Translate first to stage a full markdown note.</Text>}
                  <View style={styles.row}>
                    <Action label="Copy markdown" tone="soft" disabled={!current} onPress={() => copyText(makeTranslationNote(current, settings).content, 'Note')} />
                    <Action label="Share" tone="soft" disabled={!current} onPress={shareNote} />
                    <Action label="Open in Obsidian" tone="solid" disabled={!current} onPress={openObsidian} />
                  </View>
                </View>
              </>
            ) : null}

            {tab === 'history' ? (
              <View style={styles.card}>
                <View style={styles.split}><Text style={styles.label}>Saved translations ({history.length})</Text><Pressable onPress={() => { setHistory([]); if (current) setCurrent(null); }}><Text style={styles.link}>Clear all</Text></Pressable></View>
                {!history.length ? <Text style={styles.subtle}>Run a translation and it will appear here.</Text> : null}
                {history.map((entry) => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historyTitle}>{entry.sourceLang} -> {entry.targetLang}</Text>
                    <Text style={styles.subtle}>{stamp(entry.createdAt)}</Text>
                    <Text style={styles.snippet}>{entry.original}</Text>
                    <Text style={styles.historyResult}>{entry.translated}</Text>
                    <View style={styles.row}>
                      <Action label="Use" tone="soft" onPress={() => { setInput(entry.original); setCurrent(entry); setSettings((state) => ({ ...state, sourceLang: entry.requestedSourceKey || state.sourceLang, targetLang: entry.targetKey || state.targetLang })); setTab('translate'); }} />
                      <Action label="Copy note" tone="soft" onPress={() => copyText(makeTranslationNote(entry, settings).content, 'Note')} />
                      <Action label="Delete" tone="ghost" onPress={() => { setHistory((items) => items.filter((item) => item.id !== entry.id)); if (current?.id === entry.id) setCurrent(null); }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'notes' ? (
              <>
                <View style={styles.card}>
                  <View style={styles.split}>
                    <Text style={styles.label}>Obsidian markdown</Text>
                    <Action label={notesBusy ? 'Importing...' : 'Import .md'} tone="solid" disabled={notesBusy} onPress={handleImportNotes} />
                  </View>
                  <Text style={styles.subtle}>
                    Pick markdown files from the phone. Obsidian notes are copied into the app sandbox so they can be reopened later and turned into review quiz decks.
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Imported notes ({notes.length})</Text>
                  {!notes.length ? <Text style={styles.subtle}>No notes imported yet.</Text> : null}
                  {notes.map((note) => (
                    <View key={note.id} style={[styles.historyItem, settings.selectedNoteId === note.id && styles.selectedItem]}>
                      <Text style={styles.historyTitle}>{note.name}</Text>
                      <Text style={styles.subtle}>{stamp(note.importedAt)}  |  {formatBytes(note.size)}  |  {note.charCount} chars</Text>
                      <Text style={styles.snippet}>{note.preview || '(empty note)'}</Text>
                      <View style={styles.row}>
                        <Action label="Open" tone="soft" onPress={() => setSettings((state) => ({ ...state, selectedNoteId: note.id }))} />
                        <Action label="Quick quiz" tone="soft" disabled={quizBusy} onPress={() => handleGenerateQuiz('fallback', note)} />
                        <Action label="Delete" tone="ghost" onPress={() => handleDeleteNote(note)} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Selected note</Text>
                  {selectedNote ? (
                    <>
                      <Text style={styles.path}>{selectedNote.name}</Text>
                      <Text style={styles.note}>{selectedNoteContent || '(empty note)'}</Text>
                    </>
                  ) : (
                    <Text style={styles.subtle}>Select a note to preview its markdown.</Text>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'quiz' ? (
              <>
                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>Review arena</Text>
                  <Text style={styles.darkLine}>{selectedNote ? selectedNote.name : 'No note selected'}</Text>
                  <Text style={styles.darkLine}>
                    Deck mode: {quizMode === 'ai-remix' ? 'AI remix' : 'Note-only'}  |  Progress: {quizProgress}
                  </Text>
                  <View style={styles.row}>
                    <Action label={quizBusy ? 'Building...' : 'Quick deck'} tone="soft" disabled={quizBusy || !selectedNote} onPress={() => handleGenerateQuiz('fallback')} />
                    <Action label={quizBusy ? 'Building...' : 'AI remix'} tone="solid" disabled={quizBusy || !selectedNote} onPress={() => handleGenerateQuiz('smart')} />
                    <Action label="Restart" tone="ghost" disabled={!quizDeck.length} onPress={handleQuizRestart} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Quiz direction</Text>
                  <Text style={styles.subtle}>
                    Quick deck builds straight from markdown structure. AI remix uses the selected GGUF model to reshuffle the note into shorter, punchier review cards.
                  </Text>
                  <TextInput
                    value={quizPrompt}
                    onChangeText={setQuizPrompt}
                    multiline
                    textAlignVertical="top"
                    style={styles.inputLarge}
                    placeholder="Tell the quiz builder how playful or strict the review session should be."
                    placeholderTextColor={COLORS.inkSoft}
                  />
                </View>

                <View style={styles.card}>
                  <View style={styles.split}>
                    <Text style={styles.label}>Session stats</Text>
                    <Text style={styles.link}>{quizProgress}</Text>
                  </View>
                  <View style={styles.scoreRow}>
                    <StatPill label="Score" value={`${quizScore}/${quizDeck.length || 0}`} />
                    <StatPill label="Streak" value={String(quizStreak)} />
                    <StatPill label="Best" value={String(quizBestStreak)} />
                    <StatPill label="XP" value={String(quizXp)} />
                  </View>
                  <Text style={styles.subtle}>
                    Reveal a card, mark it right or missed, and loop again until the archive note feels automatic.
                  </Text>
                </View>

                <View style={styles.card}>
                  {currentQuiz ? (
                    <>
                      <Text style={styles.quizTitle}>{currentQuiz.title}</Text>
                      <Text style={styles.quizPrompt}>{currentQuiz.prompt}</Text>
                      {currentQuiz.hint ? <Text style={styles.subtle}>Hint: {currentQuiz.hint}</Text> : null}
                      {quizReveal ? (
                        <Text style={styles.quizAnswer}>{currentQuiz.answer}</Text>
                      ) : (
                        <Text style={styles.subtle}>Try answering before you reveal the note-backed answer.</Text>
                      )}
                      {quizFinished ? (
                        <Text style={styles.subtle}>Deck cleared. Restart the session or remix the same note with AI for a rougher second pass.</Text>
                      ) : null}
                      {quizReveal && currentQuiz.source ? <Text style={styles.note}>{currentQuiz.source}</Text> : null}
                      <View style={styles.row}>
                        <Action label={quizReveal ? 'Revealed' : 'Reveal'} tone="soft" disabled={quizReveal} onPress={handleQuizReveal} />
                        <Action label="Correct" tone="solid" disabled={!quizReveal || quizFinished} onPress={() => handleQuizResult(true)} />
                        <Action label="Miss" tone="ghost" disabled={!quizReveal || quizFinished} onPress={() => handleQuizResult(false)} />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.quizTitle}>No deck yet</Text>
                      <Text style={styles.subtle}>
                        Select an imported Obsidian note, then build a quick deck or use AI remix to make the review more varied.
                      </Text>
                    </>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'ai' ? (
              <>
                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>Local model runtime</Text>
                  <Text style={styles.darkLine}>{localLlm.reason}</Text>
                  <Text style={styles.darkLine}>
                    Current model: {settings.llmModelName || 'None loaded'}
                  </Text>
                  <View style={styles.row}>
                    <Action label={modelBusy ? 'Loading...' : 'Load GGUF'} tone="soft" disabled={modelBusy} onPress={handlePickModel} />
                    <Action label="Release model" tone="ghost" onPress={() => releaseLocalModel().then(() => setNotice('Local model released.')).catch(() => setNotice('Could not release the model.'))} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Analysis target</Text>
                  <Text style={styles.path}>{selectedNote ? selectedNote.name : 'No note selected'}</Text>
                  <Text style={styles.subtle}>
                    Best fit is a small GGUF instruct model in the 1B-3B range. The current flow is aimed at native development builds, not Expo Go or web.
                  </Text>
                  <TextInput value={aiPrompt} onChangeText={setAiPrompt} multiline textAlignVertical="top" style={styles.inputLarge} placeholder="Tell the local model what to do with the selected note." placeholderTextColor={COLORS.inkSoft} />
                  <View style={styles.row}>
                    <Action label={aiBusy ? 'Running...' : 'Run local AI'} tone="solid" disabled={aiBusy || !selectedNote} onPress={handleRunAi} />
                    <Action label="Copy answer" tone="soft" disabled={!aiOutput} onPress={() => copyText(aiOutput, 'AI answer')} />
                  </View>
                </View>

                {modelInfo ? (
                  <View style={styles.card}>
                    <Text style={styles.label}>Model info</Text>
                    <Text style={styles.note}>{JSON.stringify(modelInfo, null, 2)}</Text>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.label}>AI output</Text>
                  <Text style={aiOutput ? styles.note : styles.subtle}>
                    {aiOutput || 'Run the selected note through the local model to see the markdown answer here.'}
                  </Text>
                </View>
              </>
            ) : null}

            {tab === 'settings' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.label}>Vault name</Text>
                  <TextInput value={settings.vaultName} onChangeText={(value) => updateSetting('vaultName', value)} placeholder="MyVault" placeholderTextColor={COLORS.inkSoft} style={styles.input} />
                  <Text style={styles.label}>Archive base path</Text>
                  <TextInput value={settings.archiveBase} onChangeText={(value) => updateSetting('archiveBase', value)} placeholder="4. Archive" placeholderTextColor={COLORS.inkSoft} style={styles.input} />
                  <Text style={styles.label}>Archive folder mode</Text>
                  <View style={styles.row}>{ARCHIVE_LANGUAGE_OPTIONS.map((name) => <Chip key={name} label={name === 'auto' ? 'Auto' : name} active={settings.archiveLang === name} color={COLORS.sky} onPress={() => updateSetting('archiveLang', name)} />)}</View>
                  <Text style={styles.path}>{pathPreview}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>Local AI defaults</Text>
                  <TextInput value={String(settings.llmContextSize)} onChangeText={(value) => updateSetting('llmContextSize', toSafeNumber(value, 2048))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>Context size tokens</Text>
                  <TextInput value={String(settings.llmMaxTokens)} onChangeText={(value) => updateSetting('llmMaxTokens', toSafeNumber(value, 512))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>Max output tokens</Text>
                  <TextInput value={String(settings.llmGpuLayers)} onChangeText={(value) => updateSetting('llmGpuLayers', toSafeNumber(value, 99))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>GPU layers to offload when supported</Text>
                </View>

                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>Client release notes</Text>
                  <Text style={styles.darkLine}>Web client: v{CLIENT_RELEASES.web}</Text>
                  <Text style={styles.darkLine}>Chrome extension: v{CLIENT_RELEASES.extension}</Text>
                  <Text style={styles.darkLine}>React Native app: v{CLIENT.version}</Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function makeTranslationNote(entry, settings) {
  return buildTranslationNote(settings, entry, { now: entry.createdAt, pageTitle: CLIENT.name, siteSlug: 'mobile-app' });
}

function stamp(value) {
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day} ${hh}:${mm}`;
}

function formatBytes(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function toSafeNumber(value, fallback) {
  const next = parseInt(String(value || ''), 10);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function Chip({ label, active, color, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Action({ label, onPress, tone, disabled }) {
  const style = tone === 'solid' ? styles.actionSolid : tone === 'soft' ? styles.actionSoft : styles.actionGhost;
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, style, disabled && styles.actionDisabled]}><Text style={[styles.actionText, tone === 'solid' && styles.actionTextSolid, disabled && styles.actionTextDisabled]}>{label}</Text></Pressable>;
}

function StatPill({ label, value }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: COLORS.canvas },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  scroll: { padding: 20, gap: 16, paddingBottom: 32 },
  card: { backgroundColor: COLORS.card, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: COLORS.line, gap: 12 },
  hero: { backgroundColor: COLORS.cardStrong, borderColor: COLORS.cardStrong },
  dark: { backgroundColor: COLORS.cardStrong, borderColor: COLORS.cardStrong },
  kicker: { color: COLORS.accentStrong, textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11, fontWeight: '700' },
  kickerDark: { color: '#f0c9bd' },
  title: { color: COLORS.ink, fontSize: 40, lineHeight: 44, fontFamily: FONT },
  titleDark: { color: '#fff7ef' },
  heroText: { color: '#dbcfc2', fontSize: 15, lineHeight: 22 },
  heroMeta: { color: '#f0c9bd', fontSize: 12, fontWeight: '700' },
  notice: { backgroundColor: COLORS.mintSoft, borderColor: COLORS.mint, borderWidth: 1, borderRadius: 18, padding: 14 },
  noticeText: { color: COLORS.ink, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tab: { minWidth: 62, flexGrow: 1, borderRadius: 999, paddingVertical: 11, paddingHorizontal: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.lineStrong, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tabText: { color: COLORS.ink, fontWeight: '700', textTransform: 'capitalize', fontSize: 12 },
  tabTextActive: { color: '#fff7ef' },
  label: { color: COLORS.ink, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  labelDark: { color: '#f0c9bd' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  link: { color: COLORS.accentStrong, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas },
  chipText: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff7ef' },
  editor: { minHeight: 170, borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas, padding: 14, color: COLORS.ink, fontSize: 16, lineHeight: 24 },
  input: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.ink, fontSize: 15 },
  inputLarge: { minHeight: 120, borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.ink, fontSize: 15, lineHeight: 22 },
  scoreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statPill: { minWidth: 86, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 18, backgroundColor: COLORS.canvas, borderWidth: 1, borderColor: COLORS.lineStrong, gap: 4 },
  statLabel: { color: COLORS.inkSoft, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.7 },
  statValue: { color: COLORS.ink, fontSize: 20, lineHeight: 24, fontWeight: '700' },
  action: { minWidth: 108, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999, borderWidth: 1, alignItems: 'center' },
  actionSolid: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  actionSoft: { backgroundColor: COLORS.skySoft, borderColor: COLORS.sky },
  actionGhost: { backgroundColor: COLORS.canvas, borderColor: COLORS.lineStrong },
  actionDisabled: { backgroundColor: '#efe8db', borderColor: '#d6c8b3' },
  actionText: { color: COLORS.ink, fontWeight: '700', fontSize: 13 },
  actionTextSolid: { color: '#fff7ef' },
  actionTextDisabled: { color: '#8b7f73' },
  result: { color: '#fff7ef', fontSize: 18, lineHeight: 28 },
  pronunciation: { color: '#f0c9bd', fontSize: 14, lineHeight: 20 },
  path: { color: COLORS.ink, fontWeight: '700', lineHeight: 20 },
  note: { backgroundColor: COLORS.cardStrong, color: '#f6eadf', borderRadius: 18, padding: 14, lineHeight: 20 },
  quizTitle: { color: COLORS.ink, fontSize: 24, lineHeight: 30, fontFamily: FONT },
  quizPrompt: { color: COLORS.ink, fontSize: 17, lineHeight: 26, fontWeight: '600' },
  quizAnswer: { color: COLORS.mint, fontSize: 16, lineHeight: 24, fontWeight: '700' },
  subtle: { color: COLORS.inkSoft, lineHeight: 20 },
  historyItem: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 16, gap: 8 },
  selectedItem: { borderTopColor: COLORS.accent },
  historyTitle: { color: COLORS.ink, fontSize: 22, lineHeight: 26, fontFamily: FONT },
  snippet: { color: COLORS.inkSoft, lineHeight: 20 },
  historyResult: { color: COLORS.ink, lineHeight: 22, fontWeight: '600' },
  darkLine: { color: '#f6eadf', lineHeight: 22 },
});
