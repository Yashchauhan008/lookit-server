#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Building & pushing yashchauhan008/lookit-server:latest"
docker buildx build \
  --platform linux/amd64 \
  -f Dockerfile \
  -t yashchauhan008/lookit-server:latest \
  --push .

echo "Pushed. On VPS pull lookit-server and restart api/worker."
