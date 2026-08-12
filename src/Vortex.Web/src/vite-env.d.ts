interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_OIDC_AUTHORITY: string;
  readonly VITE_OIDC_CLIENT_ID: string;
  readonly VITE_OIDC_SCOPE: string;
  readonly VITE_OIDC_ROLES_CLAIM: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __VORTEX_CONFIG__?: {
    apiUrl?: string;
    oidcAuthority?: string;
    oidcClientId?: string;
    oidcScope?: string;
    oidcRolesClaim?: string;
  };
}
