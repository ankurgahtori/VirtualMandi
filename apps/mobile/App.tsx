import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getMessage } from '@virtual-mandi/shared';
import { AuthProvider, useAuth } from './src/auth/auth-context';
import { mobileConfig } from './src/config/env';
import { LoginScreen, RegisterScreen } from './src/screens/auth-screens';
import { FeedScreen } from './src/screens/feed-screen';
import { LanguageScreen } from './src/screens/language-screen';
import { ProfileScreen } from './src/screens/profile-screen';
import { LocaleProvider, useLocale } from './src/state/locale-context';

type AuthStackParamList = { Login: undefined; Register: undefined };
type AppStackParamList = { Main: undefined; Language: undefined };
type AppTabParamList = { Feed: undefined; Profile: undefined };
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const AppTabs = createBottomTabNavigator<AppTabParamList>();

const AuthNavigator = () => (
  <AuthStack.Navigator>
    <AuthStack.Screen
      name="Login"
      options={{ title: getMessage(mobileConfig.defaultLocale, 'auth.login') }}
    >
      {({ navigation }) => <LoginScreen onRegister={() => navigation.navigate('Register')} />}
    </AuthStack.Screen>
    <AuthStack.Screen
      name="Register"
      options={{ title: getMessage(mobileConfig.defaultLocale, 'auth.register') }}
    >
      {({ navigation }) => <RegisterScreen onRegister={() => navigation.navigate('Login')} />}
    </AuthStack.Screen>
  </AuthStack.Navigator>
);

const MainTabs = ({ onChangeLanguage }: { onChangeLanguage: () => void }) => {
  const { locale } = useLocale();
  return (
    <AppTabs.Navigator>
      <AppTabs.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: getMessage(locale, 'tabs.feed') }}
      />
      <AppTabs.Screen name="Profile" options={{ title: getMessage(locale, 'tabs.profile') }}>
        {() => <ProfileScreen onChangeLanguage={onChangeLanguage} />}
      </AppTabs.Screen>
    </AppTabs.Navigator>
  );
};

const AppNavigator = () => {
  const { locale } = useLocale();
  return (
    <AppStack.Navigator>
      <AppStack.Screen name="Main" options={{ headerShown: false }}>
        {({ navigation }) => <MainTabs onChangeLanguage={() => navigation.navigate('Language')} />}
      </AppStack.Screen>
      <AppStack.Screen name="Language" options={{ title: getMessage(locale, 'language.title') }}>
        {({ navigation }) => <LanguageScreen onDone={() => navigation.goBack()} />}
      </AppStack.Screen>
    </AppStack.Navigator>
  );
};

const RootNavigator = () => {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return (
    <NavigationContainer>
      {status === 'signed-in' ? (
        <LocaleProvider>
          <AppNavigator />
        </LocaleProvider>
      ) : (
        <AuthNavigator />
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
