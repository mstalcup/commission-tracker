import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { UserManager, WebStorageStateStore, type User as OidcUser } from 'oidc-client-ts';
import type { AppConfig } from './config';

/*
 * Login uses Cognito's hosted sign-in, which hands straight off to Google.
 * oidc-client-ts runs the standard "authorization code + PKCE" redirect flow
 * and keeps the tokens in localStorage (refreshing them automatically).
 */

let manager: UserManager | undefined;
let appConfig: AppConfig | undefined;

export function initAuth(config: AppConfig) {
  appConfig = config;
  manager = new UserManager({
    authority: `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`,
    client_id: config.clientId,
    redirect_uri: `${window.location.origin}/callback`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code',
    scope: 'openid email profile',
    userStore: new WebStorageStateStore({ store: window.localStorage }),
    automaticSilentRenew: true,
  });
  return manager;
}

function um(): UserManager {
  if (!manager) throw new Error('Auth not initialised');
  return manager;
}

/** The ID token is what API Gateway's Cognito authorizer checks. */
export async function getIdToken(): Promise<string | undefined> {
  const user = await um().getUser();
  if (!user || user.expired) {
    try {
      const renewed = await um().signinSilent();
      return renewed?.id_token;
    } catch {
      return undefined;
    }
  }
  return user.id_token;
}

export async function signIn(returnTo = window.location.pathname) {
  await um().signinRedirect({
    state: { returnTo },
    // Skip Cognito's provider picker and go straight to Google.
    extraQueryParams: appConfig?.googleEnabled ? { identity_provider: 'Google' } : {},
  });
}

export async function signOut() {
  await um().removeUser();
  if (!appConfig) return;
  // Cognito has no standard end-session endpoint; use its /logout URL.
  const params = new URLSearchParams({
    client_id: appConfig.clientId,
    logout_uri: `${window.location.origin}/`,
  });
  window.location.href = `https://${appConfig.cognitoDomain}/logout?${params}`;
}

export async function completeSignIn(): Promise<string> {
  const user = await um().signinRedirectCallback();
  const state = user.state as { returnTo?: string } | undefined;
  return state?.returnTo && state.returnTo !== '/callback' ? state.returnTo : '/';
}

interface AuthState {
  user: OidcUser | null;
  loading: boolean;
  config: AppConfig;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ config, children }: { config: AppConfig; children: ReactNode }) {
  const [user, setUser] = useState<OidcUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const m = um();
    m.getUser().then((u) => {
      setUser(u && !u.expired ? u : null);
      setLoading(false);
    });
    const onLoaded = (u: OidcUser) => setUser(u);
    const onUnloaded = () => setUser(null);
    m.events.addUserLoaded(onLoaded);
    m.events.addUserUnloaded(onUnloaded);
    m.events.addSilentRenewError(onUnloaded);
    return () => {
      m.events.removeUserLoaded(onLoaded);
      m.events.removeUserUnloaded(onUnloaded);
      m.events.removeSilentRenewError(onUnloaded);
    };
  }, []);

  return <AuthContext.Provider value={{ user, loading, config }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
