import assert from 'node:assert/strict';
import test from 'node:test';
import { readMobileConfig } from '../src/config/env.js';

test('normalizes mobile API URL and locale', () => {
  const config = readMobileConfig({
    EXPO_PUBLIC_API_BASE_URL: 'http://10.0.2.2:3000/',
    EXPO_PUBLIC_DEFAULT_LOCALE: 'hi',
  });
  assert.deepEqual(config, { apiBaseUrl: 'http://10.0.2.2:3000', defaultLocale: 'hi-IN' });
});

test('rejects missing or unsafe API URL with setup guidance', () => {
  assert.throws(() => readMobileConfig({}), /EXPO_PUBLIC_API_BASE_URL/);
  assert.throws(
    () => readMobileConfig({ EXPO_PUBLIC_API_BASE_URL: 'postgresql://secret' }),
    /http\(s\) URL/,
  );
});
