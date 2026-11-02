import React, { useEffect, useRef } from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { brand, colors } from './src/theme/tokens';
import AppHeader, { HEADER_MAX_SCALE } from './src/components/AppHeader';
import TabBar from './src/components/TabBar';
import UpdateBanner from './src/components/UpdateBanner';
import { screenForNotification } from './src/notifications';
import Button from './src/components/Button';

import HomeScreen from './src/screens/public/HomeScreen';
import GetHelpScreen from './src/screens/public/GetHelpScreen';
import GiveScreen from './src/screens/public/GiveScreen';
import AboutScreen from './src/screens/public/AboutScreen';
import LoginScreen from './src/screens/public/LoginScreen';
import SurveyScreen from './src/screens/shared/SurveyScreen';
import StaffHomeScreen from './src/screens/staff/StaffHomeScreen';
import MoreScreen from './src/screens/staff/MoreScreen';
import VolunteerHomeScreen from './src/screens/volunteer/VolunteerHomeScreen';
import QuickStockScreen from './src/screens/volunteer/QuickStockScreen';
import SurveyHubScreen from './src/screens/volunteer/SurveyHubScreen';
import InventoryScreen from './src/screens/admin/InventoryScreen';
import BudgetScreen from './src/screens/admin/BudgetScreen';
import ReportBuilderScreen from './src/screens/admin/ReportBuilderScreen';
import EventsListScreen from './src/screens/admin/EventsListScreen';
import EventDetailScreen from './src/screens/admin/EventDetailScreen';
import SurveyResultsScreen from './src/screens/admin/SurveyResultsScreen';
import MessagesScreen from './src/screens/admin/MessagesScreen';
import SendNotificationScreen from './src/screens/admin/SendNotificationScreen';
import TeamChatScreen from './src/screens/staff/TeamChatScreen';
import InboxScreen from './src/screens/staff/InboxScreen';
import NewMessageScreen from './src/screens/staff/NewMessageScreen';
import ThreadScreen from './src/screens/staff/ThreadScreen';
import ReceiptScreen from './src/screens/staff/ReceiptScreen';
import PeopleScreen from './src/screens/admin/PeopleScreen';
import NotificationSettingsScreen from './src/screens/shared/NotificationSettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

// Every screen uses the website-style header (components/AppHeader).
const screenOptions = {
  header: (props) => <AppHeader {...props} />,
  contentStyle: { backgroundColor: colors.background },
};

// The survey opens full-screen (no tab bar), with the website's teal bar.
// It sets its own Quick Exit button (SurveyScreen).
const surveyOptions = { title: 'Survey', headerTone: 'teal', headerBackLabel: 'Close' };

function LoginButton({ navigation }) {
  return <Button title="Log in" variant="outline" small onPress={() => navigation.navigate('Login')} maxFontSizeMultiplier={HEADER_MAX_SCALE} />;
}

function LogoutButton() {
  const { user, logout } = useAuth();
  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  }
  return (
    <Button
      title={user?.role === 'neighbor' ? `Log out ${user.name.split(' ')[0]}` : 'Log out'}
      icon="logout"
      variant="outline"
      small
      onPress={confirmLogout}
      maxFontSizeMultiplier={HEADER_MAX_SCALE}
    />
  );
}

const openSurvey = (navigation) => navigation.navigate('Survey');

// The public site's sections - for guests and logged-in neighbors, same as
// the website's header links: Home, Get help, Give, Survey, About us.
function PublicTabs() {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={({ navigation }) => ({
        ...screenOptions,
        headerBrand: true,
        headerRight: () => (user ? <LogoutButton /> : <LoginButton navigation={navigation} />),
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabIcon: 'home' }} />
      <Tab.Screen name="Help" component={GetHelpScreen} options={{ title: 'Get help', tabIcon: 'pin' }} />
      <Tab.Screen name="Give" component={GiveScreen} options={{ title: 'Give', tabIcon: 'heart' }} />
      <Tab.Screen name="SurveyTab" component={HomeScreen} options={{ title: 'Survey', tabIcon: 'clipboard', onTabPress: openSurvey }} />
      <Tab.Screen name="About" component={AboutScreen} options={{ title: 'About us', tabIcon: 'people' }} />
    </Tab.Navigator>
  );
}

function PublicStack() {
  const { user } = useAuth();
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="PublicTabs" component={PublicTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Survey" component={SurveyScreen} options={surveyOptions} />
      <Stack.Screen name="Notifications" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      {!user && <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />}
    </Stack.Navigator>
  );
}

