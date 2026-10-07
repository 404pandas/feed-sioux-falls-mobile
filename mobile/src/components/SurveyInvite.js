import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Card from './Card';
import Button from './Button';
import { spacing, typography } from '../theme/tokens';

// Points guests and neighbors to the community survey. Same card as the
// website's SurveyInvite.
export default function SurveyInvite() {
  const navigation = useNavigation();
  return (
    <Card style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.h2, { marginBottom: spacing.xs }]}>Sioux Falls Community Survey</Text>
      <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
        Help City Council understand what people in our city need. About 3 minutes, every question optional, no name
        needed. También en español.
      </Text>
      <Button title="Take the survey" variant="accent" onPress={() => navigation.navigate('Survey')} />
    </Card>
  );
}
