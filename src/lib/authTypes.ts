export interface GoogleUser {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export interface StoredGoogleSession extends GoogleUser {
  refreshToken: string;
  scope?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PendingGoogleOAuthState {
  state: string;
  codeVerifier: string;
  popup: boolean;
  createdAt: number;
}

export interface AuthMeResponse {
  authenticated: boolean;
  user?: GoogleUser;
  error?: string;
}
