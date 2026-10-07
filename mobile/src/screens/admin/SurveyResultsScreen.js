import React, { useCallback, useState } from 'react';
import { View, Text, Alert, RefreshControl, Linking, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, radii, typography } from '../../theme/tokens';
import { api } from '../../api/client';
import { SECTIONS, PREFER_NOT } from '../../survey/questions';
import { getLanguage } from '../../survey/languages';

const strings = getLanguage('en').strings;

const RANGES = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 3 Months' },
];

function rangeParams(key) {
  const now = new Date();
  if (key === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
  if (key === 'quarter') return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(), end: now.toISOString() };
  return {};
}

const SOURCE_LABELS = { self: 'On their own', volunteer: 'With a volunteer', paper: 'Paper, typed in' };

// Admin view of the community survey: totals and per-answer counts only
// (the backend never sends individual responses), plus the people who
// asked to be contacted. Same data as the website's results page.
export default function SurveyResultsScreen() {
  const [range, setRange] = useState('all');
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openQuestion, setOpenQuestion] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([api.getSurveySummary(rangeParams(range)), api.getSurveyContactRequests()]);
      setSummary(s);
      setRequests(r);
    } catch (err) {
      Alert.alert('Could not load survey results', err.message);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function resolve(request) {
    try {
      await api.resolveSurveyContactRequest(request._id);
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
    } catch (err) {
      Alert.alert('Could not update', err.message);
    }
  }

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md }}>
        {RANGES.map((r) => (
          <Button
            key={r.key}
            title={r.label}
            variant={range === r.key ? 'primary' : 'outline'}
            onPress={() => setRange(r.key)}
            style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
          />
        ))}
      </View>

      {requests.length > 0 && (
        <Card style={{ marginBottom: spacing.lg, borderColor: colors.accent }}>
          <Text style={[typography.h2, { marginBottom: spacing.sm }]}>
            {requests.length} {requests.length === 1 ? 'person wants' : 'people want'} to be contacted
          </Text>
          {requests.map((r) => (
            <View key={r._id} style={{ paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={typography.body}>{r.name || 'No name given'}</Text>
              {!!r.phone && (
                <Text style={[typography.body, { color: colors.primary }]} onPress={() => Linking.openURL(`tel:${r.phone}`)}>
                  {r.phone}
                </Text>
              )}
              {!!r.email && (
                <Text style={[typography.body, { color: colors.primary }]} onPress={() => Linking.openURL(`mailto:${r.email}`)}>
                  {r.email}
                </Text>
              )}
              {!!r.bestTime && <Text style={typography.bodyMuted}>Best time: {r.bestTime}</Text>}
              {r.safeToLeaveMessage === false && (
                <Text style={{ color: colors.danger, fontWeight: '700' }}>Do NOT leave a message</Text>
              )}
              {r.language === 'es' && <Text style={typography.bodyMuted}>Prefers Spanish</Text>}
              <Button title="Mark Contacted" variant="outline" onPress={() => resolve(r)} style={{ marginTop: spacing.sm, minHeight: 40 }} />
            </View>
          ))}
        </Card>
      )}

      {summary && (
        <>
          <Card style={{ marginBottom: spacing.lg }}>
            <Text style={typography.bodyMuted}>Surveys received</Text>
            <Text style={[typography.tallyNumber, { fontSize: 48 }]}>{summary.total}</Text>
            {Object.entries(summary.bySource)
              .filter(([, n]) => n > 0)
              .map(([key, n]) => (
                <Text key={key} style={typography.bodyMuted}>
                  {SOURCE_LABELS[key] || key}: {n}
                </Text>
              ))}
            {Object.entries(summary.byLanguage).map(([code, n]) => (
              <Text key={code} style={typography.bodyMuted}>
                In {getLanguage(code).code === code ? getLanguage(code).nativeName : code}: {n}
              </Text>
            ))}
          </Card>

          {summary.byMonth.length > 1 && (
            <Card style={{ marginBottom: spacing.lg }}>
              <Text style={[typography.h2, { marginBottom: spacing.sm }]}>By Month</Text>
              {summary.byMonth.map((m) => (
                <Bar key={m.month} label={m.month} value={m.count} max={Math.max(...summary.byMonth.map((x) => x.count))} />
              ))}
            </Card>
          )}

          {summary.total === 0 && <Text style={typography.bodyMuted}>No surveys in this time range yet.</Text>}

          {summary.total > 0 &&
            SECTIONS.flatMap((s) => s.questions)
              .filter((q) => q.type !== 'text' && summary.questions[q.id])
              .map((q) => {
                const result = summary.questions[q.id];
                const copy = strings.q[q.id];
                const open = openQuestion === q.id;
                const rows = [...q.options, PREFER_NOT]
                  .map((code) => ({ code, count: result.counts[code] || 0 }))
                  .filter((row) => row.count > 0)
                  .sort((a, b) => b.count - a.count);
                const max = rows[0]?.count || 1;
                return (
                  <Card key={q.id} style={{ marginBottom: spacing.sm }}>
                    <Pressable
                      onPress={() => setOpenQuestion(open ? null : q.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                    >
                      <Text style={typography.h2}>{copy.label}</Text>
                      <Text style={typography.bodyMuted}>
                        {result.answered} answered · {open ? 'tap to close' : 'tap to see answers'}
                      </Text>
                    </Pressable>
                    {open &&
                      rows.map((row) => (
                        <Bar
                          key={row.code}
                          label={row.code === PREFER_NOT ? strings.ui.preferNot : copy.options[row.code]}
                          value={row.count}
                          max={max}
                          suffix={result.answered ? ` (${Math.round((row.count / result.answered) * 100)}%)` : ''}
                        />
                      ))}
                  </Card>
                );
              })}

          <Text style={[typography.bodyMuted, { marginTop: spacing.md }]}>
            "Choose all that apply" questions can add up to more than 100%. Written answers are on the website's
            results page so they can be read and checked for personal details before anything is shared.
          </Text>
        </>
      )}
    </Screen>
  );
}

function Bar({ label, value, max, suffix = '' }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ marginTop: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[typography.body, { flexShrink: 1, marginRight: spacing.sm }]}>{label}</Text>
        <Text style={typography.bodyMuted}>
          {value}
          {suffix}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radii.sm, marginTop: spacing.xs, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}
