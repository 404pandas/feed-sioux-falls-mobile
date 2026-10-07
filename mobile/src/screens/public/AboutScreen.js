import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Icon from '../../components/Icon';
import Lift from '../../components/Lift';
import PublicFooter from '../../components/PublicFooter';
import { ContactCard } from '../../components/SupportForms';
import { Band, PageTitle, HandsArt, Mark } from '../../components/Brand';
import { formatNumber, usePublicSummary } from '../../components/PublicData';
import { ORG } from '../../config/org';
import { brand, liftSmall, radii, spacing, typography } from '../../theme/tokens';
import { open } from './parts';

function LinkChip({ title, url }) {
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="link" style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}>
      {({ pressed }) => (
        <Lift
          offset={liftSmall}
          radius={radii.pill}
          pressed={pressed}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 40, paddingHorizontal: 14, borderWidth: 2, borderColor: brand.ink, borderRadius: radii.pill, backgroundColor: brand.paper }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700' }}>{title}</Text>
          <Icon name="external" size={16} style={{ marginLeft: 6 }} />
        </Lift>
      )}
    </Pressable>
  );
}

// The website's About us page.
export default function AboutScreen({ navigation }) {
  const { summary } = usePublicSummary();

  return (
    <Screen padded={false}>
      <PageTitle title="About us" lede={ORG.mission} mascot="heart" />

      <Band>
        <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
          What we do
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Feed Sioux Falls is a {ORG.legal}. We keep a pantry open around the clock at {ORG.pantry.address}, stocked with
          food, hygiene supplies, and freezer meals, so anyone can take what they need, any time.
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Every Saturday our {ORG.outreach.name} heads to {ORG.outreach.where} with food, hygiene kits, clothing, and winter
          gear for neighbors living outside.
        </Text>
        {summary && summary.peopleServed.allTime > 0 && (
          <Text style={[typography.body, { marginBottom: spacing.md }]}>
            Our volunteers count every person they serve. So far that's <Mark>{formatNumber(summary.peopleServed.allTime)} people</Mark>.
          </Text>
        )}
        <Card style={{ padding: 0, overflow: 'hidden', backgroundColor: brand.tealSoft }}>
          <HandsArt inset={44} style={{ marginTop: spacing.lg }} />
        </Card>
      </Band>

      <Band tone="white">
        <Text style={[typography.h1, { marginBottom: spacing.lg }]} accessibilityRole="header">
          Who we are
        </Text>
        {ORG.team.map((p) => (
          <Card key={p.name} style={{ padding: 20, marginBottom: spacing.lg }}>
            <Text style={typography.h2}>{p.name}</Text>
            <Text style={{ color: brand.bear, fontWeight: '700', marginBottom: spacing.sm }}>{p.role}</Text>
            <Text style={typography.body}>{p.bio}</Text>
          </Card>
        ))}
      </Band>

      <Band>
        <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
          Get in touch
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Email{' '}
          <Text style={{ color: brand.teal, fontWeight: '700', textDecorationLine: 'underline' }} onPress={open(`mailto:${ORG.email}`)}>
            {ORG.email}
          </Text>
          , or send a message here.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
          <LinkChip title="Facebook" url={ORG.links.facebook} />
          <LinkChip title="Meetup" url={ORG.links.meetup} />
          <LinkChip title="News" url={ORG.links.news} />
          <LinkChip title="feedsiouxfalls.com" url={ORG.links.website} />
        </View>
        <Button title="Ways to give" icon="heart" variant="accent" onPress={() => navigation.navigate('Give')} style={{ alignSelf: 'flex-start', marginBottom: spacing.lg }} />
        <ContactCard />
      </Band>

      <PublicFooter navigation={navigation} />
    </Screen>
  );
}
