#!/bin/bash
# Auto-update RSS feed, commit the generated output, and deploy to Cloudflare Pages

set -e

cd "$(dirname "$0")"

echo "🔄 Regenerating RSS feed from markdown files..."
npm run build

echo ""
echo "📝 Checking for changes..."
if git diff --quiet -- generate-feed.js update-feed.sh public/; then
  echo "✅ No changes detected. Feed is up to date."
  exit 0
fi

echo ""
echo "📦 Changes detected. Committing..."
git add generate-feed.js update-feed.sh public/

# Generate commit message based on changes
ARTICLE_COUNT=$(find public/articles -name "*.html" | wc -l | xargs)
COMMIT_MSG="Update feed: ${ARTICLE_COUNT} articles ($(date '+%Y-%m-%d %H:%M'))"

git commit -m "$COMMIT_MSG"

echo ""
echo "🚀 Pushing to GitHub..."
git push

echo ""
echo "☁️  Deploying to Cloudflare Pages..."
npx wrangler pages deploy public --project-name "${CLOUDFLARE_PAGES_PROJECT:-theindie-feed}" --branch "${CLOUDFLARE_PAGES_BRANCH:-main}"

echo ""
echo "✅ Done! Feed has been pushed and deployed."
echo "   Feed: https://myfeed.theindie.app/feed.xml"
echo "   Site: https://myfeed.theindie.app"
