import { Button, StyleSheet, Text, View } from 'react-native';
import type { SupportedLocale } from '@virtual-mandi/shared';
import { getMessage } from '@virtual-mandi/shared';
import { useLocale } from '../state/locale-context';

type LanguageScreenProps = { onDone: () => void };

export const LanguageScreen = ({ onDone }: LanguageScreenProps) => {
  const { locale, setLocale } = useLocale();
  const choose = (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    onDone();
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{getMessage(locale, 'language.title')}</Text>
      <Button
        title={`${getMessage(locale, 'language.english')}${locale === 'en-IN' ? ' ✓' : ''}`}
        onPress={() => choose('en-IN')}
      />
      <Button
        title={`${getMessage(locale, 'language.hindi')}${locale === 'hi-IN' ? ' ✓' : ''}`}
        onPress={() => choose('hi-IN')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, gap: 18, padding: 24, backgroundColor: '#f4f7f2' },
  title: { fontSize: 28, fontWeight: '700', color: '#1b5e20', marginBottom: 12 },
});
