// Design tokens for the Feed Sioux Falls app - the same look as the website
// (feed-sioux-falls-website/src/theme/tokens.css): colors pulled straight
// from the logo drawing, marker-black outlines, a small hard shadow like a
// sticker cut out of the drawing, Fredoka headings and Atkinson
// Hyperlegible body text. The v1 color names are kept and re-pointed at
// the logo colors, so every existing screen picks up the new look.

export const brand = {
  ink: '#241F1C', // the marker outline
  teal: '#1D6B62', // jar lid, darkened so white text on it passes AA
  tealSoft: '#D7EFE9', // jar glass
  heart: '#C92D55', // the heart - donate / give
  heartSoft: '#FDE3EA',
  coin: '#F6C944', // coins - highlighter for live numbers
  coinSoft: '#FFF4CF',
  bear: '#7A4A2C', // teddy bear
  paper: '#FFFFFF',
  mist: '#F3F8F6', // page background, a breath of jar-glass teal
  line: '#E1DDD5', // hairlines inside cards
  fieldBorder: '#8A837C',
};

export const colors = {
  background: brand.mist,
  surface: brand.paper,
  primary: brand.teal,
  secondary: brand.bear,
  accent: brand.heart,
  text: brand.ink,
  textMuted: '#5B544D',
  border: brand.ink,
  danger: '#B3261E',
  success: '#2F6B3A',
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
  sm: 6,
  md: 12,
  lg: 18,
  pill: 999,
};

// Font files are bundled with the app (loaded in App.js) - nothing is
// downloaded at runtime. Use the 'display' / 'body' names in styles; the
// app's Text component picks the right file for the weight, since Android
// can't fake bold on a custom font.
export const fonts = {
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
};

// The marker look: 2px ink outline + small hard shadow (see components/Lift).
export const outline = { borderWidth: 2, borderColor: brand.ink };
export const lift = 3;
export const liftSmall = 2;

export const typography = {
  // 18px body: a lot of the people using this read on small phones, and a
  // lot of the volunteers would rather not squint.
  tallyNumber: { fontFamily: 'display', fontSize: 80, fontWeight: '700', color: colors.text, lineHeight: 88 },
  h1: { fontFamily: 'display', fontSize: 30, fontWeight: '600', color: colors.text, lineHeight: 36 },
  h2: { fontFamily: 'display', fontSize: 22, fontWeight: '600', color: colors.text, lineHeight: 28 },
  body: { fontSize: 18, color: colors.text, lineHeight: 26 },
  bodyMuted: { fontSize: 16, color: colors.textMuted, lineHeight: 23 },
  button: { fontFamily: 'display', fontSize: 19, fontWeight: '600', color: colors.white },
  label: { fontSize: 16, fontWeight: '700', color: colors.textMuted },
};

// Cards: white, outlined, rounded. Wrap in <Card> to get the hard shadow.
export const cardStyle = {
  backgroundColor: colors.surface,
  ...outline,
  borderRadius: radii.lg,
  padding: spacing.md,
};

// Text fields, same as the website's .field-input.
export const inputStyle = {
  borderWidth: 2,
  borderColor: brand.fieldBorder,
  borderRadius: radii.md,
  paddingVertical: 12,
  paddingHorizontal: spacing.md,
  fontSize: 18,
  color: colors.text,
  backgroundColor: colors.white,
};
