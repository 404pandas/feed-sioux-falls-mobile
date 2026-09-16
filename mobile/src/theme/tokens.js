// Design tokens for the Feed Sioux Falls app.
// Palette: warm, grounded fall tones - not bright/candy pastel, not
// corporate-dashboard blue. Meant to feel like a community pantry, not a
// SaaS product.

export const colors = {
  background: '#F5F1E8',   // warm paper
  surface: '#E8DFC8',      // soft tan card surface
  primary: '#3A4A3A',      // forest green - primary actions, headers
  secondary: '#8B6F47',    // warm brown - secondary UI, borders
  accent: '#C9704A',       // muted pumpkin - the one CTA color (buy now, donate, +1 tap)
  text: '#2B2620',         // near-black warm charcoal
  textMuted: '#6B6355',
  border: '#D9CDAE',       // hairline border color, used instead of shadows
  danger: '#A9432F',       // low stock / errors, still in-palette (darker pumpkin)
  success: '#4F6B4A',      // confirmations, in-palette green
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
};

export const typography = {
  // System fonts only - no custom font loading, keeps the app lighter and
  // removes one more thing that can break on a zero-maintenance app.
  tallyNumber: { fontSize: 72, fontWeight: '700', color: colors.text },
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: 20, fontWeight: '600', color: colors.text },
  body: { fontSize: 16, fontWeight: '400', color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: '400', color: colors.textMuted },
  button: { fontSize: 18, fontWeight: '600', color: colors.white },
};

// Flat surfaces + a 1px hairline border instead of drop shadows - matches
// the "no SaaS-card look" direction.
export const cardStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radii.md,
  padding: spacing.md,
};
