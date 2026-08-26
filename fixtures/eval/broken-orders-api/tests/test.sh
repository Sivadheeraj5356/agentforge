#!/bin/bash
set -euo pipefail
cd /workspace
python -m pytest /hidden/tests/test_orders.py -q
