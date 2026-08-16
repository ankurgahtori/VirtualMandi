import { useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getMessage } from '@virtual-mandi/shared';
import { useAuth } from '../auth/auth-context';
import { mobileConfig } from '../config/env';

type AuthScreenProps = { onRegister: () => void };
const AuthForm = ({ mode, onSwitch }: { mode: 'login' | 'register'; onSwitch: () => void }) => {
  const { login, register, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    clearError();
    try {
      if (mode === 'login') await login({ email, password });
      else await register({ email, password });
    } catch {
      // Auth context exposes a safe user-facing message.
    } finally {
      setBusy(false);
    }
  };
  const locale = mobileConfig.defaultLocale;
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>{getMessage(locale, 'common.appName')}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? getMessage(locale, 'auth.login')
            : getMessage(locale, 'auth.register')}
        </Text>
        <TextInput
          accessibilityLabel={getMessage(locale, 'auth.email')}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder={getMessage(locale, 'auth.email')}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          accessibilityLabel={getMessage(locale, 'auth.password')}
          autoComplete="password"
          placeholder={getMessage(locale, 'auth.password')}
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button
          disabled={busy || !email || password.length < 8}
          title={
            busy
              ? getMessage(locale, 'common.loading')
              : mode === 'login'
                ? getMessage(locale, 'auth.login')
                : getMessage(locale, 'auth.register')
          }
          onPress={submit}
        />
        <Button
          title={
            mode === 'login'
              ? getMessage(locale, 'auth.register')
              : getMessage(locale, 'auth.login')
          }
          onPress={onSwitch}
        />
      </View>
    </KeyboardAvoidingView>
  );
};

export const LoginScreen = ({ onRegister }: AuthScreenProps) => (
  <AuthForm mode="login" onSwitch={onRegister} />
);
export const RegisterScreen = ({ onRegister }: AuthScreenProps) => (
  <AuthForm mode="register" onSwitch={onRegister} />
);

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f4f7f2' },
  card: { gap: 14, padding: 22, borderRadius: 16, backgroundColor: '#fff' },
  title: { fontSize: 30, fontWeight: '700', color: '#1b5e20' },
  subtitle: { fontSize: 20, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#c8d2c5', borderRadius: 8, padding: 12 },
  error: { color: '#b3261e' },
});
