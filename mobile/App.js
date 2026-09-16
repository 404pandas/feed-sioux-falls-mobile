import React from 'react';
import { View, Pressable, Text, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator();

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
  const { logout } = useAuth();
  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }
  return (
    <Pressable onPress={confirmLogout} hitSlop={12}>
      <Text style={{ color: colors.white, fontWeight: '600' }}>Log Out</Text>
    </Pressable>
  );
}

const loggedInScreenOptions = {
  ...screenOptions,
  headerRight: () => <HeaderLogoutButton />,
};

// Shown before anyone logs in, and while donating/contacting as a guest.
function GuestStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Landing" component={LandingScreen} options={{ title: 'Feed Sioux Falls' }} />
      <Stack.Screen name="GuestHome" component={GuestHomeScreen} options={{ title: 'Support Us' }} />
    </Stack.Navigator>
  );
}

// Shown once a volunteer/admin is logged in. Admin-only screens are reachable
// here too, but the buttons that link to them are hidden from volunteers in
// VolunteerHomeScreen - the actual enforcement happens server-side
// (requireStaff/requireAdmin), this is just about not showing dead ends.
function StaffStack() {
  return (
    <Stack.Navigator screenOptions={loggedInScreenOptions}>
      <Stack.Screen name="VolunteerHome" component={VolunteerHomeScreen} options={{ title: 'Feed Sioux Falls' }} />
      <Stack.Screen name="QuickStock" component={QuickStockScreen} options={{ title: 'Adjust Inventory' }} />
      <Stack.Screen name="Inventory" component={InventoryScreen} options={{ title: 'Inventory' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budget' }} />
      <Stack.Screen name="Reports" component={ReportBuilderScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="EventsList" component={EventsListScreen} options={{ title: 'Past Events' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Event Details' }} />
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
          <StatusBar style="dark" />
          <RootNavigator />
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
