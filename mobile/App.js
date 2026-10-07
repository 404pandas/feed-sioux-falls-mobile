import React from 'react';
import { View, Alert, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { brand, colors } from './src/theme/tokens';
import AppHeader from './src/components/AppHeader';
import TabBar from './src/components/TabBar';
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Every screen uses the website-style header (components/AppHeader).
const screenOptions = {
  header: (props) => <AppHeader {...props} />,
  contentStyle: { backgroundColor: colors.background },
};

// The survey opens full-screen (no tab bar), with the website's teal bar.
// It sets its own Quick Exit button (SurveyScreen).
const surveyOptions = { title: 'Survey', headerTone: 'teal', headerBackLabel: 'Close' };

function LoginButton({ navigation }) {
  return <Button title="Log in" variant="outline" small onPress={() => navigation.navigate('Login')} />;
}

function LogoutButton() {
  const { user, logout } = useAuth();
  function confirmLogout() {
    Alert.alert('Log out?', 'You can log back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: logout },
    ]);
  }
  return <Button title={user?.role === 'neighbor' ? `Log out ${user.name.split(' ')[0]}` : 'Log out'} icon="logout" variant="outline" small onPress={confirmLogout} />;
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
        sceneContainerStyle: { backgroundColor: colors.background },
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
        sceneContainerStyle: { backgroundColor: colors.background },
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
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="SurveyResults" component={SurveyResultsScreen} options={{ title: 'Survey results' }} />
      <Stack.Screen name="ManageItems" component={InventoryScreen} options={{ title: 'Edit items' }} />
      <Stack.Screen name="Budget" component={BudgetScreen} options={{ title: 'Budget' }} />
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

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  const isStaff = user && user.role !== 'neighbor';
  return <NavigationContainer>{isStaff ? <StaffStack /> : <PublicStack />}</NavigationContainer>;
}

export default function App() {
  // Fonts are bundled with the app - nothing is downloaded at runtime.
  const [fontsLoaded] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold });
  const stripeKey = Constants.expoConfig.extra.stripePublishableKey;

  return (
    <SafeAreaProvider>
      <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.com.feedsiouxfalls.app">
        <AuthProvider>
          {/* Dark icons: headers are white now, like the website. */}
          <StatusBar style="dark" />
          {fontsLoaded ? <RootNavigator /> : <Loading />}
        </AuthProvider>
      </StripeProvider>
    </SafeAreaProvider>
  );
}
