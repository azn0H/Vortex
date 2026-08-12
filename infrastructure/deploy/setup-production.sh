#!/usr/bin/env sh
set -eu

environment_file=".env.production"

if [ -f "$environment_file" ]; then
  echo "$environment_file already exists"
  exit 0
fi

if [ ! -f ".env.production.example" ]; then
  echo ".env.production.example was not found"
  exit 1
fi

cp .env.production.example "$environment_file"

app_password="$(openssl rand -base64 36 | tr -d '\n')"
authentik_password="$(openssl rand -base64 36 | tr -d '\n')"
authentik_key="$(openssl rand -base64 60 | tr -d '\n')"

sed -i "s|^APP_POSTGRES_PASSWORD=$|APP_POSTGRES_PASSWORD=$app_password|" "$environment_file"
sed -i "s|^AUTHENTIK_POSTGRES_PASSWORD=$|AUTHENTIK_POSTGRES_PASSWORD=$authentik_password|" "$environment_file"
sed -i "s|^AUTHENTIK_SECRET_KEY=$|AUTHENTIK_SECRET_KEY=$authentik_key|" "$environment_file"

chmod 600 "$environment_file"
echo "Created $environment_file. Set APP_DOMAIN, AUTHENTIK_DOMAIN, ACME_EMAIL, and VORTEX_OIDC_CLIENT_ID before deployment."
