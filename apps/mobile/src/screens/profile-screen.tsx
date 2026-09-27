import { Button, StyleSheet, Text, View } from 'react-native';
import { getMessage } from '@virtual-mandi/shared';
import { useAuth } from '../auth/auth-context';
import { useLocale } from '../state/locale-context';

type ProfileScreenProps = { onChangeLanguage: () => void };

export const ProfileScreen = ({ onChangeLanguage }: ProfileScreenProps) => {
  const { user, logout } = useAuth();
  const { locale } = useLocale();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{getMessage(locale, 'profile.title')}</Text>
      <Text style={styles.label}>{getMessage(locale, 'profile.account')}</Text>
      <Text style={styles.email}>{user?.email ?? ''}</Text>
      <View style={styles.actions}>
        <Button title={getMessage(locale, 'profile.changeLanguage')} onPress={onChangeLanguage} />
        <Button title={getMessage(locale, 'auth.logout')} onPress={logout} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#f4f7f2' },
  title: { fontSize: 30, fontWeight: '700', color: '#1b5e20', marginBottom: 28 },
  label: { color: '#687268', fontSize: 14, marginBottom: 6 },
  email: { fontSize: 18, marginBottom: 24 },
  actions: { gap: 14 },
});
