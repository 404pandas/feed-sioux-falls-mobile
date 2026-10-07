import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Text from './Text';
import TextInput from './TextInput';
import Card from './Card';
import Button from './Button';
import { colors, spacing, typography, inputStyle } from '../theme/tokens';
import { api } from '../api/client';

export const CATEGORIES = [
  { value: 'contact', label: 'General' },
  { value: 'assistance', label: 'I need help' },
  { value: 'donate', label: 'Donation question' },
  { value: 'partner', label: 'Partner with us' },
  { value: 'suggestion', label: 'Suggestion' },
];

// Matches the price tiers set up in the Stripe dashboard - shown here purely
// as quick-select buttons. They don't reference those Stripe Price objects;
// tapping one just fills in the amount field, which still goes through the
// same arbitrary-amount PaymentIntent flow as a hand-typed amount.
const PRESET_AMOUNTS = [
  { value: 5, label: '$5' },
  { value: 10, label: '$10' },
  { value: 25, label: '$25' },
  { value: 50, label: '$50' },
  { value: 100, label: '$100' },
  { value: 200, label: '$200' },
  { value: 300, label: '$300' },
  { value: 2800, label: '$2,800', description: 'Restocks supplies for a full month' },
];

// Donate + contact, as separate cards like the website's SupportForms -
// the Give screen uses both, Get help and About use the contact card on
// its own (with a different starting category).
export default function SupportForms() {
  return (
    <>
      <DonateCard style={{ marginBottom: spacing.lg }} />
      <ContactCard />
    </>
  );
}

export function DonateCard({ style }) {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [amount, setAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donating, setDonating] = useState(false);

  async function handleDonate() {
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount < 1) {
      Alert.alert('Enter an amount', 'Please enter a donation amount of at least $1.');
      return;
    }

    setDonating(true);
    try {
      const { clientSecret } = await api.createPaymentIntent(parsedAmount, donorName || undefined, donorEmail || undefined);

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Feed Sioux Falls',
      });
      if (initError) throw new Error(initError.message);

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Donation not completed', presentError.message);
        }
        return;
      }

      Alert.alert('Thank you!', 'Your donation was received.');
      setAmount('');
      setDonorName('');
      setDonorEmail('');
    } catch (err) {
      Alert.alert('Could not process donation', err.message);
    } finally {
      setDonating(false);
    }
  }

  return (
    <Card style={style}>
      <Text style={[typography.h2, { marginBottom: spacing.md }]}>Make a Donation</Text>

      <Text style={styles.label}>Amount (USD)</Text>
      <View style={styles.chips}>
        {PRESET_AMOUNTS.map((preset) => (
          <Button
            key={preset.value}
            title={preset.label}
            small
            variant={amount === String(preset.value) ? 'primary' : 'outline'}
            onPress={() => setAmount(String(preset.value))}
            style={styles.chip}
          />
        ))}
      </View>
      {amount === String(PRESET_AMOUNTS[PRESET_AMOUNTS.length - 1].value) && (
        <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
          {PRESET_AMOUNTS[PRESET_AMOUNTS.length - 1].description}
        </Text>
      )}
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="Or enter a custom amount"
        style={styles.input}
        accessibilityLabel="Donation amount in dollars"
      />

      <Text style={styles.label}>Your name (optional)</Text>
      <TextInput value={donorName} onChangeText={setDonorName} style={styles.input} placeholder="Jane Doe" />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        value={donorEmail}
        onChangeText={setDonorEmail}
        style={styles.input}
        placeholder="jane@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Button title="Donate" icon="heart" variant="accent" onPress={handleDonate} loading={donating} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

export function ContactCard({ defaultCategory = 'contact', title, style }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState(defaultCategory);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!message.trim()) {
      setError('Please include a message before sending.');
      return;
    }
    setError('');
    setSending(true);
    try {
      await api.submitContact({
        name: name || undefined,
        phone: phone || undefined,
        email: email || undefined,
        message,
        category,
      });
      setSent(true);
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
      setCategory(defaultCategory);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card style={style}>
      <Text style={[typography.h2, { marginBottom: spacing.md }]}>{title || 'Contact Us'}</Text>

      {sent && (
        <Text style={[typography.body, { color: colors.success, marginBottom: spacing.sm }]} accessibilityLiveRegion="polite">
          Message sent - thanks for reaching out, someone will follow up soon.
        </Text>
      )}

      <Text style={styles.label}>What's this about?</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Button
            key={c.value}
            title={c.label}
            small
            variant={category === c.value ? 'primary' : 'outline'}
            onPress={() => setCategory(c.value)}
            style={styles.chip}
          />
        ))}
      </View>

      <Text style={styles.label}>Name (optional)</Text>
      <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" />

      <Text style={styles.label}>Phone (optional)</Text>
      <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="(605) 555-0100" keyboardType="phone-pad" />

      <Text style={styles.label}>Email (optional)</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.label}>Message</Text>
      <TextInput
        value={message}
        onChangeText={setMessage}
        style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
        placeholder="How can we help?"
        multiline
      />

      {!!error && <Text style={[typography.body, { color: colors.danger, marginTop: spacing.sm }]}>{error}</Text>}

      <Button title="Send Message" onPress={handleSubmit} loading={sending} style={{ marginTop: spacing.md }} />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  chip: { marginRight: spacing.xs, marginBottom: spacing.xs },
  input: inputStyle,
});
