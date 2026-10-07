import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { DEFAULT_LANGUAGE, getLanguage } from './languages';

const LANGUAGE_KEY = 'fsf_survey_language';
export const DRAFT_KEY = 'fsf_survey_draft';

// Saved progress is thrown away after this long, so a shared or borrowed
// phone doesn't hold someone's answers for days. Same as the website.
const DRAFT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Storage problems must never break the survey - progress just won't
// survive closing the app.
export async function saveDraft(draft) {
  try {
    await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // ignore
  }
}

export async function clearDraft() {
  try {
    await AsyncStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export async function loadDraft() {
  try {
    const draft = JSON.parse(await AsyncStorage.getItem(DRAFT_KEY));
    if (!draft || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      await clearDraft();
      return null;
    }
    return Object.keys(draft.answers || {}).length ? draft : null;
  } catch {
    return null;
  }
}

// The picked survey language, remembered on this phone.
export function useSurveyLanguage() {
  const [code, setCode] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((saved) => saved && setCode(getLanguage(saved).code))
      .catch(() => {});
  }, []);

  const choose = useCallback((next) => {
    setCode(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
  }, []);

  return [getLanguage(code), choose];
}

// Read-aloud with the phone's built-in voice. `supported` hides the button
// when the phone clearly has no voice for the language. Some Android phones
// report no voices at all until one has been used, so an empty list counts
// as "probably fine" rather than hiding the button.
export function useSpeech(lang) {
  const [supported, setSupported] = useState(true);
  const [speakingId, setSpeakingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const prefix = lang.toLowerCase().split('-')[0];
    Speech.getAvailableVoicesAsync()
      .then((voices) => {
        if (cancelled || !voices?.length) return;
        setSupported(voices.some((v) => (v.language || '').toLowerCase().replace('_', '-').split('-')[0] === prefix));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      Speech.stop();
    };
  }, [lang]);

  const stop = useCallback(() => {
    Speech.stop();
    setSpeakingId(null);
  }, []);

  const speak = useCallback(
    (id, text) => {
      Speech.stop();
      setSpeakingId(id);
      const done = () => setSpeakingId((current) => (current === id ? null : current));
      Speech.speak(text, { language: lang, rate: 0.9, onDone: done, onStopped: done, onError: done });
    },
    [lang]
  );

  return { supported, speak, stop, speakingId };
}
