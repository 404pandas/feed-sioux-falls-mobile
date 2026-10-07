import React from 'react';
import { View, RefreshControl } from 'react-native';
import Text from '../../components/Text';
import Screen from '../../components/Screen';
import Button from '../../components/Button';
import PublicFooter from '../../components/PublicFooter';
import { Band, HandsArt, Mark, SectionHead, EmptyNote, TextLink } from '../../components/Brand';
import { NeedsList, formatNumber, formatOutreachDate, usePublicSummary } from '../../components/PublicData';
import { ORG } from '../../config/org';
import { brand, spacing, typography } from '../../theme/tokens';
import { InfoCard, GiveTile, open } from './parts';

// The website's home page (src/pages/public/HomePage.jsx), section for
// section: hero with the raised hands, live totals, where to get help,
// what we're short on, the survey, and ways to help.
export default function HomeScreen({ navigation }) {
  const { summary, loading, reload } = usePublicSummary();

  return (
    <Screen padded={false} refreshControl={<RefreshControl refreshing={false} onRefresh={reload} />}>
      <View style={{ backgroundColor: brand.tealSoft, borderBottomWidth: 2, borderBottomColor: brand.ink, paddingTop: 32, paddingHorizontal: 20 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: 'display', fontWeight: '600', fontSize: 46, lineHeight: 48, marginBottom: spacing.lg }}
        >
          Food is a human right.
        </Text>
        <Text style={[typography.body, { fontSize: 20, lineHeight: 30, marginBottom: spacing.lg }]}>
          Feed Sioux Falls is a neighbor-run pantry that never closes, plus a Saturday street outreach team. Take what you
          need. Give what you can.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
          <Button title="Get help today" onPress={() => navigation.navigate('Help')} style={{ marginRight: spacing.md, marginBottom: spacing.sm }} />
          <Button title="Donate" icon="heart" variant="accent" onPress={() => navigation.navigate('Give')} style={{ marginBottom: spacing.sm }} />
        </View>
        <HandsArt style={{ marginBottom: -4 }} />
      </View>

      <Band tone="white">
        {summary ? (
          <>
            <Text style={{ fontFamily: 'display', fontSize: 28, lineHeight: 38 }}>
              So far, neighbors helping neighbors have served <Mark>{formatNumber(summary.peopleServed.allTime)} people</Mark>{' '}
              and handed out <Mark>{formatNumber(summary.itemsGiven.allTime)} items</Mark> across{' '}
              <Mark>{formatNumber(summary.outreachEvents)} outreach days</Mark>.
            </Text>
            <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
              Counted live by our volunteers, one person at a time.
              {summary.peopleServed.thisYear > 0 && ` ${formatNumber(summary.peopleServed.thisYear)} this year`}
              {summary.peopleServed.thisMonth > 0 && `, ${formatNumber(summary.peopleServed.thisMonth)} this month`}
              {summary.peopleServed.thisYear > 0 && '.'}
            </Text>
          </>
        ) : (
          <Text style={{ fontFamily: 'display', fontSize: 26, lineHeight: 36 }}>{loading ? ' ' : ORG.mission}</Text>
        )}
      </Band>

      <Band>
        <SectionHead mascot="shirt" title="Need something today?" sub="No sign-up, no questions, no paperwork." />
        <InfoCard
          pill={{ tone: 'ok', icon: 'clock', label: 'Open now' }}
          bigLine="The pantry is open 24/7"
          lines={[ORG.pantry.address]}
          muted={`Shelves, a fridge, and a freezer. ${ORG.pantry.host}.`}
        >
          <Button title="Directions" icon="pin" variant="outline" onPress={open(ORG.pantry.mapUrl)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </InfoCard>
        <InfoCard
          pill={{ tone: 'low', icon: 'calendar', label: 'Every Saturday' }}
          bigLine={`Outreach, ${ORG.outreach.when}`}
          lines={[ORG.outreach.where]}
          muted={`Our ${ORG.outreach.name} brings food, hygiene supplies, and winter gear.${
            summary?.nextOutreach ? ` Next one: ${formatOutreachDate(summary.nextOutreach.date)}.` : ''
          }`}
        >
          <Button title="Directions" icon="pin" variant="outline" onPress={open(ORG.outreach.mapUrl)} style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </InfoCard>
        <TextLink title="More help, and how to reach us" onPress={() => navigation.navigate('Help')} />
      </Band>

      <Band tone="coin">
        <SectionHead mascot="can" title="What we're short on" sub="Straight from our inventory, updated as volunteers hand things out." />
        {summary && summary.needs.length > 0 && <NeedsList items={summary.needs} limit={6} />}
        {summary && summary.needs.length === 0 && (
          <EmptyNote>We're stocked up right now. Thank you! Money donations help keep it that way.</EmptyNote>
        )}
        {!summary && !loading && (
          <EmptyNote>We couldn't load the list just now. Hygiene items, socks, and winter gear are always welcome.</EmptyNote>
        )}
        <View style={{ marginTop: spacing.md }}>
          <Button title="See everything we need" variant="outline" onPress={() => navigation.navigate('Give')} style={{ alignSelf: 'flex-start', marginBottom: spacing.sm }} />
          {!!ORG.links.amazonWishlist && (
            <Button title="Our Amazon wish list" iconRight="external" variant="coin" onPress={open(ORG.links.amazonWishlist)} style={{ alignSelf: 'flex-start' }} />
          )}
        </View>
      </Band>

      <Band tone="white">
        <SectionHead mascot="bear" title="Help the city count everyone" />
        <Text style={[typography.body, { marginBottom: spacing.md }]}>
          Sioux Falls counts people without homes on just one day a year, and misses too many. Our anonymous survey gives
          City Council a truer picture of who needs what. It takes about 3 minutes, every question is optional, and no
          name is needed. También en español.
        </Text>
        {summary?.surveysCollected > 0 && (
          <Text style={[typography.bodyMuted, { marginBottom: spacing.md }]}>
            {formatNumber(summary.surveysCollected)} neighbors have filled it out so far.
          </Text>
        )}
        <Button title="Take the survey" onPress={() => navigation.navigate('Survey')} style={{ alignSelf: 'flex-start' }} />
      </Band>

      <Band>
        <SectionHead mascot="jar" title="Ways to help" />
        <GiveTile
          title="Give online"
          body="Donate on Zeffy. It takes a minute, and it goes straight to supplies."
          button={{ title: 'Donate on Zeffy', iconRight: 'external', variant: 'accent', onPress: open(ORG.links.zeffy) }}
        />
        <GiveTile
          title="Give by text"
          big={`Text ${ORG.textToGive.keyword}\nto ${ORG.textToGive.number}`}
          button={{ title: 'Open my texts', variant: 'outline', onPress: open(`sms:${ORG.textToGive.number}?&body=${ORG.textToGive.keyword}`) }}
        />
        <GiveTile
          title="Give your time"
          body="Join the Saturday outreach crew. Meet up, hand out, make friends."
          button={{ title: 'Join on Meetup', iconRight: 'external', variant: 'outline', onPress: open(ORG.links.meetup) }}
        />
      </Band>

      <PublicFooter navigation={navigation} />
    </Screen>
  );
}
