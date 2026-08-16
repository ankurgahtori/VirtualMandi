import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { getMessage } from '@virtual-mandi/shared';
import { mobileConfig } from './src/config/env';

type RootStackParamList = { Home: undefined };
const Stack = createNativeStackNavigator<RootStackParamList>();

const HomeScreen = () => {
  const [locale, setLocale] = useState(mobileConfig.defaultLocale);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{getMessage(locale, 'common.appName')}</Text>
      <Text>{getMessage(locale, 'feed.title')}</Text>
      <Text style={styles.endpoint}>API: {mobileConfig.apiBaseUrl}</Text>
      <Button
        title={getMessage(locale, 'filters.language')}
        onPress={() => setLocale(locale === 'en-IN' ? 'hi-IN' : 'en-IN')}
      />
    </View>
  );
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: getMessage(mobileConfig.defaultLocale, 'common.appName') }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  endpoint: { color: '#666', fontSize: 12 },
});
