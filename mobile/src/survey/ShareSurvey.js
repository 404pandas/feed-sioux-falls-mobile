import React, { useState } from 'react';
import { View, Share, StyleSheet } from 'react-native';
import Text from '../components/Text';
import Constants from 'expo-constants';
import QRCode from 'react-native-qrcode-svg';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, typography } from '../theme/tokens';
import { websiteUrl } from '../config/org';

// The survey's web address: the website's /survey page. SURVEY_URL in
// app.config.js overrides it (e.g. for a custom domain later).
export function surveyUrl() {
  return Constants.expoConfig?.extra?.surveyUrl || `${websiteUrl}/survey`;
}

// "Know someone who should fill this out?" - the phone's own share sheet
// (texting, Facebook, Messenger, email... whatever is installed) plus a QR
// code someone next to you can scan to take it on their own phone. The QR
// code is drawn on the phone; no outside service is used.
export default function ShareSurvey({ ui }) {
  const url = surveyUrl();
  const [showQr, setShowQr] = useState(false);

  if (!url) {
    return <Text style={typography.bodyMuted}>{ui.shareUnavailable}</Text>;
  }

  async function share() {
    try {
      await Share.share({ title: ui.shareEmailSubject, message: `${ui.shareMessage} ${url}` });
    } catch {
      // They closed the share sheet - nothing to do.
    }
  }

  return (
    <Card>
      <Text style={[typography.h2, { marginBottom: spacing.sm }]}>{ui.shareTitle}</Text>
      <Button title={ui.shareButton} variant="accent" onPress={share} style={{ marginBottom: spacing.sm }} />
      <Button title={showQr ? ui.hideQr : ui.showQr} variant="outline" onPress={() => setShowQr((v) => !v)} />
      {showQr && (
        <View style={styles.qrWrap}>
          <Text style={[typography.body, { textAlign: 'center', marginBottom: spacing.md }]}>{ui.qrTitle}</Text>
          <View style={styles.qrBox}>
            <QRCode value={url} size={240} color={colors.text} backgroundColor={colors.white} ecl="M" />
          </View>
          <Text style={[typography.bodyMuted, { textAlign: 'center', marginTop: spacing.sm }]}>{ui.qrHint}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  qrWrap: { marginTop: spacing.md, alignItems: 'center' },
  qrBox: { padding: spacing.md, backgroundColor: colors.white, borderRadius: 8 },
});
