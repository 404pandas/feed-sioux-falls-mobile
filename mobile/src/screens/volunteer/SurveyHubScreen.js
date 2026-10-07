import React from 'react';
import { Text } from 'react-native';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import { spacing, typography } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import ShareSurvey from '../../survey/ShareSurvey';
import { getLanguage } from '../../survey/languages';

// The Survey tab for volunteers and admins: start a survey to hand over (or
// to type in a paper one), share it, or - for admins - see the totals.
// The survey itself opens full-screen, without the tab bar, so the person
// holding the phone only sees the survey.
export default function SurveyHubScreen({ navigation }) {
  const { user } = useAuth();
  const ui = getLanguage('en').strings.ui;

  return (
    <Screen>
      <Text style={[typography.h1, { marginBottom: spacing.xs }]}>Community Survey</Text>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.lg }]}>
        Anonymous, every question optional, English or Spanish. Answers go straight to Feed Sioux Falls - nothing is
        kept on this phone after it's sent.
      </Text>

      <Button
        title="Start a Survey"
        variant="accent"
        onPress={() => navigation.navigate('Survey')}
        style={{ marginBottom: spacing.sm }}
      />
      <Text style={[typography.bodyMuted, { marginBottom: spacing.lg }]}>
        Hand the phone over, or choose "typing in a paper survey" on the first page. Quick Exit at the top erases
        everything and comes back here.
      </Text>

      {user?.role === 'admin' && (
        <Card style={{ marginBottom: spacing.lg }}>
          <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Results</Text>
          <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
            Totals and percentages only - never anyone's own answers - plus people who asked to be contacted.
          </Text>
          <Button title="See Survey Results" variant="outline" onPress={() => navigation.navigate('SurveyResults')} />
        </Card>
      )}

      <ShareSurvey ui={ui} />
    </Screen>
  );
}
