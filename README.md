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

## Run Authentik locally

```text
powershell -ExecutionPolicy Bypass -File infrastructure/authentik/setup.ps1 -Start
```

See `infrastructure/authentik/README.md` for the first-run OIDC provider configuration and the local API and portal settings.

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
