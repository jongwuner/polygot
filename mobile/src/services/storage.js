import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_SETTINGS, HISTORY_LIMIT, STORAGE_KEYS } from '../constants';

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_SETTINGS;
    }

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch (error) {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings) {
  await AsyncStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({
      ...DEFAULT_SETTINGS,
      ...settings,
    })
  );
}

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.history);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => item && typeof item === 'object');
  } catch (error) {
    return [];
  }
}

export async function saveHistory(history) {
  await AsyncStorage.setItem(
    STORAGE_KEYS.history,
    JSON.stringify(Array.isArray(history) ? history.slice(0, HISTORY_LIMIT) : [])
  );
}

export function prependHistoryEntry(history, entry) {
  return [entry, ...(history || []).filter((item) => item?.id !== entry.id)].slice(0, HISTORY_LIMIT);
}
