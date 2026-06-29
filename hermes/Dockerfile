FROM nousresearch/hermes-agent:latest

ENV HERMES_HOME=/opt/data

COPY seed/ /seed/
COPY scripts/bootstrap-seed.sh /etc/cont-init.d/99-saahomes-bootstrap
COPY scripts/sync-telegram-auth.sh /usr/local/bin/sync-telegram-auth.sh
COPY scripts/sync-telegram-auth.py /usr/local/bin/sync-telegram-auth.py
COPY scripts/repair-telegram.sh /usr/local/bin/repair-telegram.sh
COPY scripts/repair-browserbase.sh /usr/local/bin/repair-browserbase.sh
COPY scripts/fix-gsc-credentials-ownership.sh /usr/local/bin/fix-gsc-credentials-ownership.sh
COPY scripts/send-social-post-pack.py /usr/local/bin/send-social-post-pack.py
COPY scripts/send-operator-weekly-email.py /usr/local/bin/send-operator-weekly-email.py
RUN chmod +x /etc/cont-init.d/99-saahomes-bootstrap /usr/local/bin/sync-telegram-auth.sh /usr/local/bin/repair-telegram.sh /usr/local/bin/repair-browserbase.sh /usr/local/bin/fix-gsc-credentials-ownership.sh /usr/local/bin/send-social-post-pack.py /usr/local/bin/send-operator-weekly-email.py

# Official image entrypoint (/init + main-wrapper) supervises gateway + dashboard via s6.
CMD ["gateway", "run"]
