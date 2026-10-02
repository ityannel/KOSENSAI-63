#!/usr/bin/env bash
# Cloudflare Pages（https://hakodate-kosensai.pages.dev/）に site/ を公開する。
# README.md と *.py は出さない（firebase.json の ignore と同じ）。wrangler は v3 を使う（v4 は workers.dev に出そうとする）
set -e
cd "$(dirname "$0")/.."
OUT="$(mktemp -d)"
cp -r site/. "$OUT"
find "$OUT" \( -name "README.md" -o -name "*.py" \) -delete
cd "$OUT"
npx --yes wrangler@3 pages deploy . --project-name hakodate-kosensai --branch main --commit-dirty=true
