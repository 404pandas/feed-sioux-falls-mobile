import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../components/Text';
import TextInput from '../components/TextInput';
import Card from '../components/Card';
import Button from '../components/Button';
import { colors, spacing, radii, typography, inputStyle } from '../theme/tokens';
import { api } from '../api/client';
import en from './strings/en';

// Shown instead of the survey when someone picks a language we don't have
// a translation for yet - same as the website. Offers English or Spanish,
// and lets anyone who can help translate leave a note; it goes to the
// admin Messages inbox as a "partner" message, not into survey results.
export default function TranslationPlaceholder({ language, onChooseLanguage }) {
  const copy = en.placeholder;
  const [name, setName] = useState('');
  const [reach, setReach] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const contact = reach.trim();
    if (!contact) {
      setError(copy.helpNeedContact);
      return;
    }
    setError('');
    setSending(true);
    try {
      const isEmail = contact.includes('@');
      await api.submitContact({
        name: name.trim() || undefined,
        email: isEmail ? contact : undefined,
        phone: isEmail ? undefined : contact,
        message: copy.helpMessage(language.englishName),
        category: 'partner',
      });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <View>
      <Text style={styles.languageName}>{language.nativeName}</Text>
      <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
        {copy.title}
      </Text>
      {copy.body.map((p) => (
        <Text key={p} style={styles.body}>
          {p}
        </Text>
      ))}

      <Button title={copy.useEnglish} onPress={() => onChooseLanguage('en')} style={{ marginBottom: spacing.sm }} />
      <Button title={copy.useSpanish} variant="outline" onPress={() => onChooseLanguage('es')} style={{ marginBottom: spacing.lg }} />

      <Card>
        <Text style={[typography.h2, { marginBottom: spacing.sm }]}>{copy.helpTitle}</Text>
        {sent ? (
          <Text style={styles.body} accessibilityLiveRegion="polite">
            {copy.helpSent}
          </Text>
        ) : (
          <>
            <Text style={styles.label}>{copy.helpName}</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} autoComplete="name" />
            <Text style={styles.label}>{copy.helpContact}</Text>
            <TextInput value={reach} onChangeText={setReach} style={styles.input} autoCapitalize="none" autoCorrect={false} />
            {!!error && <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text>}
            <Button title={copy.helpSend} onPress={send} loading={sending} style={{ marginTop: spacing.md }} />
          </>
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  languageName: { fontSize: 32, fontWeight: '700', color: colors.primary, marginBottom: spacing.xs },
  body: { fontSize: 18, lineHeight: 26, color: colors.text, marginBottom: spacing.md },
  label: { ...typography.bodyMuted, fontSize: 16, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: inputStyle,
});
