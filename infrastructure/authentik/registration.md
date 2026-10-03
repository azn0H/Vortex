# Vortex self-service registration

## Current deployment state

Published in the production Authentik 2026.5.0 admin interface on 2026-10-03 after owner confirmation. The `vortex-registration` enrollment flow requires an unauthenticated user (`require_unauthenticated`) and is linked as the enrollment flow of `default-authentication-identification`.

After publication, a logged-out portal sign-in showed the **Zaregistrovat se.** link. Following it opened the four-field registration form without a privileged session. No additional account was created during this anonymous availability check.

The owner supplied the SMTP password directly and confirmed receipt of the registration email. The resulting test account was observed as inactive before email verification, with external user type, no group memberships, no assigned roles, and no superuser status. After the owner followed the verification link in Brave, the account became active and its TOTP authenticator was observed as confirmed. Registration established a session, but the test flow's explicit return URL led to Authentik's internal interface, which correctly denied the external account.

The default brand's external-user default application was subsequently set to **Vortex Portal**. This redirects external users to the portal when no other application is requested, without granting access to Authentik's internal interface. The owner confirmed portal access with the resulting ordinary-user account.

This is database configuration. Pulling the repository or rebuilding Vortex does not apply these settings to another Authentik instance. SMTP credentials are entered by the owner in Authentik and are not stored in this repository.

## Flow

| Order | Stage | Settings |
| --- | --- | --- |
| 10 | `vortex-registration-prompt` | Four required fields: unique username, email, password, password confirmation. Uses `default-password-change-password-policy`. |
| 20 | `vortex-registration-write` | Always create a new user, initially inactive. External user type, path `users/public`, no assigned group. |
| 30 | `vortex-registration-email` | Account Confirmation template, activate the pending user after verification, token lifetime `minutes=30`. |
| 40 | `default-authenticator-totp-setup` | Configure and verify a six-digit TOTP authenticator before establishing a session. |
| 100 | `default-authentication-login` | Establish the session only after previous stages succeed. |

The shared password policy requires at least eight characters and a zxcvbn score above two. Have I Been Pwned checks are disabled. The password confirmation fields must match.

The enrollment flow has no stage-skipping policy bindings. The existing authentication flow continues to enforce MFA. An abandoned registration before email verification leaves an inactive account; an account activated by email still needs TOTP to finish enrollment or sign in through the existing authentication flow.

## Email transport

- SMTP host: `smtp.seznam.cz`
- Port: `465`
- SSL: enabled; STARTTLS: disabled
- Username and sender: `noreply@aznoh.cz`
- Subject: `Ověření účtu Vortex`
- Use global connection settings: disabled
- SMTP password: supplied directly by the owner in Authentik

The Email stage's recovery-attempt settings apply to recovery flows, not enrollment spam protection. They must not be treated as a signup rate limit.

## Access boundary

Public registration must not assign administrator groups or roles. The existing `Vortex Roles` scope mapping emits the names of the user's Authentik groups. The Vortex Portal application currently has no policy/group/user restrictions in Authentik, so a newly registered user can authenticate to the portal. Vortex then filters its application list by public access mode, explicit user grants, or role grants; public-mode applications are available to every authenticated portal user.

Before exposing registration, verify email delivery, rejection of unverified accounts, TOTP enrollment, and the resulting user's lack of administrator privileges. Check application grants against the deployed version as well as Authentik's configuration.

## Public activation and rollback

To reproduce the public configuration, set the flow authentication requirement to `require_unauthenticated` and select this enrollment flow in the flow settings of `default-authentication-identification`. Check the signup link from a logged-out browser and complete a new-user enrollment. The Authentik 2026.5.0 brand editor does not expose an enrollment-flow selector; the identification-stage link is used.

To close registration, remove the identification-stage enrollment link and restore `require_superuser` on this flow. This preserves existing accounts, email verification, and MFA. Do not delete shared login or TOTP stages. The external-user default application can remain set to Vortex so existing ordinary users continue to reach the portal.

## References

- [Seznam mail client settings](https://o-seznam.cz/napoveda/email/mohlo-by-se-hodit/postovni-programy-a-aplikace/)
- [Authentik Prompt stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/prompt/)
- [Authentik User Write stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/user_write/)
- [Authentik Email stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/email/)
- [Authentik TOTP setup stage](https://docs.goauthentik.io/add-secure-apps/flows-stages/stages/authenticator_totp/)
