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

export async function loadMinecraftNews({ limit = 24 } = {}) {
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