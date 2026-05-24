#!/usr/bin/env bash
set -euo pipefail

exec bash scripts/ci-smoke-test.sh "$@"
