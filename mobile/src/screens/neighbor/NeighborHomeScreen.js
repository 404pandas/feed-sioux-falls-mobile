import React from 'react';
import { Text } from 'react-native';
import Screen from '../../components/Screen';
import PantryInfo from '../../components/PantryInfo';
import SurveyInvite from '../../components/SurveyInvite';
import SupportForms from '../../components/SupportForms';
import { spacing, typography } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

export default function NeighborHomeScreen() {
  const { user } = useAuth();

  return (
    <Screen>
      <Text style={typography.h1}>Hi, {user?.name?.split(' ')[0]}</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Glad you're here. Here's what's available and how to reach us.
      </Text>

      <PantryInfo />
      <SurveyInvite />
      <SupportForms />
    </Screen>
  );
}
