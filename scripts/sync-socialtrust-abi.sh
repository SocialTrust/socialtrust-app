#!/usr/bin/env bash
set -euo pipefail

CONTRACTS_DIR="${1:-../socialtrust-contracts}"
ARTIFACT="$CONTRACTS_DIR/out/SocialTrust.sol/SocialTrust.json"
TARGET="src/contracts/abis/SocialTrust.json"

if [[ ! -f "$ARTIFACT" ]]; then
  echo "Foundry artifact not found: $ARTIFACT" >&2
  echo "Run 'forge build' in the contracts repo first, or pass the contracts repo path as the first argument." >&2
  exit 1
fi

mkdir -p "$(dirname "$TARGET")"
jq '.abi' "$ARTIFACT" > "$TARGET"
echo "Synced SocialTrust ABI -> $TARGET"
