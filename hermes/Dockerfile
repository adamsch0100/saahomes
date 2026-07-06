FROM nousresearch/hermes-agent:latest

ENV HERMES_HOME=/opt/data
ENV PYTHONPATH=/usr/local/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg nodejs python3-pip \
    && python3 -m pip install --no-cache-dir --break-system-packages \
        google-api-python-client \
        google-auth-oauthlib \
        google-auth-httplib2 \
        yt-dlp \
    && rm -rf /var/lib/apt/lists/*

COPY seed/ /seed/
COPY assets/ /seed/assets/
COPY scripts/bootstrap-seed.sh /etc/cont-init.d/99-saahomes-bootstrap
COPY scripts/sync-telegram-auth.sh /usr/local/bin/sync-telegram-auth.sh
COPY scripts/sync-telegram-auth.py /usr/local/bin/sync-telegram-auth.py
COPY scripts/repair-telegram.sh /usr/local/bin/repair-telegram.sh
COPY scripts/repair-browserbase.sh /usr/local/bin/repair-browserbase.sh
COPY scripts/fix-gsc-credentials-ownership.sh /usr/local/bin/fix-gsc-credentials-ownership.sh
COPY scripts/send-social-post-pack.py /usr/local/bin/send-social-post-pack.py
COPY scripts/send-operator-weekly-email.py /usr/local/bin/send-operator-weekly-email.py
COPY scripts/fetch-page-audit.py /usr/local/bin/fetch-page-audit.py
COPY scripts/youtube_auth.py /usr/local/bin/youtube_auth.py
COPY scripts/upload-youtube-video.py /usr/local/bin/upload-youtube-video.py
COPY scripts/remux-video-music.py /usr/local/bin/remux-video-music.py
COPY scripts/run-video-music-remediation.py /usr/local/bin/run-video-music-remediation.py
COPY scripts/audit-video-volume.py /usr/local/bin/audit-video-volume.py
COPY scripts/youtube-oauth-setup.py /usr/local/bin/youtube-oauth-setup.py
COPY scripts/download-audiolibrary-tracks.py /usr/local/bin/download-audiolibrary-tracks.py
COPY scripts/audit-youtube-channel.py /usr/local/bin/audit-youtube-channel.py
COPY scripts/set-youtube-privacy.py /usr/local/bin/set-youtube-privacy.py
COPY scripts/run-live-youtube-remediation.sh /usr/local/bin/run-live-youtube-remediation.sh
RUN chmod +x /etc/cont-init.d/99-saahomes-bootstrap \
    /usr/local/bin/sync-telegram-auth.sh \
    /usr/local/bin/repair-telegram.sh \
    /usr/local/bin/repair-browserbase.sh \
    /usr/local/bin/fix-gsc-credentials-ownership.sh \
    /usr/local/bin/send-social-post-pack.py \
    /usr/local/bin/send-operator-weekly-email.py \
    /usr/local/bin/fetch-page-audit.py \
    /usr/local/bin/upload-youtube-video.py \
    /usr/local/bin/remux-video-music.py \
    /usr/local/bin/run-video-music-remediation.py \
    /usr/local/bin/audit-video-volume.py \
    /usr/local/bin/youtube-oauth-setup.py \
    /usr/local/bin/download-audiolibrary-tracks.py \
    /usr/local/bin/audit-youtube-channel.py \
    /usr/local/bin/set-youtube-privacy.py \
    /usr/local/bin/run-live-youtube-remediation.sh

# Official image entrypoint (/init + main-wrapper) supervises gateway + dashboard via s6.
CMD ["gateway", "run"]
