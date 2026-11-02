const fs = require("fs");

const EAS_PROJECT_ID = "9e578f4d-f862-4313-9d7d-16dc67ea6f87";

// Firebase's Android config, needed for push notifications on Android. Put
// the file from the Firebase console next to this one as
// google-services.json, or upload it to EAS as a file environment variable
// named GOOGLE_SERVICES_JSON. Without it the app still builds and works -
// just without push (the Saturday reminder still works; it's made on the
// phone).
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ||
  (fs.existsSync("./google-services.json") ? "./google-services.json" : undefined);

export default {
  expo: {
    name: "Feed Sioux Falls",
    slug: "feed-sioux-falls",
    // Shown at the bottom of the login screen - bump it for each release so
    // you can tell which build is installed on a phone.
    version: "3.0.0",
    // Over-the-air updates (EAS Update): a phone only takes updates made
    // for the same runtimeVersion. Keep it at "3" for every JS-only change
    // (screens, wording, logic), and bump it ONLY when a build adds or
    // upgrades a native module - those need a new APK installed by hand,
    // and the old APKs must not be sent JS they can't run.
    runtimeVersion: "3",
    updates: {
      url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
      // Look for an update every time the app opens, but never make anyone
      // wait for it - it downloads in the background and the app offers a
      // restart (components/UpdateBanner).
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },
    plugins: [
      ["expo-notifications", { color: "#1D6B62" }],
      // Receipts: take a photo or pick one. Text on it is read on the phone
      // (Google ML Kit, offline) - nothing is sent anywhere to read it.
      [
        "expo-image-picker",
        {
          cameraPermission: "Take a photo of a receipt so it's saved with the budget.",
          photosPermission: "Choose a photo of a receipt so it's saved with the budget.",
        },
      ],
    ],
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#D7EFE9",
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
      googleServicesFile,
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
        projectId: EAS_PROJECT_ID,
      },
    },
  },
};
