import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { PREFER_NOT } from './questions';
import { colors, spacing, radii, typography } from '../theme/tokens';

export function ReadAloudButton({ id, text, speech, ui }) {
  if (!speech.supported) return null;
  const speaking = speech.speakingId === id;
  return (
    <Pressable
      onPress={() => (speaking ? speech.stop() : speech.speak(id, text))}
      accessibilityRole="button"
      accessibilityState={{ selected: speaking }}
      hitSlop={8}
      style={({ pressed }) => [styles.readAloud, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.readAloudText}>
        {speaking ? '■ ' : '🔊 '}
        {speaking ? ui.stopReading : ui.readAloud}
      </Text>
    </Pressable>
  );
}

function questionSpeechText(question, copy, ui) {
  const parts = [copy.label];
  if (copy.hint) parts.push(copy.hint);
  if (question.type !== 'text') {
    parts.push(question.type === 'multi' ? ui.chooseAll : ui.chooseOne);
    parts.push(...question.options.map((o) => copy.options[o]), ui.preferNot);
  }
  return parts.join('. ');
}

// One question: big tap-to-choose tiles (radio or checkbox behavior), or a
// text box. Mirrors the website's SurveyQuestion so answers are the same
// codes either way.
export default function SurveyQuestion({ question, value, onChange, strings, speech }) {
  const { ui } = strings;
  const copy = strings.q[question.id];

  if (question.type === 'text') {
    return (
      <View style={styles.question}>
        <View style={styles.head}>
          <Text style={styles.label} nativeID={`q-${question.id}`}>
            {copy.label}
          </Text>
          <ReadAloudButton id={question.id} text={copy.label} speech={speech} ui={ui} />
        </View>
        <TextInput
          value={value || ''}
          onChangeText={onChange}
          placeholder={ui.typeHere}
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          accessibilityLabelledBy={`q-${question.id}`}
          style={styles.textArea}
        />
      </View>
    );
  }

  const multi = question.type === 'multi';
  const choices = [...question.options, PREFER_NOT];
  const selected = multi ? value || [] : value;

  function isChecked(code) {
    return multi ? selected.includes(code) : selected === code;
  }

  function toggle(code) {
    if (!multi) {
      // Tapping the chosen answer again clears it - every question is optional.
      onChange(selected === code ? undefined : code);
      return;
    }
    if (selected.includes(code)) {
      const next = selected.filter((c) => c !== code);
      onChange(next.length ? next : undefined);
    } else if (code === PREFER_NOT) {
      onChange([PREFER_NOT]);
    } else {
      onChange([...selected.filter((c) => c !== PREFER_NOT), code]);
    }
  }

  return (
    <View style={styles.question} accessibilityRole={multi ? undefined : 'radiogroup'}>
      <View style={styles.head}>
        <Text style={styles.label} accessibilityRole="header">
          {copy.label}
        </Text>
        <ReadAloudButton id={question.id} text={questionSpeechText(question, copy, ui)} speech={speech} ui={ui} />
      </View>
      <Text style={styles.hint}>
        {copy.hint ? `${copy.hint} ` : ''}
        {multi ? ui.chooseAll : ui.chooseOne}
      </Text>
      {choices.map((code) => {
        const checked = isChecked(code);
        const muted = code === PREFER_NOT;
        return (
          <Pressable
            key={code}
            onPress={() => toggle(code)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked }}
            style={({ pressed }) => [
              styles.option,
              muted && styles.optionMuted,
              checked && styles.optionChecked,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[styles.mark, multi ? styles.markSquare : styles.markRound, checked && styles.markChecked]}>
              {checked && <Text style={styles.markTick}>✓</Text>}
            </View>
            <Text style={[styles.optionText, checked && styles.optionTextChecked]}>
              {muted ? ui.preferNot : copy.options[code]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  question: { marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xs },
  label: { fontSize: 20, fontWeight: '700', color: colors.text, flexShrink: 1, marginRight: spacing.sm },
  hint: { ...typography.bodyMuted, fontSize: 16, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.white,
  },
  optionMuted: { backgroundColor: colors.background },
  optionChecked: { borderColor: colors.primary, backgroundColor: colors.surface },
  optionText: { fontSize: 18, color: colors.text, flexShrink: 1 },
  optionTextChecked: { fontWeight: '700' },
  mark: {
    width: 26,
    height: 26,
    borderWidth: 2,
    borderColor: colors.secondary,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  markSquare: { borderRadius: radii.sm },
  markRound: { borderRadius: 13 },
  markChecked: { borderColor: colors.primary, backgroundColor: colors.primary },
  markTick: { color: colors.white, fontWeight: '700', fontSize: 16 },
  textArea: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.white,
    textAlignVertical: 'top',
  },
  readAloud: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  readAloudText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
