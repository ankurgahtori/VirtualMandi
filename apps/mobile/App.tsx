import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getMessage } from '@virtual-mandi/shared';
import { AuthProvider, useAuth } from './src/auth/auth-context';
import { mobileConfig } from './src/config/env';
import { LoginScreen, RegisterScreen } from './src/screens/auth-screens';
import { FeedScreen } from './src/screens/feed-screen';

type AuthStackParamList = { Login: undefined; Register: undefined };
type AppStackParamList = { Feed: undefined };
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

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

const AppNavigator = () => (
  <AppStack.Navigator>
    <AppStack.Screen
      name="Feed"
      component={FeedScreen}
      options={{ title: getMessage(mobileConfig.defaultLocale, 'feed.title') }}
    />
  </AppStack.Navigator>
);

const RootNavigator = () => {
  const { status } = useAuth();
  if (status === 'loading') return null;
  return (
    <NavigationContainer>
      {status === 'signed-in' ? <AppNavigator /> : <AuthNavigator />}
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
