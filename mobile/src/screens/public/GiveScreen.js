import React from 'react';
import { View } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import PublicFooter from '../../components/PublicFooter';
import { ContactCard, DonateCard } from '../../components/SupportForms';
import { Band, PageTitle, SectionHead, EmptyNote } from '../../components/Brand';
import { NeedCard, NeedsList, usePublicSummary } from '../../components/PublicData';
import { ORG } from '../../config/org';
import { spacing, typography } from '../../theme/tokens';
import { GiveTile, open } from './parts';

// The website's Give page.
export default function GiveScreen({ navigation }) {
  const { summary, loading } = usePublicSummary();
  const needIds = new Set((summary?.needs || []).map((n) => String(n._id)));
  const fastMovers = (summary?.mostNeeded || []).filter((m) => !needIds.has(String(m._id)));

  return (
    <Screen padded={false}>
      <PageTitle
        title="Give"
        lede="Money buys supplies in bulk. Items fill the shelves. Time keeps Saturday outreach going. All of it helps."
        mascot="jar"
      />

      <Band>
        <Text style={[typography.h1, { marginBottom: spacing.lg }]} accessibilityRole="header">
          Give money
        </Text>
        <GiveTile
          title="Zeffy"
          body="Our main donation page. Quick and secure."
          button={{ title: 'Donate on Zeffy', iconRight: 'external', variant: 'accent', onPress: open(ORG.links.zeffy) }}
        />
        <GiveTile
          title="Text to give"
          big={`Text ${ORG.textToGive.keyword}\nto ${ORG.textToGive.number}`}
          button={{ title: 'Open my texts', variant: 'outline', onPress: open(`sms:${ORG.textToGive.number}?&body=${ORG.textToGive.keyword}`) }}
        />
        <GiveTile
          title="Pledge"
          body="Another easy way to give online."
          button={{ title: 'Give on Pledge', iconRight: 'external', variant: 'outline', onPress: open(ORG.links.pledge) }}
        />
        <Text style={[typography.h2, { marginTop: spacing.sm, marginBottom: spacing.sm }]}>Or give by card right here</Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          $2,800 restocks hygiene and winter supplies for a whole month. Any amount helps.
        </Text>
        <DonateCard />
      </Band>

      <Band tone="coin">
        <SectionHead
          mascot="can"
          title="Give items"
          sub={`Drop off any time at ${ORG.pantry.address}. Individually wrapped and travel-size items are easiest to hand out.`}
        />
        {!!ORG.links.amazonWishlist && (
          <Button
            title="Shop our Amazon wish list"
            iconRight="external"
            variant="coin"
            onPress={open(ORG.links.amazonWishlist)}
            style={{ alignSelf: 'flex-start', marginBottom: spacing.lg }}
          />
        )}
        <Text style={[typography.h2, { marginBottom: 12 }]}>Short on right now</Text>
        {summary && summary.needs.length > 0 && <NeedsList items={summary.needs} />}
        {summary && summary.needs.length === 0 && <EmptyNote>Nothing is running low right now. Thank you!</EmptyNote>}
        {!summary && !loading && <EmptyNote>We couldn't load the list just now. Please try again later.</EmptyNote>}

        {fastMovers.length > 0 && (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[typography.h2, { marginBottom: 12 }]}>What goes out fastest</Text>
            <Text style={[typography.body, { marginBottom: spacing.md }]}>
              These are stocked today, but they're what people ask for most.
            </Text>
            {fastMovers.map((item) => (
              <NeedCard key={item._id} item={item} />
            ))}
          </View>
        )}
      </Band>

      <Band tone="white">
        <Text style={[typography.h1, { marginBottom: spacing.md }]} accessibilityRole="header">
          Give time, or team up
        </Text>
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Join the {ORG.outreach.name} on Saturdays at {ORG.outreach.where}. Sign up through our Meetup group to hear about
          each outreach.
        </Text>
        <Button title="Join on Meetup" iconRight="external" onPress={open(ORG.links.meetup)} style={{ alignSelf: 'flex-start', marginBottom: spacing.md }} />
        <Text style={[typography.body, { marginBottom: spacing.lg }]}>
          Businesses, churches, and groups: host a drive or fundraiser, or partner with us. Send a note and we'll get back
          to you.
        </Text>
        <ContactCard defaultCategory="partner" title="Partner with us" />
      </Band>

      <PublicFooter navigation={navigation} />
    </Screen>
  );
}
