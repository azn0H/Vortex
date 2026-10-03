# Vortex sign-in branding

`vortex-flow.css` matches the portal's typographic design: paper background, brick-red poster and buttons, Vortex / Metafra wordmark, system fonts, square controls, and a stacked mobile layout. It styles Authentik's existing flow components and does not replace its forms or authentication code.

The stylesheet was applied to the production default brand through the Authentik 2026.5.0 admin interface on 2026-10-03. This is database configuration, so a Docker rebuild or repository pull does not apply it to a different instance.

## Apply to another instance

1. Open **System → Brands** and edit the brand used on the authentication hostname.
2. Expand **Branding settings**, set **Title** to `Vortex · Metafra`, and paste the complete contents of `vortex-flow.css` into **Custom CSS**. Save.
3. Open **Flows and Stages → Flows → default-authentication-flow** and edit only the displayed **Title** to `Přihlášení.`. Keep the flow name, slug, stage bindings, policies, and authentication requirements as configured.
4. Reload a flow page and check identification, password, and TOTP on desktop and mobile. Flow pages use the light paper palette independently of the admin interface's theme.

The CSS is injected into Authentik component shadow roots. Rules use flow-specific hosts and exposed locale parts so the layout does not restyle the admin dashboard. The wordmark and poster text are decorative CSS content; form labels, error messages, keyboard focus, language selection, and submit controls remain Authentik's actual elements. The default background image is covered by the paper/poster layout; its stored asset path is retained.

## Restore the previous appearance

In the same brand, clear **Custom CSS** and restore **Title** to `authentik`. Restore the authentication flow's displayed title to `Welcome to authentik!`. The existing logo, favicon, and background paths remain available:

```text
Logo: /static/dist/assets/icons/icon_left_brand.svg
Favicon: /static/dist/assets/icons/icon.png
Default flow background: /static/dist/assets/images/flow_background.jpg
```

## Validation

The flow executor fills its available width without a 1600 px cap. After fixing background exposure on wider screens, the production TOTP layout was visually checked at 1920 × 1080 and 2560 × 1440: its left edge was 0 and its right edge matched the viewport, with no horizontal overflow or exposed forest background. The 390 px mobile layout was also rechecked after this fix.

The production identification, password, and TOTP steps were visually inspected. Identification and TOTP were also checked at a 390 px browser viewport: the layout stacked vertically without horizontal overflow, and the language selector did not overlap the wordmark. The final TOTP label, input, and button were checked in their nested component; computed styles confirmed the paper palette, a 16 px input, and a 50 px minimum button height. Visible focus indicators were inspected; reduced-motion rules are included but were not exercised with an emulated preference.

The owner completed a password + TOTP sign-in successfully during this change. The final nested TOTP styling was then saved and visually verified in a fresh sign-in. This branding change does not modify MFA validation, stage bindings, or authentication policies. Rejection of invalid codes, recovery codes, and enrollment of new users were outside this visual check.

Retest after Authentik upgrades: component class names and shadow-root structure can change. See the official [branding](https://docs.goauthentik.io/customize/branding/) and [custom CSS](https://version-2026-2.goauthentik.io/brands/custom-css/) documentation.
