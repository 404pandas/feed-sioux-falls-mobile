import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { api } from '../../api/client';
import { queueAction } from '../../utils/offlineQueue';
import { useAuth } from '../../context/AuthContext';
import { SECTIONS, isVisible } from '../../survey/questions';
import { LANGUAGES, getLanguage } from '../../survey/languages';
import { clearDraft, loadDraft, saveDraft, useSpeech, useSurveyLanguage } from '../../survey/hooks';
import SurveyQuestion, { ReadAloudButton } from '../../survey/SurveyQuestion';
import ShareSurvey from '../../survey/ShareSurvey';
import TranslationPlaceholder from '../../survey/TranslationPlaceholder';
import BackLink from '../../components/BackLink';

const EMPTY_CONTACT = { wants: null, name: '', phone: '', email: '', bestTime: '', safeToLeaveMessage: null };

function hasAnswer(value) {
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== '';
}

// The community survey, same questions and wording as the website's
// /survey page, and it lands in the same place (POST /api/survey).
//
// Built for three situations:
// - a volunteer handing their phone to someone at the table (answers are
//   marked "volunteer helped", and the phone can be handed back after),
// - a volunteer typing in a paper survey afterward,
// - a guest or neighbor filling it out on their own phone.
//
// Every question is optional. Quick Exit (top right) erases everything and
// leaves immediately. With no signal, the finished survey waits in the
// offline queue and sends itself later, like tally taps do.
export default function SurveyScreen({ navigation }) {
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'volunteer';

  const [language, setLanguage] = useSurveyLanguage();
  // Placeholder (not yet translated) languages show English around the
  // "help us translate" page.
  const strings = language.strings || getLanguage('en').strings;
  const { ui } = strings;
  const speech = useSpeech(language.speechLang);

  const [savedDraft, setSavedDraft] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  // Contact details live in memory only while filling out - never in the draft.
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [source, setSource] = useState('volunteer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null); // null | { contacted, queued }
  const scrollRef = useRef(null);
  // Set right before leaving on purpose, so the "leave the survey?" check
  // doesn't pop up for Quick Exit or a finished survey.
  const leavingRef = useRef(false);

  const totalSteps = SECTIONS.length;
  const section = step > 0 ? SECTIONS[step - 1] : null;
  const isLastStep = step === totalSteps;

  useEffect(() => {
    loadDraft().then(setSavedDraft);
  }, []);

  // Save progress as they go, in case of a dead battery or lost signal.
  useEffect(() => {
    if (done || step === 0 || !Object.keys(answers).length) return;
    saveDraft({ answers, step, source });
  }, [answers, step, source, done]);

  // Each new step: stop reading and jump back to the top.
  useEffect(() => {
    speech.stop();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done]);

  const resetAll = useCallback(async () => {
    await clearDraft();
    setSavedDraft(null);
    setAnswers({});
    setContact(EMPTY_CONTACT);
    setError('');
    setStep(0);
  }, []);

  const stopSpeech = speech.stop;
  const quickExit = useCallback(async () => {
    stopSpeech();
    leavingRef.current = true;
    setAnswers({});
    setContact(EMPTY_CONTACT);
    await clearDraft();
    navigation.goBack();
  }, [navigation, stopSpeech]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: ui.headerTitle,
      headerRight: () => (
        <Pressable
          onPress={quickExit}
          accessibilityRole="button"
          accessibilityLabel={`${ui.quickExit}. ${ui.quickExitHint}`}
          hitSlop={10}
          style={styles.quickExit}
        >
          <Text style={styles.quickExitText}>{ui.quickExit}</Text>
        </Pressable>
      ),
    });
  }, [navigation, ui, quickExit]);

  // Back button / swipe back mid-survey: check first, since a tap by
  // accident would otherwise lose someone's place. Their answers stay saved
  // as a draft either way.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (leavingRef.current || done || (step === 0 && !Object.keys(answers).length)) return;
      e.preventDefault();
      Alert.alert(ui.closeTitle, ui.closeBody, [
        { text: ui.closeStay, style: 'cancel' },
        {
          text: ui.closeLeave,
          onPress: () => {
            leavingRef.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
  }, [navigation, step, answers, done, ui]);

  function setAnswer(id, value) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (hasAnswer(value)) next[id] = value;
      else delete next[id];
      return next;
    });
  }

  function resume() {
    setAnswers(savedDraft.answers);
    setSource(savedDraft.source || 'volunteer');
    setStep(Math.min(Math.max(savedDraft.step, 1), totalSteps));
    setSavedDraft(null);
  }

  function eraseAnswers() {
    Alert.alert(ui.clearAnswers, ui.clearConfirm, [
      { text: ui.closeStay, style: 'cancel' },
      { text: ui.clearAnswers, style: 'destructive', onPress: resetAll },
    ]);
  }

  const sectionHasAnswers = section?.questions.some((q) => isVisible(q, answers) && hasAnswer(answers[q.id]));
  const contactMissing = contact.wants === true && !contact.phone.trim() && !contact.email.trim();

  async function submit() {
    if (contactMissing) {
      setError(ui.contactNeedOne);
      return;
    }
    setError('');
    setSubmitting(true);

    // Drop answers to questions that ended up hidden (e.g. kids count after
    // un-checking kids).
    const visibleAnswers = {};
    for (const s of SECTIONS) {
      for (const q of s.questions) {
        if (isVisible(q, answers) && hasAnswer(answers[q.id])) visibleAnswers[q.id] = answers[q.id];
      }
    }

    const payload = {
      answers: visibleAnswers,
      language: language.code,
      source: isStaff ? source : 'self',
      contact:
        contact.wants === true
          ? {
              name: contact.name,
              phone: contact.phone,
              email: contact.email,
              bestTime: contact.bestTime,
              safeToLeaveMessage: contact.safeToLeaveMessage,
            }
          : undefined,
    };

    try {
      let queued = false;
      const net = await NetInfo.fetch();
      if (net.isConnected) {
        try {
          await api.submitSurvey(payload);
        } catch (err) {
          // The server answered and said no - show it, keep their answers.
          if (typeof err.status === 'number') throw err;
          // No real connection after all - fall through to the queue.
          queued = true;
        }
      } else {
        queued = true;
      }
      if (queued) await queueAction('survey', payload);

      const contacted = contact.wants === true;
      leavingRef.current = false;
      await resetAll();
      setDone({ contacted, queued });
    } catch (err) {
      setError(`${ui.submitError} (${err.message})`);
    } finally {
      setSubmitting(false);
    }
  }

  // Each language in its own script, so people can find theirs without
  // reading English. Two per row so every name fits on small phones.
  const languagePicker = (
    <View style={styles.langRow} accessibilityRole="radiogroup" accessibilityLabel={`${ui.language} / Language`}>
      {LANGUAGES.map((l) => {
        const active = l.code === language.code;
        return (
          <Pressable
            key={l.code}
            onPress={() => setLanguage(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={l.nativeName === l.englishName ? l.nativeName : `${l.nativeName}, ${l.englishName}`}
            style={[styles.langButton, active && styles.langButtonActive]}
          >
            <Text style={[styles.langText, active && styles.langTextActive]} numberOfLines={1}>
              {l.nativeName}
            </Text>
            {l.nativeName !== l.englishName && (
              <Text style={[styles.langSub, active && styles.langTextActive]} numberOfLines={1}>
                {l.englishName}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  let body;
  if (!language.strings) {
    body = <TranslationPlaceholder language={language} onChooseLanguage={setLanguage} />;
  } else if (done) {
    body = (
      <>
        <Text style={typography.h1} accessibilityRole="header">
          {done.queued ? ui.queuedTitle : ui.thanksTitle}
        </Text>
        <Text style={styles.bodyText} accessibilityLiveRegion="polite">
          {done.queued ? ui.queuedBody : ui.thanksBody} {done.contacted ? ui.thanksContact : ''}
        </Text>
        {isStaff && source === 'volunteer' && <Text style={[styles.bodyText, { fontWeight: '700' }]}>{ui.handBack}</Text>}
        <Button title={ui.startAnother} onPress={() => setDone(null)} style={{ marginBottom: spacing.lg }} />
        <ShareSurvey ui={ui} />
      </>
    );
  } else if (step === 0) {
    const introText = [ui.title, ...ui.intro, ui.time].join('. ');
    body = (
      <>
        <Text style={styles.exitNote}>{ui.quickExitExplain}</Text>
        <View style={styles.titleRow}>
          <Text style={[typography.h1, { flexShrink: 1, marginRight: spacing.sm }]} accessibilityRole="header">
            {ui.title}
          </Text>
          <ReadAloudButton id="intro" text={introText} speech={speech} ui={ui} />
        </View>
        {ui.intro.map((p) => (
          <Text key={p} style={styles.bodyText}>
            {p}
          </Text>
        ))}
        <Text style={[styles.bodyText, { fontWeight: '600' }]}>⏱ {ui.time}</Text>

        {isStaff && (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.h2, { marginBottom: spacing.sm }]}>{ui.sourceTitle}</Text>
            {[
              ['volunteer', ui.sourceVolunteer],
              ['paper', ui.sourcePaper],
            ].map(([value, label]) => (
              <Button
                key={value}
                title={label}
                variant={source === value ? 'primary' : 'outline'}
                onPress={() => setSource(value)}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </Card>
        )}

        {savedDraft ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={[typography.h2, { marginBottom: spacing.sm }]}>{ui.resumeTitle}</Text>
            <Text style={styles.bodyText}>{ui.resumeBody}</Text>
            <Button title={ui.resume} onPress={resume} style={{ marginBottom: spacing.sm }} />
            <Button title={ui.startOver} variant="outline" onPress={resetAll} />
          </Card>
        ) : (
          <Button title={ui.start} variant="accent" onPress={() => setStep(1)} style={{ marginBottom: spacing.lg }} />
        )}

        <ShareSurvey ui={ui} />

        <Text style={[typography.bodyMuted, { marginTop: spacing.lg }]}>{ui.savedNote}</Text>
        <WhoSees ui={ui} />
      </>
    );
  } else {
    body = (
      <>
        <Text style={typography.bodyMuted}>{ui.stepOf(step, totalSteps)}</Text>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 1, max: totalSteps, now: step }}
        >
          <View style={[styles.progressFill, { width: `${(step / totalSteps) * 100}%` }]} />
        </View>
        <Text style={[typography.h1, { marginBottom: spacing.lg }]} accessibilityRole="header">
          {strings.sections[section.id]}
        </Text>

        {section.questions
          .filter((q) => isVisible(q, answers))
          .map((q) => (
            <SurveyQuestion
              key={q.id}
              question={q}
              value={answers[q.id]}
              onChange={(v) => setAnswer(q.id, v)}
              strings={strings}
              speech={speech}
            />
          ))}

        {isLastStep && <ContactStep ui={ui} contact={contact} setContact={setContact} speech={speech} />}
        {isLastStep && <WhoSees ui={ui} />}

        {!!error && (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        )}

        <View style={styles.navRow}>
          <Button title={ui.back} variant="outline" onPress={() => setStep(step - 1)} style={{ flex: 1, marginRight: spacing.sm }} />
          {isLastStep ? (
            <Button title={submitting ? ui.submitting : ui.submit} variant="accent" onPress={submit} loading={submitting} style={{ flex: 2 }} />
          ) : (
            <Button title={sectionHasAnswers ? ui.next : ui.skip} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
          )}
        </View>

        <Pressable onPress={eraseAnswers} accessibilityRole="button" style={{ alignSelf: 'center', padding: spacing.md }}>
          <Text style={[typography.bodyMuted, { textDecorationLine: 'underline' }]}>{ui.clearAnswers}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        {/* The normal way out - saved progress stays, unlike Quick Exit. */}
        <BackLink label={user ? ui.backHome : ui.backHomeGuest} onPress={() => navigation.popToTop()} />
        {languagePicker}
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

function WhoSees({ ui }) {
  return (
    <View style={styles.whoSees}>
      <Text style={[typography.h2, { marginBottom: spacing.sm }]} accessibilityRole="header">
        {ui.whoSeesTitle}
      </Text>
      {ui.whoSees.map((p) => (
        <Text key={p} style={[typography.body, { marginBottom: spacing.sm }]}>
          {p}
        </Text>
      ))}
    </View>
  );
}

function ContactStep({ ui, contact, setContact, speech }) {
  const update = (field) => (value) => setContact((c) => ({ ...c, [field]: value }));

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <View style={styles.titleRow}>
        <Text style={[styles.questionLabel, { flexShrink: 1, marginRight: spacing.sm }]}>{ui.contactTitle}</Text>
        <ReadAloudButton id="contact" text={`${ui.contactTitle} ${ui.contactHint}`} speech={speech} ui={ui} />
      </View>
      <Text style={[typography.bodyMuted, { fontSize: 16, marginBottom: spacing.sm }]}>{ui.contactHint}</Text>
      {[
        [true, ui.contactYes],
        [false, ui.contactNo],
      ].map(([value, label]) => (
        <Button
          key={label}
          title={label}
          variant={contact.wants === value ? 'primary' : 'outline'}
          onPress={() => setContact((c) => ({ ...c, wants: c.wants === value ? null : value }))}
          style={{ marginBottom: spacing.sm }}
        />
      ))}

      {contact.wants === true && (
        <Card style={{ marginTop: spacing.sm }}>
          <Text style={styles.fieldLabel}>{ui.contactName}</Text>
          <TextInput value={contact.name} onChangeText={update('name')} style={styles.input} autoComplete="off" />

          <Text style={styles.fieldLabel}>{ui.contactPhone}</Text>
          <TextInput value={contact.phone} onChangeText={update('phone')} style={styles.input} keyboardType="phone-pad" autoComplete="off" />

          <Text style={styles.fieldLabel}>{ui.contactEmail}</Text>
          <TextInput
            value={contact.email}
            onChangeText={update('email')}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
          />

          <Text style={styles.fieldLabel}>{ui.contactBestTime}</Text>
          <TextInput value={contact.bestTime} onChangeText={update('bestTime')} style={styles.input} autoComplete="off" />

          <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>{ui.contactSafe}</Text>
          {[
            [true, ui.contactSafeYes],
            [false, ui.contactSafeNo],
          ].map(([value, label]) => (
            <Button
              key={label}
              title={label}
              variant={contact.safeToLeaveMessage === value ? 'primary' : 'outline'}
              onPress={() => setContact((c) => ({ ...c, safeToLeaveMessage: c.safeToLeaveMessage === value ? null : value }))}
              style={{ marginTop: spacing.sm }}
            />
          ))}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  langRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.md },
  langButton: {
    width: '48.5%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.white,
  },
  langButtonActive: { backgroundColor: colors.primary },
  langText: { fontSize: 18, fontWeight: '600', color: colors.primary },
  langSub: { fontSize: 13, color: colors.textMuted },
  langTextActive: { color: colors.white },
  quickExit: {
    backgroundColor: colors.danger,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.white,
  },
  quickExitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  exitNote: {
    ...typography.body,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  bodyText: { fontSize: 18, lineHeight: 26, color: colors.text, marginBottom: spacing.md },
  questionLabel: { fontSize: 20, fontWeight: '700', color: colors.text },
  progressTrack: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: radii.sm,
    overflow: 'hidden',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  navRow: { flexDirection: 'row', marginTop: spacing.md },
  error: { ...typography.body, color: colors.danger, fontWeight: '600', marginTop: spacing.md },
  whoSees: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  fieldLabel: { ...typography.bodyMuted, fontSize: 16, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
