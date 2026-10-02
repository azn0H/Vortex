# Authentik local deployment

Run the setup script from the repository root:

```text
powershell -ExecutionPolicy Bypass -File infrastructure/authentik/setup.ps1 -Start
```

The script creates `infrastructure/authentik/.env` with random PostgreSQL and Authentik secrets. This file is ignored by Git. Authentik is available at `http://localhost:9000/` after the containers become healthy.

Complete the initial `akadmin` password setup in the browser. Then create an OAuth2/OpenID Provider for the Vortex portal with authorization-code flow and these redirect URIs:

```text
http://localhost:5173/auth/callback
http://localhost:5173/auth/silent
```

Set the provider's issuer to `http://localhost:9000/application/o/vortex/` and use the same authority in both application configurations. Add the resulting OAuth client ID to the portal `.env` file. Configure an Authentik scope mapping that emits a `roles` claim, and grant `platform-admin` to access administrators.

Register `http://localhost:5173` as a post-logout redirect URI (`http://localhost:3000` for the unified development stack). Bind a [User Logout stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/user_logout/) to the provider invalidation flow so logout ends the main Authentik session as well as the application's session. In production register the HTTPS portal origin. Verify logout and a fresh sign-in on the actual provider after deployment.

Use these local development settings after the provider is created:

```text
VITE_API_URL=https://localhost:5001
VITE_OIDC_AUTHORITY=http://localhost:9000/application/o/vortex/
VITE_OIDC_CLIENT_ID=<authentik-client-id>
VITE_OIDC_SCOPE=openid profile email
VITE_OIDC_ROLES_CLAIM=roles
```

```text
Identity__Authority=http://localhost:9000/application/o/vortex/
Identity__ApiAudience=vortex-api
Identity__RolesClaimType=roles
Identity__AdministratorRole=platform-admin
```
