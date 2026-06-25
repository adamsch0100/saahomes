FROM nousresearch/hermes-agent:latest

COPY seed/ /seed/
COPY scripts/bootstrap-seed.sh /etc/cont-init.d/99-saahomes-bootstrap
COPY scripts/repair-telegram.sh /usr/local/bin/repair-telegram.sh
RUN chmod +x /etc/cont-init.d/99-saahomes-bootstrap /usr/local/bin/repair-telegram.sh

# Official image entrypoint (/init + main-wrapper) supervises gateway + dashboard via s6.
CMD ["gateway", "run"]