// The staff app's tabs - the website's phone tab bar: Home, Count people,
// Inventory, Survey, More. Admin tools live under More.
function StaffTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        ...screenOptions,
        headerBrand: true,
        headerRight: () => <LogoutButton />,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="StaffHome" component={StaffHomeScreen} options={{ title: 'Home', tabIcon: 'home' }} />
      <Tab.Screen name="Count" component={VolunteerHomeScreen} options={{ title: 'Count', tabIcon: 'counter' }} />
      <Tab.Screen name="Inventory" component={QuickStockScreen} options={{ title: 'Inventory', tabIcon: 'box' }} />
      <Tab.Screen name="SurveyHub" component={SurveyHubScreen} options={{ title: 'Survey', tabIcon: 'clipboard' }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ title: 'More', tabIcon: 'more' }} />
    </Tab.Navigator>
  );
}

// Tabs at the bottom of the stack; everything else opens on top of them
// with a labeled Back button. Admin-only screens are registered for all
// staff, but only admins get links to them - the real enforcement is
// server-side (requireAdmin).
function StaffStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={StaffTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Survey" component={SurveyScreen} options={surveyOptions} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Help requests' }} />
      <Stack.Screen name="Inbox" component={InboxScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ title: 'New message' }} />
      <Stack.Screen name="Thread" component={ThreadScreen} options={{ title: 'Conversation' }} />
      <Stack.Screen name="TeamChat" component={TeamChatScreen} options={{ title: 'Team chat' }} />
      <Stack.Screen name="SendNotification" component={SendNotificationScreen} options={{ title: 'Send a notification' }} />
      <Stack.Screen name="Notifications" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="SurveyResults" component={SurveyResultsScreen} options={{ title: 'Survey results' }} />
      <Stack.Screen name="ManageItems" component={InventoryScreen} options={{ title: 'Edit items' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Receipts & budget' }} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={{ title: 'Receipt' }} />
      <Stack.Screen name="People" component={PeopleScreen} options={{ title: 'People & logins' }} />
      <Stack.Screen name="Reports" component={ReportBuilderScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Past events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event details' }} />
      {/* The public screens, so staff can see what neighbors see. */}
      <Stack.Screen name="PublicHome" component={HomeScreen} options={{ title: 'Public website' }} />
      <Stack.Screen name="Help" component={GetHelpScreen} options={{ title: 'Get help' }} />
      <Stack.Screen name="Give" component={GiveScreen} options={{ title: 'Give' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About us' }} />
    </Stack.Navigator>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: brand.tealSoft }}>
      <ActivityIndicator size="large" color={brand.teal} />
    </View>
  );
}

// Tapping a notification opens the screen it's about (team chat, the Give
// screen, and so on) - including when the tap is what started the app.
function useNotificationTaps(isStaff, loading) {
  const pending = useRef(null);
  const isStaffRef = useRef(isStaff);
  isStaffRef.current = isStaff;

  function open(response) {
    const target = screenForNotification(response?.notification?.request?.content?.data, isStaffRef.current);
    if (!target) return;
    if (navigationRef.isReady()) navigationRef.navigate(target.name, target.params);
    else pending.current = target;
  }

  useEffect(() => {
    if (loading) return undefined;
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [loading]);

  return function onReady() {
    if (pending.current) {
      navigationRef.navigate(pending.current.name, pending.current.params);
      pending.current = null;
    }
  };
}

function RootNavigator() {
  const { user, loading } = useAuth();
  const isStaff = !!user && user.role !== 'neighbor';
  const onReady = useNotificationTaps(isStaff, loading);
  if (loading) return <Loading />;
  return (
    <>
      {/* navigationInChildEnabled: notification taps open screens inside the
          tabs (e.g. StaffHome) by name, as React Navigation 6 did. */}
      <NavigationContainer ref={navigationRef} onReady={onReady} navigationInChildEnabled>
        {isStaff ? <StaffStack /> : <PublicStack />}
      </NavigationContainer>
      <UpdateBanner />
    </>
  );
}

export default function App() {
  // Fonts are bundled with the app - nothing is downloaded at runtime.
  const [fontsLoaded] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const stripeKey = Constants.expoConfig.extra.stripePublishableKey;

  return (
    <SafeAreaProvider>
      {/* Keeps fields and buttons above the keyboard (see components/Screen). */}
      <KeyboardProvider>
        <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.com.feedsiouxfalls.app">
          <AuthProvider>
            {/* Dark icons: headers are white now, like the website. */}
            <StatusBar style="dark" />
            {fontsLoaded ? <RootNavigator /> : <Loading />}
          </AuthProvider>
        </StripeProvider>
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}
