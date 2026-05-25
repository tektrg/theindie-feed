#!/usr/bin/env node
/**
 * RSS Feed Generator for YouTube Video Notes
 * Scans markdown files from youtube-to-epub output and generates RSS feed
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt();

// Configuration
const CONFIG = {
  sourceDir: '/Users/trungluong/clawd/output',
  outputDir: './public',
  articlesDir: './public/articles',
  feedTitle: 'The Indie Feed',
  feedDescription: 'YouTube and web notes, distilled into a chronological digest.',
  siteUrl: 'https://myfeed.theindie.app',
  feedUrl: 'https://myfeed.theindie.app/feed.xml',
  author: 'Stv',
  maxItems: 50, // Max items in RSS feed
};

const THEME_BOOTSTRAP = `(function () {
  try {
    var storedTheme = localStorage.getItem('indie-feed-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') {
      document.documentElement.dataset.theme = storedTheme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  } catch (error) {}
})();`;

const THEME_CONTROL_SCRIPT = `(function () {
  var buttons = document.querySelectorAll('[data-theme-choice]');
  var root = document.documentElement;

  function applyTheme(theme) {
    if (theme === 'system') {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = theme;
    }

    buttons.forEach(function (button) {
      var isSelected = button.dataset.themeChoice === theme;
      button.setAttribute('aria-pressed', String(isSelected));
    });

    try {
      localStorage.setItem('indie-feed-theme', theme);
    } catch (error) {}
  }

  var initialTheme = 'system';
  try {
    var storedTheme = localStorage.getItem('indie-feed-theme');
    if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
      initialTheme = storedTheme;
    }
  } catch (error) {}

  applyTheme(initialTheme);

  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.dataset.themeChoice);
    });
  });
})();`;

function faviconLink(prefix) {
  return `<link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg">`;
}

// Ensure output directories exist
if (!fs.existsSync(CONFIG.outputDir)) {
  fs.mkdirSync(CONFIG.outputDir, { recursive: true });
}
if (!fs.existsSync(CONFIG.articlesDir)) {
  fs.mkdirSync(CONFIG.articlesDir, { recursive: true });
}

/**
 * Get all markdown files from source directory
 */
function getMarkdownFiles() {
  if (!fs.existsSync(CONFIG.sourceDir)) {
    console.warn(`Source directory not found: ${CONFIG.sourceDir}`);
    return [];
  }

  return fs.readdirSync(CONFIG.sourceDir)
    .filter(file => file.endsWith('.md'))
    .map(file => path.join(CONFIG.sourceDir, file));
}

/**
 * Parse markdown file and extract metadata
 */
function parseMarkdownFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data, content: markdownContent } = matter(content);

  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath, '.md');
  
  // Extract title (from frontmatter or first H1)
  let title = data.title || filename;
  const h1Match = markdownContent.match(/^#\s+(.+)$/m);
  if (!title && h1Match) {
    title = h1Match[1];
  }

  const displayMarkdown = cleanDisplayMarkdown(markdownContent);

  // Generate excerpt (first 200 chars of content, no markdown)
  const plainText = displayMarkdown
    .replace(/^#.+$/gm, '') // Remove headers
    .replace(/^---+$/gm, '') // Remove markdown dividers
    .replace(/!\[[^\]]*\]\([^\)]+\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links but keep text
    .replace(/[*_`>]/g, '') // Remove formatting
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = `${plainText.substring(0, 200).trim()}...`;

  return {
    filename,
    title,
    content: displayMarkdown,
    html: md.render(markdownContent),
    displayHtml: md.render(displayMarkdown),
    excerpt,
    pubDate: data.published || data.date || stats.mtime,
    url: data.source || data.url || '', // Original source URL if available
    tags: data.tags || [],
    sourceType: data.source_type || '',
    processed: data.processed || stats.mtime,
  };
}

function cleanDisplayMarkdown(markdownContent) {
  return markdownContent
    .replace(/^\s*\*\*🎥\s*Watch on YouTube:\*\*\s*\[[^\]]+\]\([^)]+\)\s*\n+(?:---\s*\n+)?/u, '')
    .replace(/^\s*🎥\s*Watch on YouTube:\s*\[[^\]]+\]\([^)]+\)\s*\n+(?:---\s*\n+)?/u, '')
    .replace(/^\s*🎥\s*Watch on YouTube:\s*.+\n+(?:---\s*\n+)?/u, '')
    .trim();
}

function cleanGeneratedArticles() {
  if (!fs.existsSync(CONFIG.articlesDir)) return;

  for (const filename of fs.readdirSync(CONFIG.articlesDir)) {
    if (filename.endsWith('.html')) {
      fs.rmSync(path.join(CONFIG.articlesDir, filename));
    }
  }
}

function normalizeSourceUrl(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    // Canonicalize YouTube links by video id
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host === 'music.youtube.com') {
      const videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
      return videoId ? `youtube:${videoId}` : `${host}${parsed.pathname}`;
    }

    parsed.hash = '';
    return `${host}${parsed.pathname}${parsed.search}`.replace(/\/$/, '');
  } catch {
    return url.trim();
  }
}

function dedupeArticles(articles) {
  const deduped = new Map();

  for (const article of articles) {
    const key = normalizeSourceUrl(article.url) || article.filename;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, article);
      continue;
    }

    const existingTime = new Date(existing.processed || existing.pubDate).getTime();
    const candidateTime = new Date(article.processed || article.pubDate).getTime();

    if (candidateTime >= existingTime) {
      deduped.set(key, article);
    }
  }

  return Array.from(deduped.values());
}

function formatDate(dateLike, options) {
  return new Date(dateLike).toLocaleDateString('en-US', options);
}

function sourceLabel(url) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host.includes('youtube.com') || host === 'youtu.be') {
      return 'Watch on YouTube';
    }

    return `Read at ${host}`;
  } catch {
    return 'Original source';
  }
}

function themeControl() {
  return `<div class="theme-control" aria-label="Theme preference">
        <span class="theme-control__label">Theme</span>
        <button type="button" data-theme-choice="system">System</button>
        <button type="button" data-theme-choice="light">Light</button>
        <button type="button" data-theme-choice="dark">Dark</button>
      </div>`;
}

function articleMeta(article, dateOptions) {
  const source = sourceLabel(article.url);
  const sourceMeta = source ? `<span>${escapeHtml(source)}</span>` : '';

  return `<div class="article-card__meta">
              <time datetime="${new Date(article.pubDate).toISOString()}">
                ${formatDate(article.pubDate, dateOptions)}
              </time>
              ${sourceMeta}
            </div>`;
}

function articleLink(article, className, innerHtml) {
  return `<a class="${className}" href="./articles/${article.filename}.html">${innerHtml}</a>`;
}

/**
 * Generate HTML article page
 */
function generateArticlePage(article) {
  const sourceCta = article.url
    ? `<a class="button-link" href="${escapeHtml(article.url)}" target="_blank" rel="noopener">${escapeHtml(sourceLabel(article.url))}</a>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)} - ${CONFIG.feedTitle}</title>
  <script>${THEME_BOOTSTRAP}</script>
  ${faviconLink('../')}
  <link rel="stylesheet" href="../style.css">
  <meta name="description" content="${escapeHtml(article.excerpt)}">
</head>
<body class="article-page">
  <header class="site-header">
    <nav class="topbar" aria-label="Article navigation">
      <a class="back-link" href="../index.html">Back to feed</a>
      <div class="topbar__actions">
        ${sourceCta}
        ${themeControl()}
      </div>
    </nav>
    <div class="article-masthead">
      <p class="kicker">The Indie Feed / Article</p>
      <h1>${escapeHtml(article.title)}</h1>
      <time datetime="${new Date(article.pubDate).toISOString()}">
        ${formatDate(article.pubDate, {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </time>
    </div>
  </header>
  <main>
    <article class="article-body">
      ${article.displayHtml || article.html}
    </article>
  </main>
  <footer>
    <p>End of article. Return to the chronological edition for the rest of the feed.</p>
  </footer>
  <script>${THEME_CONTROL_SCRIPT}</script>
</body>
</html>`;

  const filename = `${article.filename}.html`;
  fs.writeFileSync(path.join(CONFIG.articlesDir, filename), html);
  return filename;
}

/**
 * Generate RSS feed XML
 */
function generateRSSFeed(articles) {
  const items = articles
    .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
    .slice(0, CONFIG.maxItems)
    .map(article => {
      const articleUrl = `${CONFIG.siteUrl}/articles/${article.filename}.html`;
      return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${escapeXml(articleUrl)}</link>
      <guid>${escapeXml(articleUrl)}</guid>
      <pubDate>${new Date(article.pubDate).toUTCString()}</pubDate>
      <description><![CDATA[${article.excerpt}]]></description>
      <content:encoded><![CDATA[${article.html}]]></content:encoded>
      ${article.tags.map(tag => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
    </item>`;
    })
    .join('\n');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(CONFIG.feedTitle)}</title>
    <link>${CONFIG.siteUrl}</link>
    <description>${escapeXml(CONFIG.feedDescription)}</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${CONFIG.feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'feed.xml'), rss);
}

/**
 * Generate index.html landing page
 */
