import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import {
  ARCHIVE_LANGUAGE_LABELS,
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
const TAB_LABELS = {
  translate: '번역',
  history: '기록',
  notes: '노트',
  quiz: '퀴즈',
  ai: '로컬 AI',
  settings: '설정',
};
const FONT = Platform.select({ ios: 'Apple SD Gothic Neo', android: 'sans-serif', default: 'sans-serif' });

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
        setNotice('로컬 데이터를 불러오지 못했어요.');
        setReady(true);
      });

    return () => {
      live = false;
      releaseLocalModel().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (ready) {
      saveSettings(settings).catch(() => setNotice('설정을 저장하지 못했어요.'));
    }
  }, [ready, settings]);

  useEffect(() => {
    if (ready) {
      saveHistory(history).catch(() => setNotice('기록을 저장하지 못했어요.'));
    }
  }, [ready, history]);

  useEffect(() => {
    if (ready) {
      saveNotes(notes).catch(() => setNotice('가져온 노트를 저장하지 못했어요.'));
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
        setNotice('선택한 노트를 불러오지 못했어요.');
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
      setNotice('번역할 문장을 먼저 입력해 주세요.');
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
      setNotice('번역이 완료됐어요.');
    } catch (error) {
      setNotice(error.message || '번역에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value, label) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setNotice(`${label} 복사 완료.`);
  }

  async function shareNote() {
    if (!current) return;
    const note = makeTranslationNote(current, settings);
    await Share.share({ message: `${note.content}\n\n경로: ${note.filePath}` });
  }

  async function openObsidian() {
    if (!current) return;
    if (!settings.vaultName.trim()) {
      setTab('settings');
      setNotice('먼저 Vault 이름을 입력해 주세요.');
      return;
    }
    await Linking.openURL(makeTranslationNote(current, settings).uri).catch(() => setNotice('Obsidian을 열지 못했어요.'));
  }

  async function handleImportNotes() {
    setNotesBusy(true);
    try {
      const imported = await importMarkdownNotes();
      if (!imported.length) {
        setNotice('가져온 마크다운 노트가 없어요.');
        return;
      }

      setNotes((items) => prependNotes(items, imported));
      setSettings((state) => ({
        ...state,
        selectedNoteId: imported[0].id,
      }));
      setTab('notes');
      setNotice(`${imported.length}개의 노트를 가져왔어요.`);
    } catch (error) {
      setNotice(error.message || '가져오기에 실패했어요.');
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
        setNotice('모델 선택이 취소됐어요.');
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
        setNotice(error.message || '모델은 가져왔어요. 네이티브 개발 빌드에서 자세한 정보를 확인해 주세요.');
      }

      setTab('ai');
      setNotice(`모델 준비 완료: ${model.name}`);
    } catch (error) {
      setNotice(error.message || '모델 가져오기에 실패했어요.');
    } finally {
      setModelBusy(false);
    }
  }

  async function handleRunAi() {
    if (!settings.selectedNoteId) {
      setTab('notes');
      setNotice('먼저 Obsidian 노트를 가져오고 선택해 주세요.');
      return;
    }
    if (!settings.llmModelUri) {
      setNotice('먼저 GGUF 모델을 불러와 주세요.');
      return;
    }

    setAiBusy(true);
    setAiOutput('');
    try {
      const { note, content } = await resolveNoteContext();
      if (!note) {
        throw new Error('먼저 Obsidian 노트를 가져오고 선택해 주세요.');
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
        setNotice(`분석 완료. 온디바이스 컨텍스트에 맞추기 위해 노트를 ${result.usedChars}자까지 사용했어요.`);
      } else {
        setNotice('분석이 완료됐어요.');
      }
    } catch (error) {
      setNotice(error.message || '로컬 AI 실행에 실패했어요.');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleGenerateQuiz(mode = 'smart', noteOverride = null) {
    const targetNoteId = noteOverride?.id || settings.selectedNoteId;
    if (!targetNoteId) {
      setTab('notes');
      setNotice('먼저 Obsidian 노트를 가져오고 선택해 주세요.');
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
        throw new Error('먼저 Obsidian 노트를 가져오고 선택해 주세요.');
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
          setNotice(error.message || 'AI 퀴즈 생성에 실패해서 노트 기반 덱으로 전환했어요.');
        }
      } else if (mode !== 'fallback') {
        setNotice('AI 리믹스는 네이티브 빌드와 GGUF 모델이 필요해요. 노트 기반 덱으로 진행할게요.');
      }

      resetQuizSession(deck, deckMode);
      setTab('quiz');
      setNotice(`퀴즈 준비 완료: ${deck.length}문제.`);
    } catch (error) {
      setNotice(error.message || '퀴즈 생성에 실패했어요.');
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
      setNotice(correct ? '퀴즈를 끝까지 완료했어요.' : '퀴즈를 마쳤어요. 한 번 더 돌리면 더 탄탄해져요.');
      return;
    }

    setQuizIndex((value) => value + 1);
    setQuizReveal(false);
  }

  function handleQuizRestart() {
    if (!quizDeck.length) return;
    resetQuizSession(quizDeck, quizMode);
    setNotice('퀴즈를 처음부터 다시 시작했어요.');
  }

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe}>
          <View style={styles.center}>
            <Text style={styles.kicker}>한국어 기본 모바일 클라이언트</Text>
            <Text style={styles.title}>Polygot</Text>
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
              <Text style={[styles.kicker, styles.kickerDark]}>한국어 기본 번역 · 복습 워크스페이스</Text>
              <Text style={[styles.title, styles.titleDark]}>Polygot</Text>
              <Text style={styles.heroText}>
                Obsidian 아카이브 노트를 가져와 퀴즈로 복습하고, 번역과 온디바이스 GGUF 분석까지 한 화면에서 이어서 처리하세요.
              </Text>
              <Text style={styles.heroMeta}>웹 v{CLIENT_RELEASES.web}  |  확장 v{CLIENT_RELEASES.extension}  |  앱 v{CLIENT.version}</Text>
            </View>

            {notice ? <View style={styles.notice}><Text style={styles.noticeText}>{notice}</Text></View> : null}

            <View style={styles.tabs}>
              {TABS.map((name) => (
                <Pressable key={name} onPress={() => setTab(name)} style={[styles.tab, tab === name && styles.tabActive]}>
                  <Text style={[styles.tabText, tab === name && styles.tabTextActive]}>{TAB_LABELS[name]}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'translate' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.label}>원문 언어</Text>
                  <View style={styles.row}>{SOURCE_LANGUAGE_OPTIONS.map((key) => <Chip key={key} label={LANGUAGES[key].label} active={settings.sourceLang === key} color={LANGUAGES[key].accent} onPress={() => updateSetting('sourceLang', key)} />)}</View>
                  <View style={styles.split}><Text style={styles.label}>번역 언어</Text><Pressable onPress={() => settings.sourceLang === 'auto' ? setNotice('원문 언어를 고정하면 순서를 바꿀 수 있어요.') : setSettings((state) => ({ ...state, sourceLang: state.targetLang, targetLang: state.sourceLang }))}><Text style={styles.link}>바꾸기</Text></Pressable></View>
                  <View style={styles.row}>{TARGET_LANGUAGE_OPTIONS.map((key) => <Chip key={key} label={LANGUAGES[key].label} active={settings.targetLang === key} color={LANGUAGES[key].accent} onPress={() => updateSetting('targetLang', key)} />)}</View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>입력</Text>
                  <TextInput value={input} onChangeText={setInput} placeholder={INPUT_PLACEHOLDER} placeholderTextColor={COLORS.inkSoft} multiline textAlignVertical="top" style={styles.editor} />
                  <View style={styles.row}>
                    <Action label="붙여넣기" tone="soft" onPress={() => Clipboard.getStringAsync().then((text) => { setInput(text); setNotice(text ? '클립보드 내용을 붙여 넣었어요.' : '클립보드가 비어 있어요.'); }).catch(() => setNotice('클립보드에 접근하지 못했어요.'))} />
                    <Action label="지우기" tone="ghost" onPress={() => { setInput(''); setCurrent(null); }} />
                    <Action label={busy ? '번역 중...' : '번역하기'} tone="solid" disabled={busy} onPress={onTranslate} />
                  </View>
                </View>

                {current ? (
                  <View style={[styles.card, styles.dark]}>
                    <Text style={[styles.label, styles.labelDark]}>{current.sourceLang} -> {current.targetLang}</Text>
                    <Text style={styles.result}>{current.translated}</Text>
                    {current.pronunciation ? <Text style={styles.pronunciation}>{current.targetKey === 'cn' ? '병음' : '로마자'}: {current.pronunciation}</Text> : null}
                    <View style={styles.row}>
                      <Action label="번역 복사" tone="soft" onPress={() => copyText(current.translated, '번역문')} />
                      <Action label="노트 복사" tone="soft" onPress={() => copyText(makeTranslationNote(current, settings).content, '노트')} />
                    </View>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.label}>Obsidian 노트</Text>
                  <Text style={styles.path}>{pathPreview}</Text>
                  {current ? <Text style={styles.note}>{makeTranslationNote(current, settings).content}</Text> : <Text style={styles.subtle}>먼저 번역하면 바로 저장 가능한 마크다운 노트를 만들 수 있어요.</Text>}
                  <View style={styles.row}>
                    <Action label="마크다운 복사" tone="soft" disabled={!current} onPress={() => copyText(makeTranslationNote(current, settings).content, '노트')} />
                    <Action label="공유" tone="soft" disabled={!current} onPress={shareNote} />
                    <Action label="Obsidian 열기" tone="solid" disabled={!current} onPress={openObsidian} />
                  </View>
                </View>
              </>
            ) : null}

            {tab === 'history' ? (
              <View style={styles.card}>
                <View style={styles.split}><Text style={styles.label}>저장된 번역 ({history.length})</Text><Pressable onPress={() => { setHistory([]); if (current) setCurrent(null); }}><Text style={styles.link}>전체 삭제</Text></Pressable></View>
                {!history.length ? <Text style={styles.subtle}>번역을 실행하면 여기에서 다시 꺼내 쓸 수 있어요.</Text> : null}
                {history.map((entry) => (
                  <View key={entry.id} style={styles.historyItem}>
                    <Text style={styles.historyTitle}>{entry.sourceLang} -> {entry.targetLang}</Text>
                    <Text style={styles.subtle}>{stamp(entry.createdAt)}</Text>
                    <Text style={styles.snippet}>{entry.original}</Text>
                    <Text style={styles.historyResult}>{entry.translated}</Text>
                    <View style={styles.row}>
                      <Action label="다시 쓰기" tone="soft" onPress={() => { setInput(entry.original); setCurrent(entry); setSettings((state) => ({ ...state, sourceLang: entry.requestedSourceKey || state.sourceLang, targetLang: entry.targetKey || state.targetLang })); setTab('translate'); }} />
                      <Action label="노트 복사" tone="soft" onPress={() => copyText(makeTranslationNote(entry, settings).content, '노트')} />
                      <Action label="삭제" tone="ghost" onPress={() => { setHistory((items) => items.filter((item) => item.id !== entry.id)); if (current?.id === entry.id) setCurrent(null); }} />
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {tab === 'notes' ? (
              <>
                <View style={styles.card}>
                  <View style={styles.split}>
                    <Text style={styles.label}>Obsidian 마크다운</Text>
                    <Action label={notesBusy ? '가져오는 중...' : '.md 가져오기'} tone="solid" disabled={notesBusy} onPress={handleImportNotes} />
                  </View>
                  <Text style={styles.subtle}>
                    휴대폰에 있는 마크다운 파일을 가져오세요. 앱 안에 저장해 두고 나중에 다시 열거나 복습 퀴즈로 바로 바꿀 수 있어요.
                  </Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>가져온 노트 ({notes.length})</Text>
                  {!notes.length ? <Text style={styles.subtle}>아직 가져온 노트가 없어요.</Text> : null}
                  {notes.map((note) => (
                    <View key={note.id} style={[styles.historyItem, settings.selectedNoteId === note.id && styles.selectedItem]}>
                      <Text style={styles.historyTitle}>{note.name}</Text>
                      <Text style={styles.subtle}>{stamp(note.importedAt)}  |  {formatBytes(note.size)}  |  {note.charCount}자</Text>
                      <Text style={styles.snippet}>{note.preview || '(빈 노트)'}</Text>
                      <View style={styles.row}>
                        <Action label="열기" tone="soft" onPress={() => setSettings((state) => ({ ...state, selectedNoteId: note.id }))} />
                        <Action label="바로 퀴즈" tone="soft" disabled={quizBusy} onPress={() => handleGenerateQuiz('fallback', note)} />
                        <Action label="삭제" tone="ghost" onPress={() => handleDeleteNote(note)} />
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>선택한 노트</Text>
                  {selectedNote ? (
                    <>
                      <Text style={styles.path}>{selectedNote.name}</Text>
                      <Text style={styles.note}>{selectedNoteContent || '(빈 노트)'}</Text>
                    </>
                  ) : (
                    <Text style={styles.subtle}>노트를 선택하면 여기에서 내용을 미리 볼 수 있어요.</Text>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'quiz' ? (
              <>
                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>복습 퀴즈</Text>
                  <Text style={styles.darkLine}>{selectedNote ? selectedNote.name : '선택한 노트가 없어요'}</Text>
                  <Text style={styles.darkLine}>
                    덱 모드: {quizMode === 'ai-remix' ? 'AI 리믹스' : '노트 기반'}  |  진행도: {quizProgress}
                  </Text>
                  <View style={styles.row}>
                    <Action label={quizBusy ? '만드는 중...' : '빠른 퀴즈'} tone="soft" disabled={quizBusy || !selectedNote} onPress={() => handleGenerateQuiz('fallback')} />
                    <Action label={quizBusy ? '만드는 중...' : 'AI 리믹스'} tone="solid" disabled={quizBusy || !selectedNote} onPress={() => handleGenerateQuiz('smart')} />
                    <Action label="다시 시작" tone="ghost" disabled={!quizDeck.length} onPress={handleQuizRestart} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>퀴즈 방향</Text>
                  <Text style={styles.subtle}>
                    빠른 퀴즈는 노트 구조를 바로 문제로 바꾸고, AI 리믹스는 GGUF 모델로 문제 톤을 더 다양하게 섞어 줘요.
                  </Text>
                  <TextInput
                    value={quizPrompt}
                    onChangeText={setQuizPrompt}
                    multiline
                    textAlignVertical="top"
                    style={styles.inputLarge}
                    placeholder="퀴즈를 더 가볍게 할지, 더 빡세게 할지 원하는 스타일을 적어 주세요."
                    placeholderTextColor={COLORS.inkSoft}
                  />
                </View>

                <View style={styles.card}>
                  <View style={styles.split}>
                    <Text style={styles.label}>세션 현황</Text>
                    <Text style={styles.link}>{quizProgress}</Text>
                  </View>
                  <View style={styles.scoreRow}>
                    <StatPill label="점수" value={`${quizScore}/${quizDeck.length || 0}`} />
                    <StatPill label="연속" value={String(quizStreak)} />
                    <StatPill label="최고" value={String(quizBestStreak)} />
                    <StatPill label="XP" value={String(quizXp)} />
                  </View>
                  <Text style={styles.subtle}>
                    카드를 펼쳐 보고 맞았는지 체크하세요. 여러 번 돌수록 노트 내용이 훨씬 빨리 붙습니다.
                  </Text>
                </View>

                <View style={styles.card}>
                  {currentQuiz ? (
                    <>
                      <Text style={styles.quizTitle}>{currentQuiz.title}</Text>
                      <Text style={styles.quizPrompt}>{currentQuiz.prompt}</Text>
                      {currentQuiz.hint ? <Text style={styles.subtle}>힌트: {currentQuiz.hint}</Text> : null}
                      {quizReveal ? (
                        <Text style={styles.quizAnswer}>{currentQuiz.answer}</Text>
                      ) : (
                        <Text style={styles.subtle}>답을 먼저 떠올린 뒤 정답을 펼쳐 보세요.</Text>
                      )}
                      {quizFinished ? (
                        <Text style={styles.subtle}>이번 덱은 끝났어요. 다시 풀거나 AI 리믹스로 2차 복습을 돌려 보세요.</Text>
                      ) : null}
                      {quizReveal && currentQuiz.source ? <Text style={styles.note}>{currentQuiz.source}</Text> : null}
                      <View style={styles.row}>
                        <Action label={quizReveal ? '정답 확인됨' : '정답 보기'} tone="soft" disabled={quizReveal} onPress={handleQuizReveal} />
                        <Action label="맞음" tone="solid" disabled={!quizReveal || quizFinished} onPress={() => handleQuizResult(true)} />
                        <Action label="아쉬움" tone="ghost" disabled={!quizReveal || quizFinished} onPress={() => handleQuizResult(false)} />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.quizTitle}>아직 퀴즈가 없어요</Text>
                      <Text style={styles.subtle}>
                        가져온 Obsidian 노트를 선택한 뒤 빠른 퀴즈나 AI 리믹스로 복습 세션을 시작해 보세요.
                      </Text>
                    </>
                  )}
                </View>
              </>
            ) : null}

            {tab === 'ai' ? (
              <>
                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>로컬 모델 런타임</Text>
                  <Text style={styles.darkLine}>{localLlm.reason}</Text>
                  <Text style={styles.darkLine}>
                    현재 모델: {settings.llmModelName || '불러온 모델 없음'}
                  </Text>
                  <View style={styles.row}>
                    <Action label={modelBusy ? '불러오는 중...' : 'GGUF 불러오기'} tone="soft" disabled={modelBusy} onPress={handlePickModel} />
                    <Action label="모델 해제" tone="ghost" onPress={() => releaseLocalModel().then(() => setNotice('로컬 모델을 해제했어요.')).catch(() => setNotice('로컬 모델을 해제하지 못했어요.'))} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>분석 대상</Text>
                  <Text style={styles.path}>{selectedNote ? selectedNote.name : '선택한 노트가 없어요'}</Text>
                  <Text style={styles.subtle}>
                    1B~3B급의 가벼운 GGUF instruct 모델이 잘 맞아요. 이 기능은 Expo Go나 웹이 아니라 네이티브 개발 빌드를 기준으로 설계돼 있습니다.
                  </Text>
                  <TextInput value={aiPrompt} onChangeText={setAiPrompt} multiline textAlignVertical="top" style={styles.inputLarge} placeholder="선택한 노트에 대해 로컬 모델이 무엇을 해주면 좋을지 적어 주세요." placeholderTextColor={COLORS.inkSoft} />
                  <View style={styles.row}>
                    <Action label={aiBusy ? '실행 중...' : '로컬 AI 실행'} tone="solid" disabled={aiBusy || !selectedNote} onPress={handleRunAi} />
                    <Action label="답변 복사" tone="soft" disabled={!aiOutput} onPress={() => copyText(aiOutput, 'AI 답변')} />
                  </View>
                </View>

                {modelInfo ? (
                  <View style={styles.card}>
                    <Text style={styles.label}>모델 정보</Text>
                    <Text style={styles.note}>{JSON.stringify(modelInfo, null, 2)}</Text>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.label}>AI 결과</Text>
                  <Text style={aiOutput ? styles.note : styles.subtle}>
                    {aiOutput || '선택한 노트를 로컬 모델로 분석하면 결과가 여기에 표시돼요.'}
                  </Text>
                </View>
              </>
            ) : null}

            {tab === 'settings' ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.label}>Vault 이름</Text>
                  <TextInput value={settings.vaultName} onChangeText={(value) => updateSetting('vaultName', value)} placeholder="MyVault" placeholderTextColor={COLORS.inkSoft} style={styles.input} />
                  <Text style={styles.label}>아카이브 기본 경로</Text>
                  <TextInput value={settings.archiveBase} onChangeText={(value) => updateSetting('archiveBase', value)} placeholder="4. Archive" placeholderTextColor={COLORS.inkSoft} style={styles.input} />
                  <Text style={styles.label}>아카이브 언어 폴더</Text>
                  <View style={styles.row}>{ARCHIVE_LANGUAGE_OPTIONS.map((name) => <Chip key={name} label={ARCHIVE_LANGUAGE_LABELS[name] || name} active={settings.archiveLang === name} color={COLORS.sky} onPress={() => updateSetting('archiveLang', name)} />)}</View>
                  <Text style={styles.path}>{pathPreview}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.label}>로컬 AI 기본값</Text>
                  <TextInput value={String(settings.llmContextSize)} onChangeText={(value) => updateSetting('llmContextSize', toSafeNumber(value, 2048))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>컨텍스트 크기 토큰 수</Text>
                  <TextInput value={String(settings.llmMaxTokens)} onChangeText={(value) => updateSetting('llmMaxTokens', toSafeNumber(value, 512))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>최대 출력 토큰 수</Text>
                  <TextInput value={String(settings.llmGpuLayers)} onChangeText={(value) => updateSetting('llmGpuLayers', toSafeNumber(value, 99))} keyboardType="numeric" style={styles.input} />
                  <Text style={styles.subtle}>지원 시 GPU로 넘길 레이어 수</Text>
                </View>

                <View style={[styles.card, styles.dark]}>
                  <Text style={[styles.label, styles.labelDark]}>클라이언트 버전</Text>
                  <Text style={styles.darkLine}>웹 클라이언트: v{CLIENT_RELEASES.web}</Text>
                  <Text style={styles.darkLine}>크롬 확장: v{CLIENT_RELEASES.extension}</Text>
                  <Text style={styles.darkLine}>React Native 앱: v{CLIENT.version}</Text>
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
  tabText: { color: COLORS.ink, fontWeight: '700', fontSize: 12 },
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
