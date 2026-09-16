import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import Card from './Card';
import Button from './Button';
import { colors, spacing, typography, radii } from '../theme/tokens';
import { api } from '../api/client';

const CATEGORIES = [
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

// The donate + contact forms, shared by GuestHomeScreen (public, no login)
// and NeighborHomeScreen (logged-in neighbors) - both hit the same public
// API routes regardless of who's viewing them.
export default function SupportForms() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const [amount, setAmount] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [donating, setDonating] = useState(false);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('contact');
  const [sending, setSending] = useState(false);

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

  async function handleContactSubmit() {
    if (!message.trim()) {
      Alert.alert('Message required', 'Please include a message before sending.');
      return;
    }

    setSending(true);
    try {
      await api.submitContact({
        name: name || undefined,
        phone: phone || undefined,
        email: email || undefined,
        message,
        category,
      });
      Alert.alert('Message sent', 'Thanks for reaching out - someone will follow up soon.');
      setName('');
      setPhone('');
      setEmail('');
      setMessage('');
      setCategory('contact');
    } catch (err) {
      Alert.alert('Could not send message', err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.md }]}>Make a Donation</Text>

        <Text style={styles.label}>Amount (USD)</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          {PRESET_AMOUNTS.map((preset) => (
            <Button
              key={preset.value}
              title={preset.label}
              variant={amount === String(preset.value) ? 'primary' : 'outline'}
              onPress={() => setAmount(String(preset.value))}
              style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
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

        <Button title="Donate" variant="accent" onPress={handleDonate} loading={donating} style={{ marginTop: spacing.md }} />
      </Card>

      <Card>
        <Text style={[typography.h2, { marginBottom: spacing.md }]}>Contact Us</Text>

        <Text style={styles.label}>What's this about?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <Button
              key={c.value}
              title={c.label}
              variant={category === c.value ? 'primary' : 'outline'}
              onPress={() => setCategory(c.value)}
              style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
            />
          ))}
        </View>

        <Text style={styles.label}>Name (optional)</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Your name" />

        <Text style={styles.label}>Phone (optional)</Text>
        <TextInput value={phone} onChangeText={setPhone} style={styles.input} placeholder="(605) 555-0100" keyboardType="phone-pad" />

        <Text style={styles.label}>Email (optional)</Text>
        <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

        <Text style={styles.label}>Message</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
          placeholder="How can we help?"
          multiline
        />

        <Button title="Send Message" onPress={handleContactSubmit} loading={sending} style={{ marginTop: spacing.md }} />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...typography.bodyMuted, marginBottom: spacing.xs, marginTop: spacing.sm },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
