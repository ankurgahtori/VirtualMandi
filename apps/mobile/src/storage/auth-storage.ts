import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'virtual-mandi.refresh-token';

export const authStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  saveRefreshToken: (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token),
  clearRefreshToken: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
};
