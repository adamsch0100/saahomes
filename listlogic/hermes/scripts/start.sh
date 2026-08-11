#!/bin/sh
set -eu

/usr/local/bin/bootstrap-seed.sh 2>/dev/null || sh /etc/cont-init.d/99-listlogic-bootstrap
exec hermes gateway run
