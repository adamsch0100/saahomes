#!/bin/sh
set -eu

/usr/local/bin/bootstrap-seed.sh
exec hermes gateway run
