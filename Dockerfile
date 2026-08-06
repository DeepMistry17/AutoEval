# Stage 1: Get the standalone, static package manager from Alpine
FROM alpine:latest AS alpine
RUN apk update && apk add --no-cache apk-tools-static

# Stage 2: Build your custom n8n production image
FROM docker.n8n.io/n8nio/n8n:latest

USER root

# Copy ONLY the static binary. It requires no extra libraries to run!
COPY --from=alpine /sbin/apk.static /sbin/apk

# Now that apk is temporarily restored, install the PDF tools
RUN apk update && apk add --no-cache poppler-utils

# Secure the container by switching back to the node user
USER node