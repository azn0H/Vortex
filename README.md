# Vortex

Vortex is an OIDC-protected application portal and ASP.NET Core API. It keeps identity, SSO, token issuance, and global roles in Authentik or Zitadel while PostgreSQL stores each application's public or restricted access configuration.

## Start PostgreSQL

```text
docker compose up -d
```

## Configure identity

Copy `src/Vortex.Web/.env.example` to `src/Vortex.Web/.env` and replace every identity value.

Set `Identity:Authority`, `Identity:ApiAudience`, and `Identity:RolesClaimType` in `src/Vortex.Api/appsettings.Development.json` through user secrets or environment variables. Do not commit production values or secrets.

Register the web portal as a public OIDC client using Authorization Code Flow with PKCE. Add these redirect URIs:

```text
http://localhost:5173/auth/callback
http://localhost:5173/auth/silent
```

Configure every API access token with `vortex-api` as its audience. Ensure the IdP emits the platform roles claim configured in `RolesClaimType`, including `platform-admin` for access administrators.

Register the portal origin (`http://localhost:5173` locally, or `https://APP_DOMAIN` in production) as the post-logout redirect URI. Logout uses the discovered OIDC end-session endpoint with the stored ID-token hint. For Authentik, bind a User Logout stage to the provider's invalidation flow so that RP-initiated logout also ends the main SSO session. Without that stage, Authentik can retain its global session even after the application session ends. See [Authentik single logout](https://docs.goauthentik.io/add-secure-apps/providers/single-logout/).

## Run Authentik locally

```text
powershell -ExecutionPolicy Bypass -File infrastructure/authentik/setup.ps1 -Start
```

See `infrastructure/authentik/README.md` for the first-run OIDC provider configuration and the local API and portal settings.

For the unified development stack, copy `.env.dev.example` to `.env.dev`. Populate its `AUTHENTIK_PG_PASS` from `PG_PASS` in `infrastructure/authentik/.env`, and copy the existing `AUTHENTIK_SECRET_KEY` and OAuth client ID. Then run:

```text
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build -d
```

The stack reuses existing Authentik volumes. Missing or empty identity secrets now prevent startup. If the old committed defaults were ever used, rotate the actual database password and Authentik key using a backed-up, planned Authentik maintenance procedure. Changing environment values alone does not change a password in an existing PostgreSQL volume. Never commit `.env.dev`, backups, or rotated secrets.

Development ports 3000, 5000, and 9000 bind to loopback. A cloudflared process on the same host can connect to them; a cloudflared container needs a Docker-network connection instead of a host loopback address. Production uses `docker-compose.yml`.

Forwarded headers are trusted only from the gateway: `172.30.241.2` (development Nginx) or `172.30.240.2` (production Caddy). The corresponding Docker networks reserve `.128/25` for dynamic containers so that the fixed gateway address remains available. If these subnets overlap another network, change the Compose subnet, gateway address, and `ReverseProxy__KnownProxies__0` together. Standalone API deployments keep loopback trust and can specify their real immediate proxy through `ReverseProxy:KnownProxies`; never trust an entire unverified forwarding chain.

## Deploy the complete stack to a Raspberry Pi

Install Docker Engine and Docker Compose on a 64-bit Raspberry Pi OS installation. Clone this repository to the Pi, then run:

```text
chmod +x infrastructure/deploy/setup-production.sh
./infrastructure/deploy/setup-production.sh
```

Set `APP_DOMAIN`, `AUTHENTIK_DOMAIN`, `ACME_EMAIL`, and the Authentik OAuth client ID in `.env.production`. Both domains must resolve publicly to the Pi and ports 80 and 443 must be reachable for automatic TLS certificates.

```text
docker compose --env-file .env.production up --build -d
```

The API, frontend, reverse proxy, Authentik, Redis, and both PostgreSQL instances run in this one Compose stack. Only Caddy exposes network ports. Store Compose volumes on an SSD and back up the PostgreSQL and Caddy volumes.

## Run the API

```text
dotnet ef database update --project src/Vortex.Api
dotnet run --project src/Vortex.Api
```

## Run the portal

```text
cd src/Vortex.Web
npm install
npm run dev
```

## Access model

Public applications are open to every authenticated user. Restricted applications require an explicit OIDC subject grant or a matching IdP role grant. The API evaluates that rule for every protected request, so removing a grant takes effect immediately. `platform-admin` can administer all applications and bypasses restricted application access.

`POST /api/apps/{key}/launch` checks that the application is enabled and the current user has access before recording a launch. It returns 401 for unauthenticated or missing-subject users, 404 for missing/disabled applications, and 403 for denied grants; denials do not create successful audit records. A launch audit records a client-reported event, not proof that the external application was visited. Integrated applications must enforce authorization on every protected request.

## Security regression checks

```text
dotnet run --project tests/Vortex.Security.Tests
cd src/Vortex.Web
npm ci
npm run build
```
