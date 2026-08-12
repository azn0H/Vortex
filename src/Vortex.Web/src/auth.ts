import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";

const runtimeConfig = window.__VORTEX_CONFIG__;
const authority = runtimeConfig?.oidcAuthority ?? import.meta.env.VITE_OIDC_AUTHORITY;
const clientId = runtimeConfig?.oidcClientId ?? import.meta.env.VITE_OIDC_CLIENT_ID;
const scope = runtimeConfig?.oidcScope ?? import.meta.env.VITE_OIDC_SCOPE;

export const rolesClaimType = runtimeConfig?.oidcRolesClaim ?? import.meta.env.VITE_OIDC_ROLES_CLAIM ?? "roles";

export const userManager = new UserManager({
  authority,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/auth/callback`,
  silent_redirect_uri: `${window.location.origin}/auth/silent`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true
});

export async function getActiveUser(): Promise<User | null> {
  const user = await userManager.getUser();
  return user?.expired ? null : user;
}

export async function beginSignIn(): Promise<void> {
  await userManager.signinRedirect();
}

export async function completeSignIn(): Promise<void> {
  await userManager.signinRedirectCallback();
}

export async function completeSilentSignIn(): Promise<void> {
  await userManager.signinSilentCallback();
}

export async function signOut(): Promise<void> {
  await userManager.removeUser();
  await userManager.clearStaleState();
  window.location.assign(window.location.origin);
}

export function rolesFromUser(user: User | null): string[] {
  const claim = user?.profile[rolesClaimType];

  if (typeof claim === "string") {
    return [claim];
  }

  if (Array.isArray(claim)) {
    return claim.filter((value): value is string => typeof value === "string");
  }

  return [];
}
