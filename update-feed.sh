#!/bin/bash
# Auto-update RSS feed and deploy to GitHub

set -e

cd "$(dirname "$0")"

echo "🔄 Regenerating RSS feed from markdown files..."
npm run build

echo ""
echo "📝 Checking for changes..."
if git diff --quiet public/; then
  echo "✅ No changes detected. Feed is up to date."
  exit 0
fi

echo ""
echo "📦 Changes detected. Committing..."
git add public/

# Generate commit message based on changes
ARTICLE_COUNT=$(find public/articles -name "*.html" | wc -l | xargs)
COMMIT_MSG="Update feed: ${ARTICLE_COUNT} articles ($(date '+%Y-%m-%d %H:%M'))"

git commit -m "$COMMIT_MSG"

echo ""
echo "🚀 Pushing to GitHub..."
git push

echo ""
echo "✅ Done! Cloudflare will auto-deploy in ~1 minute."
echo "   Feed: https://myfeed.theindie.app/feed.xml"
echo "   Site: https://myfeed.theindie.app"
