const MOJANG_NEWS_V2_URL = 'https://launchercontent.mojang.com/v2/news.json';
const MINECRAFT_ARTICLES_URL = 'https://www.minecraft.net/en-us/articles';
const MOJANG_CONTENT_HOST = 'https://launchercontent.mojang.com';

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(value) {
  return decodeHtmlEntities(normalizeWhitespace(String(value || '').replace(/<[^>]+>/g, ' ')));
}

function resolveMinecraftUrl(value) {
  if (!value) return '';
  return new URL(String(value).trim(), MINECRAFT_ARTICLES_URL).href;
}

function extractImageUrl(htmlWindow) {
  const imageMatches = [...String(htmlWindow || '').matchAll(/<img\b[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/gi)];
  return imageMatches.length > 0 ? imageMatches[imageMatches.length - 1][1] : '';
}

function extractCardText(html, pattern) {
  const match = String(html || '').match(pattern);
  return match ? stripTags(match[1]) : '';
}

function extractAgeLabel(segment) {
  const match = String(segment || '').match(/\b\d+\s+(?:day|days|month|months|year|years)\s+ago\b/i);
  return match ? normalizeWhitespace(match[0]) : '';
}

function extractMetaContent(html, pattern) {
  const match = String(html || '').match(pattern);
  return match ? stripTags(match[1]) : '';
}

async function fetchHtml(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenLauncher-News',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OpenLauncher-News',
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArticleDetails(url) {
  const html = await fetchHtml(url);
  const description = extractMetaContent(html, /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const author = extractMetaContent(html, /<dt>\s*Written By\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)
    || extractMetaContent(html, /"author"\s*:\s*\{[\s\S]*?"name"\s*:\s*"([^"]+)"/i);
  const published = extractMetaContent(html, /<dt>\s*Published\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)
    || extractMetaContent(html, /"datePublished"\s*:\s*"([^"]+)"/i)
    || extractMetaContent(html, /<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)["']/i);

  return { description, author, published };
}

function parseMinecraftNewsCard(segment) {
  const title = extractCardText(segment, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const hrefMatch = String(segment || '').match(/<a\b[^>]+href=["']([^"']*\/en-us\/article\/[^"']+)["'][^>]*>/i);
  const summary = extractCardText(segment, /<div[^>]+class=["'][^"']*MC_tiledHeroA_blurb[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const imageMatch = String(segment || '').match(/<img\b[^>]+(?:src|data-src|data-lazy-src)=["']([^"']+)["'][^>]*>/i);
  const age = extractAgeLabel(segment);

  if (!title || !hrefMatch) return null;

  return {
    title,
    summary: summary && summary.toLowerCase() !== title.toLowerCase() ? summary.slice(0, 220) : '',
    age,
    url: resolveMinecraftUrl(hrefMatch[1]),
    image: imageMatch ? resolveMinecraftUrl(imageMatch[1]) : '',
    source: 'minecraft.net',
  };
}

function extractMinecraftNewsCards(html, limit) {
  const source = String(html || '');
  const marker = '<div class="MC_tiledHeroA_card">';
  const segments = [];
  let cursor = 0;

  while (segments.length < limit) {
    const start = source.indexOf(marker, cursor);
    if (start === -1) break;
    const next = source.indexOf(marker, start + marker.length);
    const segment = source.slice(start, next === -1 ? source.length : next);
    segments.push(segment);
    cursor = start + marker.length;
  }

  return segments
    .map(parseMinecraftNewsCard)
    .filter(Boolean);
}

function extractSummaryFromHtmlSnippet(htmlSnippet, title) {
  const text = stripTags(htmlSnippet);
  if (!text) return '';

  const lowerTitle = String(title || '').toLowerCase();
  let summary = text.replace(new RegExp(`^${String(title || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*`, 'i'), '');
  summary = summary.replace(/^(Read more|Learn more|Check it out)\s*/i, '');

  const ageMatch = summary.match(/\b\d+\s+(?:day|days|month|months|year|years)\s+ago\b/i);
  if (ageMatch?.index != null) {
    summary = summary.slice(0, ageMatch.index);
  }

  summary = normalizeWhitespace(summary);
  if (!summary || summary.toLowerCase() === lowerTitle) return '';
  return summary.slice(0, 220);
}

async function scrapeMinecraftArticles(limit) {
  const html = await fetchHtml(MINECRAFT_ARTICLES_URL);
  const items = extractMinecraftNewsCards(html, limit);

  const enrichedItems = await Promise.all(items.slice(0, limit).map(async (item) => {
    if (item.summary && item.age) {
      return item;
    }

    try {
      const details = await fetchArticleDetails(item.url);
      const summary = item.summary || details.description || '';
      return {
        ...item,
        summary: summary && summary.toLowerCase() !== item.title.toLowerCase() ? summary.slice(0, 220) : item.summary,
        author: details.author || '',
        published: details.published || '',
      };
    } catch {
      return item;
    }
  }));

  if (enrichedItems.length > 0) {
    return enrichedItems;
  }

  const anchorRegex = /<a\b[^>]+href=["']([^"']*\/en-us\/article\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set();
  const fallbackItems = [];

  for (const match of html.matchAll(anchorRegex)) {
    const href = String(match[1] || '').trim();
    const anchorHtml = String(match[2] || '');
    const title = stripTags(anchorHtml);

    if (!href || !title) continue;
    if (/^(Read more|Learn more|Check it out)$/i.test(title)) continue;
    if (title.length < 5) continue;

    const normalizedHref = href.split('#')[0];
    if (seen.has(normalizedHref)) continue;
    seen.add(normalizedHref);

    const beforeWindow = html.slice(Math.max(0, match.index - 2500), match.index);
    const afterWindow = html.slice(match.index + match[0].length, match.index + match[0].length + 800);
    const image = resolveMinecraftUrl(extractImageUrl(beforeWindow) || extractImageUrl(anchorHtml) || '');
    const summary = extractSummaryFromHtmlSnippet(afterWindow, title);

    fallbackItems.push({
      title,
      summary,
      author: '',
      published: '',
      url: resolveMinecraftUrl(normalizedHref),
      image,
      source: 'minecraft.net',
    });

    if (fallbackItems.length >= limit) break;
  }

  return fallbackItems;
}

export async function loadMinecraftNews({ limit = 60 } = {}) {
  // 1. Try modern official Mojang Launcher News v2 endpoint (latest 2026/current articles)
  try {
    const mojangData = await fetchJson(MOJANG_NEWS_V2_URL);
    if (mojangData && Array.isArray(mojangData.entries) && mojangData.entries.length > 0) {
      // Sort entries newest first by date
      const sortedEntries = [...mojangData.entries].sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });

      const items = sortedEntries
        .slice(0, limit)
        .map(entry => {
          const relativeImg = entry.playPageImage?.url || entry.newsPageImage?.url || '';
          const fullImg = relativeImg ? (relativeImg.startsWith('http') ? relativeImg : `${MOJANG_CONTENT_HOST}${relativeImg}`) : '';
          return {
            title: entry.title || '',
            summary: entry.text ? normalizeWhitespace(entry.text).slice(0, 220) : '',
            author: entry.category || 'Minecraft',
            published: entry.date || '',
            url: entry.readMoreLink || MINECRAFT_ARTICLES_URL,
            image: fullImg,
            source: 'mojang',
          };
        })
        .filter(item => Boolean(item.title));

      if (items.length > 0) {
        return {
          sourceUrl: MINECRAFT_ARTICLES_URL,
          items,
        };
      }
    }
  } catch (err) {
    console.warn('Mojang news v2 request failed, falling back to web scraping:', err?.message || err);
  }

  // 2. Fallback to scraping minecraft.net articles
  try {
    const items = await scrapeMinecraftArticles(limit);
    return {
      sourceUrl: MINECRAFT_ARTICLES_URL,
      items,
    };
  } catch (err) {
    console.error('Failed to load Minecraft news from all sources:', err?.message || err);
    return {
      sourceUrl: MINECRAFT_ARTICLES_URL,
      items: [],
    };
  }
}

export function parseMinecraftArticleHtml(html, baseUrl) {
  let title = '';
  let subheadline = '';
  let category = '';
  let author = '';
  let date = '';
  let heroImage = '';

  // 1. Title extraction (prioritize OpenGraph and Twitter title over slug/fallback)
  const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  const twTitleMatch = html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  if (ogTitleMatch && ogTitleMatch[1].trim()) {
    title = stripTags(ogTitleMatch[1]);
  } else if (twTitleMatch && twTitleMatch[1].trim()) {
    title = stripTags(twTitleMatch[1]);
  } else if (h1Match && h1Match[1].trim()) {
    title = stripTags(h1Match[1]);
  }

  // 2. JSON-LD Metadata extraction
  try {
    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of jsonLdMatches) {
      const parsed = JSON.parse(m[1]);
      if (parsed.headline && (!title || title.includes('-'))) {
        title = stripTags(parsed.headline);
      }
      if (parsed.image && !heroImage) {
        heroImage = Array.isArray(parsed.image) ? parsed.image[0] : parsed.image;
      }
      if (parsed.author && !author) {
        author = typeof parsed.author === 'object' ? (parsed.author.name || '') : parsed.author;
      }
      if (parsed.datePublished && !date) {
        const d = new Date(parsed.datePublished);
        date = !isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : parsed.datePublished;
      }
    }
  } catch { }

  // 3. Subheadline & Category
  const subMatch = html.match(/class="[^"]*MC_articleHeroA_header_subheadline[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    || html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (subMatch) subheadline = stripTags(subMatch[1]);

  // Extract explicit category tag
  const catMatch = html.match(/<div\b[^>]*class=["'][^"']*MC_articleHeroA_category[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || html.match(/class=["'][^"']*MC_articleHeroA_category[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|span)>/i);
  if (catMatch) {
    const cleanCat = stripTags(catMatch[1]);
    if (cleanCat && cleanCat.length < 50 && !cleanCat.includes('\n')) {
      category = cleanCat;
    }
  }

  // 4. Author & Date extraction from DL/DT/DD or meta
  if (!author) {
    const dtAuthorMatch = html.match(/<dt>\s*Written By\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)
      || html.match(/class="[^"]*MC_articleHeroA_attribution_author[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (dtAuthorMatch) author = stripTags(dtAuthorMatch[1]);
  }

  if (!date) {
    const dtDateMatch = html.match(/<dt>\s*Published\s*<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i)
      || html.match(/class="[^"]*MC_articleHeroA_attribution_published[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (dtDateMatch) date = stripTags(dtDateMatch[1]);
  }

  // 5. Hero Image
  if (!heroImage) {
    const heroImgMatch = html.match(/class="[^"]*(?:article-head__image|MC_articleHeroA_poster)[^"]*"[^>]*src="([^"]+)"/i)
      || html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (heroImgMatch) heroImage = heroImgMatch[1];
  }
  if (heroImage && !heroImage.startsWith('http')) {
    heroImage = new URL(heroImage, baseUrl || MINECRAFT_ARTICLES_URL).href;
  }

  // 6. Slice main content block between Hero and Share/Footer
  const h1Index = html.indexOf('<h1');
  let startSlice = (h1Index !== -1) ? html.indexOf('</section>', h1Index) : -1;
  if (startSlice === -1) startSlice = (h1Index !== -1) ? h1Index : 0;

  let endSlice = html.indexOf('Share this story');
  if (endSlice === -1) endSlice = html.indexOf('MC_shareStory');
  if (endSlice === -1) endSlice = html.indexOf('Newest News');
  if (endSlice === -1) endSlice = html.indexOf('<footer');

  const contentHtml = (startSlice !== -1 && endSlice !== -1 && endSlice > startSlice)
    ? html.slice(startSlice, endSlice)
    : html.slice(startSlice);

  // 7. Extract structured body blocks
  const blocks = [];
  const tagRegex = /<(h[2-4]|p|figure|iframe|video|ul|ol|blockquote)\b([^>]*)>([\s\S]*?)<\/\1>|<img\b([^>]*)\/?>/gi;
  let match;
  while ((match = tagRegex.exec(contentHtml)) !== null) {
    const tag = (match[1] || 'img').toLowerCase();
    const attrs = match[2] || match[4] || '';
    const innerHtml = match[3] || '';

    // Check for YouTube / Video Embed in figure or anchor
    if (tag === 'figure' || tag === 'iframe' || tag === 'video') {
      const fullTagHtml = match[0];
      const ytMatch = fullTagHtml.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/|data-video-id=["'])([a-zA-Z0-9_-]{11})/i);
      if (ytMatch) {
        const videoId = ytMatch[1];
        const titleMatch = fullTagHtml.match(/title=["']([^"']*)["']/i) || fullTagHtml.match(/alt=["']([^"']*)["']/i);
        blocks.push({
          type: 'video',
          provider: 'youtube',
          videoId,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
          title: titleMatch ? titleMatch[1] : 'Minecraft Video',
        });
        continue;
      }

      // If it's a figure with normal image
      if (tag === 'figure') {
        const imgMatch = innerHtml.match(/<img\b([^>]*)\/?>/i);
        if (imgMatch) {
          const imgAttrs = imgMatch[1];
          const srcMatch = imgAttrs.match(/src="([^"]+)"/i) || imgAttrs.match(/data-src="([^"]+)"/i);
          const altMatch = imgAttrs.match(/alt="([^"]*)"/i);
          const captionMatch = innerHtml.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i);
          if (srcMatch) {
            let src = srcMatch[1];
            if (!src.startsWith('http')) src = new URL(src, baseUrl || MINECRAFT_ARTICLES_URL).href;
            if (!src.includes('analytics') && !src.includes('tracking') && !src.includes('.svg') && !src.includes('author-avatars')) {
              blocks.push({
                type: 'image',
                src,
                alt: captionMatch ? stripTags(captionMatch[1]) : (altMatch ? altMatch[1] : ''),
              });
            }
          }
        }
        continue;
      }
    }

    if (tag === 'img') {
      const srcMatch = attrs.match(/src="([^"]+)"/i) || attrs.match(/data-src="([^"]+)"/i);
      const altMatch = attrs.match(/alt="([^"]*)"/i);
      if (srcMatch) {
        let src = srcMatch[1];
        if (!src.startsWith('http')) src = new URL(src, baseUrl || MINECRAFT_ARTICLES_URL).href;
        if (!src.includes('analytics') && !src.includes('tracking') && !src.includes('.svg') && !src.includes('author-avatars')) {
          blocks.push({ type: 'image', src, alt: altMatch ? altMatch[1] : '' });
        }
      }
    } else if (tag === 'p') {
      // Check if paragraph contains a standalone YouTube link
      const ytMatch = innerHtml.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
      if (ytMatch && (innerHtml.includes('<a') || innerHtml.length < 120)) {
        blocks.push({
          type: 'video',
          provider: 'youtube',
          videoId: ytMatch[1],
          embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
          title: 'Minecraft Video',
        });
        continue;
      }

      const clean = stripTags(innerHtml);
      if (clean && !clean.includes('MC_articleHeroA_header_subheadline') && clean !== subheadline && clean.length > 2) {
        // Strip out noisy Word/RTE span wrappings while keeping bold/italic/links
        const cleanedHtml = innerHtml
          .replace(/<span\b[^>]*>/gi, '')
          .replace(/<\/span>/gi, '')
          .trim();
        blocks.push({ type: 'paragraph', html: cleanedHtml || clean, text: clean });
      }
    } else if (tag.startsWith('h')) {
      const level = parseInt(tag[1], 10);
      const clean = stripTags(innerHtml);
      if (clean && clean !== 'Share this story' && clean !== title) {
        blocks.push({ type: 'heading', level, text: clean });
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [...innerHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
        .map(li => stripTags(li[1]))
        .filter(Boolean);
      if (items.length > 0) {
        blocks.push({ type: tag === 'ol' ? 'ordered-list' : 'list', items });
      }
    } else if (tag === 'blockquote') {
      const clean = stripTags(innerHtml);
      if (clean) {
        blocks.push({ type: 'quote', text: clean });
      }
    }
  }

  return {
    title: decodeHtmlEntities(title.replace(/\s+\|\s+Minecraft$/i, '').trim()),
    subheadline: decodeHtmlEntities(subheadline.trim()),
    category: decodeHtmlEntities(category.trim()),
    author: decodeHtmlEntities(author.trim()),
    date: decodeHtmlEntities(date.trim()),
    heroImage,
    blocks,
    url: baseUrl,
  };
}

export async function loadMinecraftArticle(url) {
  if (!url) throw new Error('No article URL provided');
  let targetUrl = String(url).trim();
  if (!targetUrl.startsWith('http')) {
    targetUrl = resolveMinecraftUrl(targetUrl);
  }
  const html = await fetchHtml(targetUrl, 20000);
  return parseMinecraftArticleHtml(html, targetUrl);
}