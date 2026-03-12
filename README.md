# The Indie App - RSS Feed

YouTube video notes → RSS feed, hosted on `myfeed.theindie.app`

## What This Does

Converts markdown files from `youtube-to-epub-runner` output into a clean RSS feed and browsable website.

**Features:**
- Generates RSS feed from markdown files
- Creates HTML article pages
- Clean landing page with article list
- Ready for Cloudflare Pages deployment

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/trungluong/clawd/projects/theindie-feed
npm install
```

### 2. Generate Feed

```bash
npm run build
```

This will:
- Scan `/Users/trungluong/clawd/output/` for markdown files
- Generate `public/feed.xml`
- Generate `public/index.html`
- Create `public/articles/*.html` for each note

### 3. Preview Locally

```bash
npm run dev
```

Opens `index.html` in your browser.

## Deployment to Cloudflare Pages

### Step 1: Create GitHub Repository

```bash
cd /Users/trungluong/clawd/projects/theindie-feed
git init
git add .
git commit -m "Initial commit: RSS feed generator"
git branch -M main
git remote add origin https://github.com/<your-username>/theindie-feed.git
git push -u origin main
```

### Step 2: Connect Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Click **Create a project**
3. **Connect to Git** → Select your GitHub account
4. Choose repository: `theindie-feed`
5. **Build settings:**
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `public`
6. Click **Save and Deploy**

### Step 3: Configure Custom Domain

1. After deployment, go to **Custom domains**
2. Click **Set up a custom domain**
3. Enter: `myfeed.theindie.app`
4. Cloudflare will auto-configure DNS (since domain is already on Cloudflare)
5. Wait 1-2 minutes for SSL certificate

Done! Your feed will be live at:
- 🌐 Site: https://myfeed.theindie.app
- 📡 RSS: https://myfeed.theindie.app/feed.xml

## Usage

### Adding New Content (Automated)

**The feed auto-updates whenever you convert a YouTube video!**

The `youtube-to-epub-runner` skill automatically triggers `update-feed.sh` after generating markdown.

Just convert a YouTube video as usual:
```bash
/Users/trungluong/clawd/skills/private/youtube-to-epub-runner/scripts/run_youtube_to_epub.sh "https://youtube.com/watch?v=..."
```

The script will:
1. ✅ Generate markdown → `/Users/trungluong/clawd/output/`
2. ✅ Copy to Obsidian inbox
3. ✅ Regenerate RSS feed
4. ✅ Commit & push to GitHub
5. ✅ Cloudflare auto-deploys (~1 min)

### Manual Update

If you need to manually regenerate the feed:
```bash
cd ~/projects/theindie-feed
./update-feed.sh
```

This script:
- Regenerates feed from all markdown files in `/Users/trungluong/clawd/output/`
- Only commits if there are actual changes
- Auto-pushes to GitHub
- Triggers Cloudflare deployment

## Configuration

Edit `generate-feed.js` to customize:

```javascript
const CONFIG = {
  sourceDir: '/Users/trungluong/clawd/output',  // Where markdown files are
  outputDir: './public',                         // Output directory
  feedTitle: 'The Indie App - YouTube Notes',   // Feed title
  feedDescription: '...',                        // Feed description
  siteUrl: 'https://myfeed.theindie.app',       // Your site URL
  maxItems: 50,                                  // Max items in RSS
};
```

## File Structure

```
theindie-feed/
├── generate-feed.js      # RSS generator script
├── package.json          # Dependencies
├── README.md             # This file
└── public/               # Output (auto-generated)
    ├── index.html        # Landing page
    ├── feed.xml          # RSS feed
    ├── style.css         # Styles
    └── articles/         # HTML articles
        ├── video-1.html
        └── video-2.html
```

## Frontmatter Support

Add metadata to markdown files for better RSS:

```markdown
---
title: "Video Title"
date: 2026-03-12
url: "https://youtube.com/watch?v=..."
tags: ["ai", "automation"]
---

# Video Title

Content here...
```

If no frontmatter, the script extracts:
- Title: First H1 heading or filename
- Date: File modification time
- Tags: Empty

## Troubleshooting

**No articles showing up?**
- Check `/Users/trungluong/clawd/output/` has `.md` files
- Run `npm run build` to regenerate
- Check console for errors

**Build fails on Cloudflare?**
- Ensure `package.json` is committed
- Check build logs in Cloudflare dashboard
- Verify Node.js version (16+)

**Feed not updating?**
- Make sure you committed `public/` folder
- Cloudflare auto-deploys on push to `main`
- Check deployment status in dashboard

## Next Steps (Optional)

- [ ] Add search functionality
- [ ] Email newsletter integration (Buttondown)
- [ ] Analytics (Cloudflare Web Analytics)
- [ ] Dark mode toggle
- [ ] Filter by tags/topics
- [ ] Auto-post to social when new article added

## License

MIT