function generateIndexPage(articles) {
  const sortedArticles = [...articles].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const latestDate = sortedArticles[0]?.pubDate || new Date();
  const leadArticle = sortedArticles[0];
  const departmentArticles = sortedArticles.slice(1, 5);
  const archiveArticles = sortedArticles.slice(5);
  const leadStory = leadArticle ? `
      <section class="lead-story" aria-labelledby="lead-story-title">
        <p class="section-kicker">The Feed / Lead story</p>
        ${articleLink(leadArticle, 'lead-story__link', `
          ${articleMeta(leadArticle, {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          })}
          <h2 id="lead-story-title">${escapeHtml(leadArticle.title)}</h2>
          <p>${escapeHtml(leadArticle.excerpt)}</p>
        `)}
      </section>` : '';
  const departments = departmentArticles.length > 0 ? `
      <section class="departments" aria-labelledby="departments-title">
        <div class="section-rule">
          <h2 id="departments-title">Departments</h2>
        </div>
        <div class="department-grid">
          ${departmentArticles.map((article, index) => `
          <article class="department-card">
            ${articleLink(article, 'department-card__link', `
              <div class="department-card__number">No. ${String(index + 2).padStart(2, '0')}</div>
              ${articleMeta(article, {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
              <h3>${escapeHtml(article.title)}</h3>
              <p>${escapeHtml(article.excerpt)}</p>
            `)}
          </article>`).join('\n')}
        </div>
      </section>` : '';
  const articleList = archiveArticles
    .map((article, index) => `
      <li class="article-card article-card--compact">
        <a href="./articles/${article.filename}.html">
          <div class="article-card__number">${String(index + 6).padStart(2, '0')}</div>
          <div class="article-card__content">
            ${articleMeta(article, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
            <h2>${escapeHtml(article.title)}</h2>
            <p>${escapeHtml(article.excerpt)}</p>
          </div>
        </a>
      </li>
    `)
    .join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${CONFIG.feedTitle}</title>
  <script>${THEME_BOOTSTRAP}</script>
  ${faviconLink('./')}
  <link rel="stylesheet" href="./style.css">
  <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="${CONFIG.feedUrl}" />
  <meta name="description" content="${CONFIG.feedDescription}">
</head>
<body class="feed-page">
  <header class="site-header">
    <nav class="topbar" aria-label="Feed actions">
      <a class="brand-link" href="./index.html">myfeed.theindie.app</a>
      <div class="topbar__actions">
        <a class="button-link" href="${CONFIG.feedUrl}">RSS</a>
        ${themeControl()}
      </div>
    </nav>
    <div class="masthead">
      <div class="edition-strip">
        <span>Vol. I</span>
        <span>${sortedArticles.length} notes</span>
        <span>${formatDate(latestDate, {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })}</span>
      </div>
      <h1>The Indie Feed</h1>
      <p>${CONFIG.feedDescription}</p>
      <div class="edition-strip edition-strip--bottom">
        <span>Chronological digest</span>
        <span>Delivered by RSS</span>
        <span>Founded MMXXVI</span>
      </div>
    </div>
  </header>
  <main>
    <div class="edition-layout">
      ${leadStory}
      ${departments}
    </div>
    <section class="archive-section" aria-labelledby="archive-title">
      <div class="section-rule">
        <h2 id="archive-title">Continued Chronicle</h2>
      </div>
      <ul class="article-list">
        ${articleList}
      </ul>
    </section>
  </main>
  <footer>
    <p>End of feed. Last updated ${formatDate(new Date(), {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })}.</p>
  </footer>
  <script>${THEME_CONTROL_SCRIPT}</script>
</body>
</html>`;

  fs.writeFileSync(path.join(CONFIG.outputDir, 'index.html'), html);
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Utility: Escape XML
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Generating RSS feed...\n');

  const files = getMarkdownFiles();
  console.log(`Found ${files.length} markdown files in ${CONFIG.sourceDir}`);

  if (files.length === 0) {
    console.warn('No markdown files found. Creating sample feed.');
    // Create sample article for testing
    const sampleArticle = {
      filename: 'sample',
      title: 'Welcome to The Indie App',
      content: '# Welcome\n\nThis is a sample article. Add markdown files to `/Users/trungluong/clawd/output/` to populate the feed.',
      html: '<h1>Welcome</h1><p>This is a sample article. Add markdown files to <code>/Users/trungluong/clawd/output/</code> to populate the feed.</p>',
      excerpt: 'This is a sample article. Add markdown files to populate the feed.',
      pubDate: new Date(),
      url: '',
      tags: ['sample'],
    };
    generateArticlePage(sampleArticle);
    generateRSSFeed([sampleArticle]);
    generateIndexPage([sampleArticle]);
  } else {
    const parsedArticles = files.map(parseMarkdownFile);

    cleanGeneratedArticles();
    console.log('\n📝 Generating article pages...');
    parsedArticles.forEach(article => {
      const filename = generateArticlePage(article);
      console.log(`  ✓ ${filename}`);
    });

    console.log('\n📡 Generating RSS feed...');
    generateRSSFeed(parsedArticles);
    console.log(`  ✓ feed.xml (${parsedArticles.length} items)`);

    console.log('\n🏠 Generating index page...');
    generateIndexPage(parsedArticles);
    console.log('  ✓ index.html');
  }

  console.log(`\n✅ Done! Output: ${CONFIG.outputDir}/`);
  console.log(`   Feed URL: ${CONFIG.feedUrl}`);
  console.log(`   Site URL: ${CONFIG.siteUrl}\n`);
}

main();
