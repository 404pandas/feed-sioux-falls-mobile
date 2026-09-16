import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, Dimensions, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import ViewShot from 'react-native-view-shot';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { colors, spacing, typography, radii } from '../../theme/tokens';
import { api } from '../../api/client';

const CHART_WIDTH = Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2;

function hexToRgbTuple(hex) {
  const parts = hex.replace('#', '').match(/.{2}/g);
  return parts.map((p) => parseInt(p, 16));
}

const [PR, PG, PB] = hexToRgbTuple(colors.primary);
const [TR, TG, TB] = hexToRgbTuple(colors.text);

const chartConfig = {
  backgroundColor: colors.surface,
  backgroundGradientFrom: colors.surface,
  backgroundGradientTo: colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(${PR}, ${PG}, ${PB}, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(${TR}, ${TG}, ${TB}, ${opacity})`,
  propsForBackgroundLines: { stroke: colors.border },
  barPercentage: 0.6,
};

const DATE_PRESETS = [
  { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'Last 3 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const SECTIONS = [
  { key: 'peopleServed', label: 'People Served Over Time' },
  { key: 'eventsHeld', label: 'Distribution Events Over Time' },
  { key: 'spending', label: 'Money Spent Over Time' },
  { key: 'donations', label: 'Donations Over Time' },
  { key: 'spendByCategory', label: 'Spending by Category' },
  { key: 'topItems', label: 'Most Distributed Items' },
  { key: 'inventory', label: 'Current Inventory Snapshot' },
];

function presetRange(key) {
  const now = new Date();
  if (key === 'month') {
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, groupBy: 'week' };
  }
  if (key === 'quarter') {
    return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: now, groupBy: 'month' };
  }
  if (key === 'year') {
    return { start: new Date(now.getFullYear(), 0, 1), end: now, groupBy: 'month' };
  }
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now, groupBy: 'week' };
}

function formatShortDate(d) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// e.g. feed-sioux-falls-report-generated-2026-09-16-14-32-05.pdf - named for
// when the PDF was generated, not the report's date range (which is already
// in the document itself).
function buildReportFilename() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `feed-sioux-falls-report-generated-${date}-${time}.pdf`;
}

// A simple horizontal-bar row for lists where labels are too long/plentiful
// for a squeezed chart-kit x-axis (item names, inventory) - real chart
// components handle short/numeric labels well, this handles long text well.
function BarRow({ label, value, max, color, sublabel }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={typography.body} numberOfLines={1}>{label}</Text>
        <Text style={typography.bodyMuted}>{value}</Text>
      </View>
      {!!sublabel && <Text style={typography.bodyMuted}>{sublabel}</Text>}
      <View style={{ height: 8, backgroundColor: colors.border, borderRadius: radii.sm, marginTop: spacing.xs, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}

export default function ReportBuilderScreen() {
  const initial = presetRange('month');
  const [preset, setPreset] = useState('month');
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [groupBy, setGroupBy] = useState(initial.groupBy);
  const [showPicker, setShowPicker] = useState(null); // 'start' | 'end' | null
  const [sections, setSections] = useState(
    SECTIONS.reduce((acc, s) => ({ ...acc, [s.key]: true }), {})
  );
  const [narrative, setNarrative] = useState('');

  const [mode, setMode] = useState('builder'); // 'builder' | 'preview'
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [exporting, setExporting] = useState(false);

  const chartRefs = useRef({});

  function selectPreset(key) {
    setPreset(key);
    if (key !== 'custom') {
      const range = presetRange(key);
      setStart(range.start);
      setEnd(range.end);
      setGroupBy(range.groupBy);
    }
  }

  function toggleSection(key) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function onPickDate(field, event, selectedDate) {
    setShowPicker(null);
    if (event.type === 'set' && selectedDate) {
      if (field === 'start') setStart(selectedDate);
      else setEnd(selectedDate);
    }
  }

  async function handleGenerate() {
    if (start > end) {
      Alert.alert('Invalid range', 'Start date must be before end date.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.getCustomReport({ start: start.toISOString(), end: end.toISOString(), groupBy });
      setReport(data);
      setMode('preview');
    } catch (err) {
      Alert.alert('Could not generate report', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPdf() {
    setExporting(true);
    try {
      const images = {};
      for (const key of Object.keys(chartRefs.current)) {
        const ref = chartRefs.current[key];
        if (ref?.capture) {
          images[key] = await ref.capture();
        }
      }

      const html = buildReportHtml({ report, sections, narrative, images, start, end, groupBy });
      const { uri } = await Print.printToFileAsync({ html });

      // printToFileAsync always names the file a random UUID - rename it to
      // something readable before it's shared/saved.
      const namedUri = `${FileSystem.cacheDirectory}${buildReportFilename()}`;
      await FileSystem.moveAsync({ from: uri, to: namedUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(namedUri, { mimeType: 'application/pdf', dialogTitle: 'Feed Sioux Falls Report' });
      } else {
        Alert.alert('PDF ready', `Saved to ${namedUri}`);
      }
    } catch (err) {
      Alert.alert('Could not export PDF', err.message);
    } finally {
      setExporting(false);
    }
  }

  if (mode === 'preview' && report) {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={typography.h1}>Report Preview</Text>
          <Button title="Edit" variant="outline" onPress={() => setMode('builder')} style={{ minHeight: 40, paddingHorizontal: spacing.md }} />
        </View>
        <Text style={[typography.bodyMuted, { marginBottom: spacing.lg }]}>
          {formatShortDate(start)} - {formatShortDate(end)}
        </Text>

        <SummaryGrid summary={report.summary} />

        {sections.peopleServed && report.peopleServedByPeriod.length > 0 && (
          <ChartSection title="People Served Over Time" refKey="peopleServed" chartRefs={chartRefs}>
            <BarChart
              data={{ labels: report.peopleServedByPeriod.map((p) => p.label), datasets: [{ data: report.peopleServedByPeriod.map((p) => p.value) }] }}
              width={CHART_WIDTH}
              height={220}
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: radii.md }}
            />
          </ChartSection>
        )}

        {sections.eventsHeld && report.eventsByPeriod.length > 0 && (
          <ChartSection title="Distribution Events Over Time" refKey="eventsHeld" chartRefs={chartRefs}>
            <BarChart
              data={{ labels: report.eventsByPeriod.map((p) => p.label), datasets: [{ data: report.eventsByPeriod.map((p) => p.value) }] }}
              width={CHART_WIDTH}
              height={220}
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: radii.md }}
            />
          </ChartSection>
        )}

        {sections.spending && report.spendByPeriod.length > 0 && (
          <ChartSection title="Money Spent Over Time" refKey="spending" chartRefs={chartRefs}>
            <LineChart
              data={{ labels: report.spendByPeriod.map((p) => p.label), datasets: [{ data: report.spendByPeriod.map((p) => p.value) }] }}
              width={CHART_WIDTH}
              height={220}
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: radii.md }}
            />
          </ChartSection>
        )}

        {sections.donations && report.donationsByPeriod.length > 0 && (
          <ChartSection title="Donations Over Time" refKey="donations" chartRefs={chartRefs}>
            <LineChart
              data={{ labels: report.donationsByPeriod.map((p) => p.label), datasets: [{ data: report.donationsByPeriod.map((p) => p.value) }] }}
              width={CHART_WIDTH}
              height={220}
              fromZero
              chartConfig={chartConfig}
              style={{ borderRadius: radii.md }}
            />
          </ChartSection>
        )}

        {sections.spendByCategory && report.spendByCategory.length > 0 && (
          <ChartSection title="Spending by Category" refKey="spendByCategory" chartRefs={chartRefs}>
            <PieChart
              data={report.spendByCategory.map((c, i) => ({
                name: `${c.category} ($${c.amount.toFixed(0)})`,
                population: c.amount,
                color: [colors.primary, colors.accent, colors.secondary][i % 3],
                legendFontColor: colors.text,
                legendFontSize: 13,
              }))}
              width={CHART_WIDTH}
              height={200}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="12"
            />
          </ChartSection>
        )}

        {sections.topItems && report.topItems.length > 0 && (
          <ChartSection title="Most Distributed Items" refKey="topItems" chartRefs={chartRefs}>
            {report.topItems.map((item) => (
              <BarRow
                key={item.name}
                label={item.name}
                value={item.quantityDistributed}
                max={report.topItems[0].quantityDistributed}
                color={colors.accent}
              />
            ))}
          </ChartSection>
        )}

        {sections.inventory && report.inventorySnapshot.length > 0 && (
          <ChartSection title="Current Inventory Snapshot" refKey="inventory" chartRefs={chartRefs}>
            <Text style={[typography.bodyMuted, { marginBottom: spacing.sm }]}>
              As of today - not reconstructed for the report's date range.
            </Text>
            {report.inventorySnapshot.map((item) => (
              <BarRow
                key={item.name}
                label={item.name}
                value={item.currentStock}
                max={Math.max(...report.inventorySnapshot.map((i) => i.currentStock), 1)}
                color={item.isLow ? colors.danger : colors.primary}
                sublabel={item.isLow ? 'LOW STOCK' : undefined}
              />
            ))}
          </ChartSection>
        )}

        {!!narrative.trim() && (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={[typography.h2, { marginBottom: spacing.sm }]}>Notes</Text>
            <Text style={typography.body}>{narrative}</Text>
          </Card>
        )}

        <Text style={[typography.bodyMuted, { marginBottom: spacing.lg, fontStyle: 'italic' }]}>
          {report.methodologyNote}
        </Text>

        <Button title="Download / Share PDF" onPress={handleExportPdf} loading={exporting} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <Text style={[typography.h1, { marginBottom: spacing.md }]}>Build a Report</Text>

      <Text style={styles.label}>Date Range</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.key}
            title={p.label}
            variant={preset === p.key ? 'primary' : 'outline'}
            onPress={() => selectPreset(p.key)}
            style={{ marginRight: spacing.xs, marginBottom: spacing.xs, paddingHorizontal: spacing.md, minHeight: 40 }}
          />
        ))}
      </View>

      {preset === 'custom' && (
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          <Button title={`From: ${formatShortDate(start)}`} variant="outline" onPress={() => setShowPicker('start')} style={{ flex: 1, marginRight: spacing.sm }} />
          <Button title={`To: ${formatShortDate(end)}`} variant="outline" onPress={() => setShowPicker('end')} style={{ flex: 1 }} />
        </View>
      )}
      {showPicker && (
        <DateTimePicker
          value={showPicker === 'start' ? start : end}
          mode="date"
          display="default"
          onChange={(e, d) => onPickDate(showPicker, e, d)}
        />
      )}

      <Text style={[styles.label, { marginTop: spacing.md }]}>Group Charts By</Text>
      <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
        {['week', 'month', 'year'].map((g) => (
          <Button
            key={g}
            title={g[0].toUpperCase() + g.slice(1)}
            variant={groupBy === g ? 'primary' : 'outline'}
            onPress={() => setGroupBy(g)}
            style={{ flex: 1, marginRight: g !== 'year' ? spacing.sm : 0, minHeight: 40 }}
          />
        ))}
      </View>

      <Text style={[styles.label, { marginTop: spacing.md }]}>What do you want on your report?</Text>
      <Card style={{ marginBottom: spacing.md }}>
        {SECTIONS.map((s) => (
          <Button
            key={s.key}
            title={`${sections[s.key] ? '✓ ' : ''}${s.label}`}
            variant={sections[s.key] ? 'primary' : 'outline'}
            onPress={() => toggleSection(s.key)}
            style={{ marginBottom: spacing.sm }}
          />
        ))}
      </Card>

      <Text style={styles.label}>Notes for this report (optional)</Text>
      <TextInput
        value={narrative}
        onChangeText={setNarrative}
        style={[styles.input, { height: 100, textAlignVertical: 'top', marginBottom: spacing.lg }]}
        placeholder="Qualitative context for grant reviewers - stories, changes observed, needs identified…"
        multiline
      />

      <Button title="Generate Preview" onPress={handleGenerate} loading={loading} />
    </ScrollView>
  );
}

function ChartSection({ title, refKey, chartRefs, children }) {
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <Text style={[typography.h2, { marginBottom: spacing.sm }]}>{title}</Text>
      <ViewShot
        ref={(r) => {
          chartRefs.current[refKey] = r;
        }}
        options={{ format: 'png', quality: 0.9, result: 'base64' }}
        style={{ backgroundColor: colors.surface }}
      >
        {children}
      </ViewShot>
    </Card>
  );
}

function SummaryGrid({ summary }) {
  const stats = [
    { label: 'Events Held', value: summary.eventsHeld },
    { label: 'People Served', value: summary.peopleServed },
    { label: 'Avg per Event', value: summary.avgPeoplePerEvent },
    { label: 'Total Spent', value: `$${summary.totalSpent.toFixed(2)}` },
    { label: 'Total Donations', value: `$${summary.totalDonations.toFixed(2)}` },
    { label: 'Cost per Person Served', value: summary.costPerPersonServed != null ? `$${summary.costPerPersonServed.toFixed(2)}` : '—' },
  ];
  return (
    <Card style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {stats.map((s) => (
          <View key={s.label} style={{ width: '50%', marginBottom: spacing.md }}>
            <Text style={typography.bodyMuted}>{s.label}</Text>
            <Text style={typography.h1}>{s.value}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function buildReportHtml({ report, sections, narrative, images, start, end, groupBy }) {
  const s = report.summary;
  const statRow = (label, value) => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div></div>`;

  const chartImg = (key, title) =>
    images[key]
      ? `<div class="section"><h2>${title}</h2><img src="data:image/png;base64,${images[key]}" style="width:100%;max-width:600px;" /></div>`
      : '';

  const table = (title, rows, cols) =>
    rows.length === 0
      ? ''
      : `<div class="section"><h2>${title}</h2><table>
          <tr>${cols.map((c) => `<th>${c.label}</th>`).join('')}</tr>
          ${rows.map((r) => `<tr>${cols.map((c) => `<td>${c.value(r)}</td>`).join('')}</tr>`).join('')}
        </table></div>`;

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2B2620; padding: 24px; }
          h1 { color: #3A4A3A; margin-bottom: 0; }
          .subtitle { color: #6B6355; margin-top: 4px; margin-bottom: 24px; }
          .stats { display: flex; flex-wrap: wrap; margin-bottom: 24px; }
          .stat { width: 33%; margin-bottom: 16px; }
          .stat-label { color: #6B6355; font-size: 12px; }
          .stat-value { font-size: 22px; font-weight: 700; color: #3A4A3A; }
          .section { margin-bottom: 28px; }
          h2 { color: #3A4A3A; font-size: 16px; border-bottom: 1px solid #D9CDAE; padding-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #D9CDAE; }
          .note { font-style: italic; color: #6B6355; font-size: 12px; margin-top: 24px; }
        </style>
      </head>
      <body>
        <h1>Feed Sioux Falls</h1>
        <div class="subtitle">
          Community outreach report &middot; ${formatShortDate(start)} - ${formatShortDate(end)} &middot; grouped by ${groupBy}
        </div>

        <div class="stats">
          ${statRow('Events Held', s.eventsHeld)}
          ${statRow('People Served', s.peopleServed)}
          ${statRow('Avg per Event', s.avgPeoplePerEvent)}
          ${statRow('Total Spent', `$${s.totalSpent.toFixed(2)}`)}
          ${statRow('Total Donations', `$${s.totalDonations.toFixed(2)}`)}
          ${statRow('Cost per Person Served', s.costPerPersonServed != null ? `$${s.costPerPersonServed.toFixed(2)}` : '—')}
        </div>

        ${sections.peopleServed ? chartImg('peopleServed', 'People Served Over Time') : ''}
        ${sections.eventsHeld ? chartImg('eventsHeld', 'Distribution Events Over Time') : ''}
        ${sections.spending ? chartImg('spending', 'Money Spent Over Time') : ''}
        ${sections.donations ? chartImg('donations', 'Donations Over Time') : ''}
        ${sections.spendByCategory ? chartImg('spendByCategory', 'Spending by Category') : ''}

        ${sections.topItems ? table('Most Distributed Items', report.topItems, [
          { label: 'Item', value: (r) => r.name },
          { label: 'Quantity Distributed', value: (r) => r.quantityDistributed },
        ]) : ''}

        ${sections.inventory ? table('Current Inventory Snapshot', report.inventorySnapshot, [
          { label: 'Item', value: (r) => r.name },
          { label: 'Category', value: (r) => r.category },
          { label: 'Current Stock', value: (r) => `${r.currentStock} ${r.unitType}${r.currentStock === 1 ? '' : 's'}` },
          { label: 'Status', value: (r) => (r.isLow ? 'LOW' : 'OK') },
        ]) : ''}

        ${narrative.trim() ? `<div class="section"><h2>Notes</h2><p>${narrative.trim().replace(/\n/g, '<br/>')}</p></div>` : ''}

        <div class="note">${report.methodologyNote}</div>
      </body>
    </html>
  `;
}

const styles = StyleSheet.create({
  label: { ...typography.bodyMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.white,
  },
});
