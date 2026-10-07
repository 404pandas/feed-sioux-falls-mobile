import React from 'react';
import { View, Linking } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import PublicFooter from '../../components/PublicFooter';
import { ContactCard } from '../../components/SupportForms';
import { Band, PageTitle, TextLink } from '../../components/Brand';
import { formatOutreachDate, usePublicSummary } from '../../components/PublicData';
import { ORG } from '../../config/org';
import { brand, spacing, typography } from '../../theme/tokens';
import { InfoCard, Bullets, open } from './parts';

// The website's Get help page.
export default function GetHelpScreen({ navigation }) {
  const { summary } = usePublicSummary();

  return (
    <Screen padded={false}>
      <PageTitle
        title="Get help"
        lede="Food, hygiene supplies, and winter gear, free. No sign-up and no questions asked."
        mascot="shirt"
      />

      <Band>
        <InfoCard title="The 24/7 pantry" bigLine={ORG.pantry.hours} lines={[ORG.pantry.address]}>
          <Bullets
            items={[
              'Take what you need from the shelves, fridge, and freezer.',
              'The fridge and freezer have a child lock because the city requires it. Anyone can open it.',
              `${ORG.pantry.host}.`,
            ]}
          />
          <Button title="Get directions" icon="pin" onPress={open(ORG.pantry.mapUrl)} style={{ alignSelf: 'flex-start', marginTop: spacing.sm }} />
        </InfoCard>

        <InfoCard title="Saturday outreach" bigLine={ORG.outreach.when} lines={[ORG.outreach.where]}>
          <Bullets
            items={[
              `Our ${ORG.outreach.name} hands out food, hygiene kits, socks, gloves, and more.`,
              summary?.nextOutreach && `Next one: ${formatOutreachDate(summary.nextOutreach.date)}.`,
              'Plans change in bad weather. Check our Facebook page for updates.',
            ]}
          />
          <Button title="Get directions" icon="pin" onPress={open(ORG.outreach.mapUrl)} style={{ alignSelf: 'flex-start', marginTop: spacing.sm, marginBottom: spacing.sm }} />
          <Button title="Facebook updates" iconRight="external" variant="outline" onPress={open(ORG.links.facebook)} style={{ alignSelf: 'flex-start' }} />
        </InfoCard>
      </Band>

      <Band tone="white">
        <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
          Need something we don't have out?
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Send us a note. Only your message is required. Leave a phone number or email if you'd like an answer.
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Or email us at{' '}
          <Text style={{ color: brand.teal, fontWeight: '700', textDecorationLine: 'underline' }} onPress={open(`mailto:${ORG.email}`)}>
            {ORG.email}
          </Text>
          .
        </Text>
        <Card style={{ backgroundColor: brand.coinSoft, marginBottom: spacing.lg }}>
          <Text style={[typography.h2, { marginBottom: 6 }]}>Other help, any time</Text>
          <Text style={typography.body}>
            Call or text <Text style={{ fontWeight: '700' }}>211</Text> to reach the Helpline Center, which connects people
            across South Dakota to shelter, food, rent help, and more.
          </Text>
          <Button title="Call 211" icon="phone" variant="outline" small onPress={() => Linking.openURL('tel:211')} style={{ alignSelf: 'flex-start', marginTop: spacing.md }} />
        </Card>
        <ContactCard defaultCategory="assistance" title="Ask for help" />
      </Band>

      <Band>
        <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
          Tell the city what you need
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Our anonymous survey helps City Council see who needs help and which services aren't working. About 3 minutes.
          Skip anything you want. También en español.
        </Text>
        <View>
          <Button title="Take the survey" onPress={() => navigation.navigate('Survey')} style={{ alignSelf: 'flex-start' }} />
        </View>
      </Band>

      <PublicFooter navigation={navigation} />
    </Screen>
  );
}
