FROM nousresearch/hermes-agent:latest

COPY seed/ /seed/
COPY scripts/bootstrap-seed.sh /usr/local/bin/bootstrap-seed.sh
COPY scripts/start.sh /usr/local/bin/start-hermes.sh
RUN chmod +x /usr/local/bin/bootstrap-seed.sh /usr/local/bin/start-hermes.sh

CMD ["/usr/local/bin/start-hermes.sh"]
