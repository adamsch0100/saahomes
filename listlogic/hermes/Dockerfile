# Pin: same base as SAA Hermes (Telegram stream fix).
FROM nousresearch/hermes-agent:v2026.7.20

ENV HERMES_HOME=/opt/data
ENV PYTHONPATH=/usr/local/bin

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip \
    && python3 -m venv /opt/listlogic-venv \
    && /opt/listlogic-venv/bin/pip install --no-cache-dir \
        google-api-python-client \
        google-auth-oauthlib \
        google-auth-httplib2 \
        pyyaml \
    && ln -sf /opt/listlogic-venv/bin/python3 /usr/local/bin/listlogic-python3 \
    && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/listlogic-venv/bin:${PATH}"

COPY seed/ /seed/
COPY scripts/bootstrap-seed.sh /etc/cont-init.d/99-listlogic-bootstrap
COPY scripts/bootstrap-seed.sh /usr/local/bin/bootstrap-seed.sh
COPY scripts/sync-telegram-auth.sh /usr/local/bin/sync-telegram-auth.sh
COPY scripts/sync-telegram-auth.py /usr/local/bin/sync-telegram-auth.py
COPY scripts/repair-telegram.sh /usr/local/bin/repair-telegram.sh
COPY scripts/fetch-page-audit.py /usr/local/bin/fetch-page-audit.py
COPY scripts/harvest_prospects.py /usr/local/bin/harvest_prospects.py
COPY scripts/start.sh /usr/local/bin/start.sh
RUN chmod +x /etc/cont-init.d/99-listlogic-bootstrap \
    /usr/local/bin/bootstrap-seed.sh \
    /usr/local/bin/sync-telegram-auth.sh \
    /usr/local/bin/repair-telegram.sh \
    /usr/local/bin/fetch-page-audit.py \
    /usr/local/bin/harvest_prospects.py \
    /usr/local/bin/start.sh

CMD ["gateway", "run"]
