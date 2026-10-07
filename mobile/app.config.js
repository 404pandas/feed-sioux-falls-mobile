export default {
  expo: {
    name: "Feed Sioux Falls",
    slug: "feed-sioux-falls",
    // Shown at the bottom of the login screen - bump it for each release so
    // you can tell which build is installed on a phone.
    version: "2.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#F5F1E8",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.feedsiouxfalls.app",
    },
    android: {
      package: "com.feedsiouxfalls.app",
      // Shrink the screen above the keyboard (instead of letting it cover
      // the bottom), so the field being typed in and its Save button stay
      // visible. This is Expo's default; spelled out so it isn't changed by
      // accident.
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#F5F1E8",
      },
    },
    extra: {
      // Set this to your deployed Render/Railway URL before building.
      // Kept in app config (not hardcoded in api client) so it's one place
      // to change when the backend URL changes.
      apiUrl: process.env.API_URL || "http://localhost:4000",
      // The website's survey page (e.g. https://your-site.netlify.app/survey).
      // Used for the survey's Share button and QR code - both stay hidden
      // until this is set, rather than handing people a broken link.
      surveyUrl: process.env.SURVEY_URL || null,
      stripePublishableKey:
        process.env.STRIPE_PUBLISHABLE_KEY || "pk_test_replace_me",
      eas: {
        projectId: "9e578f4d-f862-4313-9d7d-16dc67ea6f87",
      },
    },
  },
};
