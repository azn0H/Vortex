ARG AUTHENTIK_TAG=2026.5.0
FROM ghcr.io/goauthentik/server:${AUTHENTIK_TAG}

USER 0
COPY patch-czech.py /tmp/vortex-patch-czech.py
RUN python /tmp/vortex-patch-czech.py /web/dist && rm /tmp/vortex-patch-czech.py
USER 1000
