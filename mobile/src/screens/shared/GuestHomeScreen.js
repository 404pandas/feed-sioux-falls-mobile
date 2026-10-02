import React from 'react';
import { Text } from 'react-native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import SupportForms from '../../components/SupportForms';
import { spacing, typography } from '../../theme/tokens';

export default function GuestHomeScreen({ navigation }) {
  return (
    <Screen>
      <Text style={typography.h1}>Support Feed Sioux Falls</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Every dollar goes toward hygiene and winter supplies for the pantry.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Community Survey</Text>
        <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
          Help the city see who needs what. About 3 minutes, anonymous, English or Español.
        </Text>
        <Button title="Take the Survey" variant="accent" onPress={() => navigation.navigate('Survey')} />
      </Card>

      <SupportForms />

      <Button
        title="Volunteer / Admin Login"
        variant="outline"
        onPress={() => navigation.navigate('Landing')}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}
