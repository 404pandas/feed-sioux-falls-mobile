import React from 'react';
import { View, Pressable, Text, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme/tokens';

import LandingScreen from './src/screens/shared/LandingScreen';
import GuestHomeScreen from './src/screens/shared/GuestHomeScreen';
import VolunteerHomeScreen from './src/screens/volunteer/VolunteerHomeScreen';
import QuickStockScreen from './src/screens/volunteer/QuickStockScreen';
import NeighborHomeScreen from './src/screens/neighbor/NeighborHomeScreen';
import InventoryScreen from './src/screens/admin/InventoryScreen';
import BudgetScreen from './src/screens/admin/BudgetScreen';
import ReportBuilderScreen from './src/screens/admin/ReportBuilderScreen';
import EventsListScreen from './src/screens/admin/EventsListScreen';
import EventDetailScreen from './src/screens/admin/EventDetailScreen';
import AdminHomeScreen from './src/screens/admin/AdminHomeScreen';
import SurveyResultsScreen from './src/screens/admin/SurveyResultsScreen';
import SurveyHubScreen from './src/screens/volunteer/SurveyHubScreen';
import SurveyScreen from './src/screens/shared/SurveyScreen';
import MessagesScreen from './src/screens/admin/MessagesScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: colors.white,
  headerTitleStyle: { fontWeight: '600' },
  contentStyle: { backgroundColor: colors.background },
};

// Logged-in screens (staff and neighbor) all get this in the header, so
// there's always a way to log out no matter which screen someone's on -
// e.g. mid-tally on the distribution screen, not just from the home screen.
function HeaderLogoutButton() {
  const { user, logout } = useAuth();
  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }
  // Shows who's logged in next to Log Out, like the website header.
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {!!user?.name && <Text style={{ color: colors.white, opacity: 0.85, marginRight: 12 }}>{user.name.split(' ')[0]}</Text>}
      <Pressable onPress={confirmLogout} hitSlop={12} accessibilityRole="button">
        <Text style={{ color: colors.white, fontWeight: '600', fontSize: 16 }}>Log Out</Text>
      </Pressable>
    </View>
  );
}

// Guests get "Log In" in the same spot, so the login is always one tap away.
function HeaderLoginButton({ navigation }) {
  return (
    <Pressable onPress={() => navigation.navigate('Landing')} hitSlop={12} accessibilityRole="button">
      <Text style={{ color: colors.white, fontWeight: '600', fontSize: 16 }}>Log In</Text>
    </Pressable>
  );
}

const loggedInScreenOptions = {
  ...screenOptions,
  headerRight: () => <HeaderLogoutButton />,
};

// The survey sets its own header (title in the chosen language + the
// Quick Exit button in place of Log Out). The back button just says "Close".
const surveyScreenOptions = {
  ...screenOptions,
  title: 'Survey',
  headerBackTitle: 'Close',
  headerBackTitleVisible: true,
};

// Shown before anyone logs in, and while donating/contacting as a guest.
function GuestStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Feed Sioux Falls' }} />
      <Stack.Screen
        name="GuestHome"
        component={GuestHomeScreen}
        options={({ navigation }) => ({ title: 'Feed Sioux Falls', headerRight: () => <HeaderLoginButton navigation={navigation} /> })}
      />
      <Stack.Screen name="Survey" component={SurveyScreen} options={surveyScreenOptions} />
    </Stack.Navigator>
  );
}

// The bottom tab bar for volunteers and admins. Everything someone needs
// during outreach is one tap away from anywhere:
//   Today  - the people-served counter (starts/resumes today's event)
//   Stock  - quick +/- inventory while handing things out
//   Survey - start the community survey, share it, see results (admin)
//   Admin  - inventory setup, budget, reports, past events (admins only)
// Before this, admin tools were a stack of buttons under the tally counter
// and Adjust Inventory was a button you had to scroll to.
const TAB_ICONS = {
  Today: 'people',
  Stock: 'cube',
  SurveyHub: 'clipboard',
  AdminHome: 'settings',
};

function StaffTabs() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...loggedInScreenOptions,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons name={focused ? TAB_ICONS[route.name] : `${TAB_ICONS[route.name]}-outline`} size={size} color={color} />
        ),
        sceneContainerStyle: { backgroundColor: colors.background },
      })}
    >
      <Tab.Screen name="Today" component={VolunteerHomeScreen} options={{ title: 'Today' }} />
      <Tab.Screen name="Stock" component={QuickStockScreen} options={{ title: 'Stock', headerTitle: 'Adjust Inventory' }} />
      <Tab.Screen name="SurveyHub" component={SurveyHubScreen} options={{ title: 'Survey' }} />
      {isAdmin && <Tab.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: 'Admin' }} />}
    </Tab.Navigator>
  );
}

// Tabs sit at the bottom of this stack; detail screens and the survey push
// on top (full-screen, no tab bar). Admin-only screens are registered for
// everyone on staff, but only admins get links to them - the real
// enforcement is server-side (requireStaff/requireAdmin), this is about not
// showing dead ends.
function StaffStack() {
  return (
    <Stack.Navigator screenOptions={loggedInScreenOptions}>
      <Stack.Screen name="Tabs" component={StaffTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Survey" component={SurveyScreen} options={surveyScreenOptions} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budget' }} />
      <Stack.Screen name="Reports" component={ReportBuilderScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Past Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
      <Stack.Screen name="SurveyResults" component={SurveyResultsScreen} options={{ title: 'Survey Results' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

// Shown once a neighbor is logged in. Deliberately its own stack, separate
// from StaffStack, so there's no admin/volunteer screen a neighbor could
// navigate to even by mistake - the operational screens simply aren't
// registered here.
function NeighborStack() {
  return (
    <Stack.Navigator screenOptions={loggedInScreenOptions}>
      <Stack.Screen name="NeighborHome" component={NeighborHomeScreen} options={{ title: 'Feed Sioux Falls' }} />
      <Stack.Screen name="Survey" component={SurveyScreen} options={surveyScreenOptions} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? <GuestStack /> : user.role === 'neighbor' ? <NeighborStack /> : <StaffStack />}
    </NavigationContainer>
  );
}

export default function App() {
  const stripeKey = Constants.expoConfig.extra.stripePublishableKey;

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.com.feedsiouxfalls.app">
        <AuthProvider>
          {/* Light icons: every screen has the dark green header behind the status
              bar, so dark icons (the old setting) were nearly invisible. */}
          <StatusBar style="light" />
          <RootNavigator />
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
