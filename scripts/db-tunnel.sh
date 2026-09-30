#!/usr/bin/env bash
# SSH tunnel to the test server's Postgres and Redis, for local dev against
# the real `logix` database without opening the ports to the internet.
# Usage: ./scripts/db-tunnel.sh   (Ctrl+C to close)
KEY="$(dirname "$0")/../planning/logix.pem"
HOST="ubuntu@ec2-16-16-187-248.eu-north-1.compute.amazonaws.com"
exec ssh -i "$KEY" -N \
  -L 15432:127.0.0.1:5432 \
  -L 16379:127.0.0.1:6379 \
  "$HOST"
