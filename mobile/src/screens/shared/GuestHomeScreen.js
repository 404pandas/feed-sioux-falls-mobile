import React from 'react';
import { Text } from 'react-native';
import Screen from '../../components/Screen';
import BackLink from '../../components/BackLink';
import PantryInfo from '../../components/PantryInfo';
import SurveyInvite from '../../components/SurveyInvite';
import SupportForms from '../../components/SupportForms';
import { spacing, typography } from '../../theme/tokens';

// Same layout as the website's guest page: where to get food first, then
// the survey, then donate/contact. "Log In" is in the header (App.js).
export default function GuestHomeScreen({ navigation }) {
  return (
    <Screen>
      <BackLink label="Home" onPress={() => navigation.navigate('Landing')} />
      <Text style={typography.h1}>Feed Sioux Falls</Text>
      <Text style={[typography.bodyMuted, { marginTop: spacing.xs, marginBottom: spacing.lg }]}>
        Get food and supplies, reach out, or help out. Every dollar goes toward hygiene and winter supplies for the pantry.
      </Text>

      <PantryInfo />
      <SurveyInvite />
      <SupportForms />
    </Screen>
  );
}
