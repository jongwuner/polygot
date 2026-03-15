import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { ARCHIVE_LANGUAGE_OPTIONS, CLIENT, CLIENT_RELEASES, COLORS, DEFAULT_SETTINGS, INPUT_PLACEHOLDER, LANGUAGES, SOURCE_LANGUAGE_OPTIONS, TARGET_LANGUAGE_OPTIONS } from './src/constants';
import { loadHistory, loadSettings, prependHistoryEntry, saveHistory, saveSettings } from './src/services/storage';
import { translateText } from './src/services/translate';
import { buildPathPreview, buildTranslationNote } from './src/utils/obsidian';

const TABS = ['translate', 'history', 'settings'];
const FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('translate');
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([loadSettings(), loadHistory()]).then(([savedSettings, savedHistory]) => {
      if (!live) return;
      setSettings(savedSettings);
      setHistory(savedHistory);
      setReady(true);
    }).catch(() => {
      if (!live) return;
      setNotice('Failed to load local data.');
      setReady(true);
    });
    return () => { live = false; };
  }, []);

  useEffect(() => { if (ready) saveSettings(settings).catch(() => setNotice('Could not save settings.')); }, [ready, settings]);
  useEffect(() => { if (ready) saveHistory(history).catch(() => setNotice('Could not save history.')); }, [ready, history]);
  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(''), 2800);
    return () => clearTimeout(id);
  }, [notice]);

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

  function updateSetting(key, value) {
    setSettings((state) => ({ ...state, [key]: value }));
  }

  async function copyText(value, label) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setNotice(`${label} copied.`);
  }

  async function shareNote() {
    if (!current) return;
    const note = makeNote(current, settings);
    await Share.share({ message: `${note.content}\n\nPath: ${note.filePath}` });
  }

  async function openObsidian() {
    if (!current) return;
    if (!settings.vaultName.trim()) {
      setTab('settings');
      setNotice('Set a vault name first.');
      return;
    }
    await Linking.openURL(makeNote(current, settings).uri).catch(() => setNotice('Could not open Obsidian.'));
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

  const previewCode = current?.sourceCode || (settings.sourceLang === 'auto' ? LANGUAGES.ko.code : LANGUAGES[settings.sourceLang].code);
  const pathPreview = current ? makeNote(current, settings).filePath : buildPathPreview(settings, previewCode);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.canvas} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, styles.hero]}>
              <Text style={[styles.kicker, styles.kickerDark]}>React Native translation workspace</Text>
              <Text style={[styles.title, styles.titleDark]}>Polyglot</Text>
              <Text style={styles.heroText}>Translate on mobile, keep a local history, and stage Obsidian notes with the same archive pattern as the other clients.</Text>
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
                      <Action label="Copy note" tone="soft" onPress={() => copyText(makeNote(current, settings).content, 'Note')} />
                    </View>
                  </View>
                ) : null}

                <View style={styles.card}>
                  <Text style={styles.label}>Obsidian note</Text>
                  <Text style={styles.path}>{pathPreview}</Text>
                  {current ? <Text style={styles.note}>{makeNote(current, settings).content}</Text> : <Text style={styles.subtle}>Translate first to stage a full markdown note.</Text>}
                  <View style={styles.row}>
                    <Action label="Copy markdown" tone="soft" disabled={!current} onPress={() => copyText(makeNote(current, settings).content, 'Note')} />
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
                      <Action label="Copy note" tone="soft" onPress={() => copyText(makeNote(entry, settings).content, 'Note')} />
                      <Action label="Delete" tone="ghost" onPress={() => { setHistory((items) => items.filter((item) => item.id !== entry.id)); if (current?.id === entry.id) setCurrent(null); }} />
                    </View>
                  </View>
                ))}
              </View>
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

function makeNote(entry, settings) {
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

function Chip({ label, active, color, onPress }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

function Action({ label, onPress, tone, disabled }) {
  const style = tone === 'solid' ? styles.actionSolid : tone === 'soft' ? styles.actionSoft : styles.actionGhost;
  return <Pressable disabled={disabled} onPress={onPress} style={[styles.action, style, disabled && styles.actionDisabled]}><Text style={[styles.actionText, tone === 'solid' && styles.actionTextSolid, disabled && styles.actionTextDisabled]}>{label}</Text></Pressable>;
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
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { flex: 1, borderRadius: 999, paddingVertical: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.lineStrong, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  tabText: { color: COLORS.ink, fontWeight: '700', textTransform: 'capitalize' },
  tabTextActive: { color: '#fff7ef' },
  label: { color: COLORS.ink, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  labelDark: { color: '#f0c9bd' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  split: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { color: COLORS.accentStrong, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas },
  chipText: { color: COLORS.ink, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#fff7ef' },
  editor: { minHeight: 170, borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas, padding: 14, color: COLORS.ink, fontSize: 16, lineHeight: 24 },
  input: { borderRadius: 18, borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.canvas, paddingHorizontal: 14, paddingVertical: 12, color: COLORS.ink, fontSize: 15 },
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
  subtle: { color: COLORS.inkSoft, lineHeight: 20 },
  historyItem: { borderTopWidth: 1, borderTopColor: COLORS.line, paddingTop: 16, gap: 8 },
  historyTitle: { color: COLORS.ink, fontSize: 22, lineHeight: 26, fontFamily: FONT },
  snippet: { color: COLORS.inkSoft, lineHeight: 20 },
  historyResult: { color: COLORS.ink, lineHeight: 22, fontWeight: '600' },
  darkLine: { color: '#f6eadf', lineHeight: 22 },
});
