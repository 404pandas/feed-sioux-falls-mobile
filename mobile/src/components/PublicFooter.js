import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import Text from './Text';
import { ORG } from '../config/org';
import { useAuth } from '../context/AuthContext';
import { brand, spacing } from '../theme/tokens';

function FooterLink({ title, url, onPress }) {
  return (
    <Pressable onPress={onPress || (() => Linking.openURL(url))} accessibilityRole="link" hitSlop={6} style={{ paddingVertical: 6 }}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', textDecorationLine: 'underline' }}>{title}</Text>
    </Pressable>
  );
}

function Title({ children }) {
  return <Text style={{ fontFamily: 'display', fontWeight: '600', fontSize: 20, color: '#FFFFFF', marginBottom: spacing.sm }}>{children}</Text>;
}

// The website's dark footer: mission, how to find us, and ways to give,
// at the bottom of every public screen.
export default function PublicFooter({ navigation }) {
  const { user } = useAuth();
  const { links } = ORG;
  const body = { color: '#F2EFE9' };
  return (
    <View style={{ backgroundColor: brand.ink, paddingHorizontal: 20, paddingVertical: 40 }}>
      <Title>{ORG.name}</Title>
      <Text style={body}>{ORG.mission}</Text>
      <Text style={[body, { marginTop: 12 }]}>{ORG.legal}</Text>

      <View style={{ marginTop: spacing.lg }}>
        <Title>Find us</Title>
        <FooterLink title={ORG.pantry.address} url={ORG.pantry.mapUrl} />
        <Text style={body}>Pantry open 24/7</Text>
        <FooterLink title={ORG.email} url={`mailto:${ORG.email}`} />
        <FooterLink title="Facebook" url={links.facebook} />
        <FooterLink title="Meetup (volunteer outreach group)" url={links.meetup} />
        <FooterLink title="feedsiouxfalls.com" url={links.website} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Title>Give</Title>
        <FooterLink title="Donate on Zeffy" url={links.zeffy} />
        <Text style={[body, { paddingVertical: 6 }]}>
          Text <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{ORG.textToGive.keyword}</Text> to{' '}
          <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>{ORG.textToGive.number}</Text>
        </Text>
        <FooterLink title="Pledge" url={links.pledge} />
        {!!links.amazonWishlist && <FooterLink title="Amazon wish list" url={links.amazonWishlist} />}
        <FooterLink title="More ways to give" onPress={() => navigation.navigate('Give')} />
      </View>

      <View style={{ marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: '#4A433E' }}>
        <Text style={{ color: '#CFC8BF', fontSize: 16 }}>Food is a human right.</Text>
        {!user && <FooterLink title="Staff & volunteer log in" onPress={() => navigation.navigate('Login')} />}
      </View>
    </View>
  );
}
