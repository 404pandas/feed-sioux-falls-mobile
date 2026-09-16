export default {
  expo: {
    name: 'Feed Sioux Falls',
    slug: 'feed-sioux-falls',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#F5F1E8',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.feedsiouxfalls.app',
    },
    android: {
      package: 'com.feedsiouxfalls.app',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#F5F1E8',
      },
    },
    extra: {
      // Set this to your deployed Render/Railway URL before building.
      // Kept in app config (not hardcoded in api client) so it's one place
      // to change when the backend URL changes.
      apiUrl: process.env.API_URL || 'http://localhost:4000',
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_replace_me',
    },
  },
};
