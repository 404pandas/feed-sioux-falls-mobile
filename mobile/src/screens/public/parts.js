import React from 'react';
import { View, Linking } from 'react-native';
import Text from '../../components/Text';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { Pill } from '../../components/Brand';
import { spacing, typography } from '../../theme/tokens';

export const open = (url) => () => Linking.openURL(url);

// The website's .info-card: optional pill, a big line, details, buttons.
export function InfoCard({ pill, title, bigLine, lines = [], muted, children, style }) {
  return (
    <Card style={[{ padding: 20, marginBottom: spacing.lg }, style]}>
      {pill && <Pill {...pill} style={{ marginBottom: spacing.sm }} />}
      {!!title && <Text style={[typography.h2, { marginBottom: spacing.xs }]}>{title}</Text>}
      {!!bigLine && (
        <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 26, lineHeight: 31, marginBottom: spacing.sm }}>{bigLine}</Text>
      )}
      {lines.map((l) => (
        <Text key={l} style={[typography.body, { marginBottom: spacing.xs }]}>
          {l}
        </Text>
      ))}
      {!!muted && <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>{muted}</Text>}
      {children}
    </Card>
  );
}

// Bulleted list (the website's <ul> inside info cards).
export function Bullets({ items }) {
  return (
    <View style={{ marginVertical: spacing.xs }}>
      {items.filter(Boolean).map((t) => (
        <View key={t} style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={[typography.body, { width: 20 }]}>•</Text>
          <Text style={[typography.body, { flex: 1 }]}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

// Give tiles: Zeffy / text to give / Pledge / Meetup.
export function GiveTile({ title, body, big, button }) {
  return (
    <Card style={{ padding: 20, marginBottom: spacing.lg }}>
      <Text style={[typography.h2, { marginBottom: spacing.xs }]}>{title}</Text>
      {!!body && <Text style={[typography.body, { marginBottom: spacing.md }]}>{body}</Text>}
      {!!big && (
        <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 30, lineHeight: 35, marginBottom: spacing.md }}>{big}</Text>
      )}
      <Button {...button} />
    </Card>
  );
}
