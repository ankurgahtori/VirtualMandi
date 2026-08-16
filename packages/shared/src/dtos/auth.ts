export type RegisterInput = {
  email: string;
  password: string;
};

export type LoginInput = RegisterInput;

export type AuthUserDto = {
  id: string;
  email: string;
  role: 'FARMER' | 'ADMIN';
};

export type AuthTokensDto = {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
};

export type AuthResponseDto = {
  user: AuthUserDto;
  tokens: AuthTokensDto;
};
