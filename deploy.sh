#!/bin/bash
# KairosLab Virtual Office — Deploy script
# Usage: bash deploy.sh "commit message"
# Or just: bash deploy.sh (auto-generates message with date)

cd "$(dirname "$0")"

MSG="${1:-"Update $(date +%Y-%m-%d_%H:%M)"}"

echo "🔍 Running smoke test first..."
node -e "require('dotenv').config({path:'backend/.env'})" 2>/dev/null
export $(grep -E '^API_SECRET=' backend/.env | xargs)
node backend/smoke-test.js
if [ $? -ne 0 ]; then
    echo "❌ Smoke test failed. Fix errors before deploying."
    exit 1
fi

echo "📦 Staging all changes..."
git add -A

echo "📝 Committing: $MSG"
git commit -m "$MSG"

echo "🚀 Pushing to origin/main..."
git push origin main

echo "✅ Deploy complete."
