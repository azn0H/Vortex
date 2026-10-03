# Czech TOTP text and optional persistent sign-in

## Deployment state

Prepared on 2026-10-03 for Authentik 2026.5.0. The custom image built successfully over the official `ghcr.io/goauthentik/server:2026.5.0` image and the resulting Czech module passed `node --check`. It has not yet been deployed on Raspberry. The optional 90-day sign-in setting has not yet been saved in the production administration interface.

The vendor Czech catalog is missing these two TOTP messages: `Type an authentication code...` and `Open your authenticator app to retrieve a one-time use code.` The patch adds real translations to the locale module, including the input placeholder and accessible helper text. It also explains the planned 90-day choice on the native User Login stage. Other locales, authentication handlers, MFA validation, credentials, and cookie code are unchanged.

The build locates the Czech module by the source map's `locales/cs-CZ.ts` source and checks the `templates` export. A changed vendor structure fails the build and requires review. The version tested locally is 2026.5.0 on Linux amd64; the Dockerfile uses the base image for the build host's architecture, so Raspberry builds use the vendor arm64 image. Retest after an Authentik upgrade.

## Native opt-in setting

After an administrator reviews and approves the longer session lifetime, edit **Flows and Stages → Stages → default-authentication-login**:

- **Session duration:** `seconds=0` (the normal browser-session default).
- **Stay signed in offset / Remember me offset:** `days=90`.
- Leave network/GeoIP binding, termination of other sessions, and known-device settings as configured.

Keep **default-authentication-mfa-validation → Last validation threshold** at `seconds=0` and keep its existing required-MFA policy. The feature is a persistent authenticated session, not a permanent bypass of MFA. After successful password and TOTP validation, Authentik presents its native **Zůstat přihlášen na tomto zařízení?** choice. **Ano** creates a persistent session for 90 days, **Ne** retains the normal browser-session lifetime. New browsers, expired sessions, revoked sessions, and manual logout require authentication again. The same login stage is used by enrollment, so newly registered users see the choice after email verification and TOTP setup.

An opted-in browser retains access to the account without re-entering credentials while the session is valid. Use **Ne** on shared devices. Manual logout must continue to terminate the main Authentik session using the provider's User Logout flow.

The translated 90-day explanation must match the configured offset. If the duration changes, update the translation too.

## Deploy the translation on Raspberry

From the current `codex/typographic-portal` checkout:

```bash
git pull --ff-only origin codex/typographic-portal
docker compose --env-file .env.production \
  -f docker-compose.yml -f docker-compose.authentik-localization.yml \
  up -d --build --no-deps authentik-server authentik-worker
```

This restarts the Authentik server and worker using the same version with the patched Czech catalog. It preserves their existing environment, volumes, databases, and flow settings. Use both Compose files in subsequent full-stack updates to retain this localization. Rebuilding only Vortex's `web` service does not apply it. Reload the authentication page without cache after deployment because the vendor locale asset keeps its original URL.

Verify Czech placeholder/help text, the Ano/Ne choice, both session-lifetime choices, and fresh password + TOTP after manual logout. Test actual persistence in the owner-controlled browser; the full 90-day elapsed period cannot be checked during setup.

## Rollback

Set the login stage's offset back to `seconds=0` to hide the choice. This prevents future persistent sessions; it does not revoke sessions already created, which can be removed through Authentik's session administration.

Restore the official frontend catalog by recreating just the Authentik services with the base Compose file:

```bash
docker compose --env-file .env.production -f docker-compose.yml \
  up -d --no-deps authentik-server authentik-worker
```

## References

- [Authentik 2026.5 User Login stage](https://version-2026-5.goauthentik.io/add-secure-apps/flows-stages/stages/user_login/)
- [Authentik translation workflow](https://docs.goauthentik.io/developer-docs/translation/)
- [Vendor Czech catalog for 2026.5.0](https://github.com/goauthentik/authentik/blob/version/2026.5.0/web/xliff/cs-CZ.xlf)
