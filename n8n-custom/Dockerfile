FROM n8nio/n8n:2.6.4

USER root

# Download the static apk binary
RUN wget https://gitlab.alpinelinux.org/api/v4/projects/5/packages/generic/v2.14.4/x86_64/apk.static && \
    chmod +x apk.static && \
    # Point explicitly to v3.19 repositories to avoid the Alpine 3.23 breaking changes
    ./apk.static -X http://dl-cdn.alpinelinux.org/alpine/v3.19/main \
                 -X http://dl-cdn.alpinelinux.org/alpine/v3.19/community \
                 -U --allow-untrusted --initdb add poppler-utils && \
    rm apk.static

USER node