import React from 'react';
import { Text } from 'react-native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import SupportForms from '../../components/SupportForms';
import { spacing, typography } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

export default function NeighborHomeScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <Screen>
      <Text style={typography.h1}>Hi, {user?.name?.split(' ')[0]}</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Glad you're here. Here's what's available and how to reach us.
      </Text>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Pantry Hours & Location</Text>
        <Text style={typography.body}>2809 S Spring Ave, Sioux Falls, SD 57105</Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Open 24/7 - shelves, fridge, and freezer available. Fridge/freezer use a child lock
          (required by city ordinance) that's freely available to open.
        </Text>
        <Text style={[typography.bodyMuted, { marginTop: spacing.xs }]}>
          Located on the side of Vital Animal Veterinary Clinic - not affiliated with the
          veterinary business.
        </Text>

        <Text style={[typography.h2, { marginTop: spacing.md, marginBottom: spacing.sm }]}>Weekly Outreach</Text>
        <Text style={typography.body}>Saturdays, 10-11am CST</Text>
        <Text style={typography.bodyMuted}>Heritage Park, Weber Ave, Sioux Falls, SD</Text>
      </Card>

      <Card style={{ marginBottom: spacing.lg }}>
        <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Community Survey</Text>
        <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
          Help the city see who needs what. About 3 minutes, anonymous, English or Español.
        </Text>
        <Button title="Take the Survey" variant="accent" onPress={() => navigation.navigate('Survey')} />
      </Card>

      <SupportForms />
    </Screen>
  );
}
