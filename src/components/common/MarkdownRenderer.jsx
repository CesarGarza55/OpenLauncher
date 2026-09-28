import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with GFM, line breaks, and smart typography
marked.setOptions({
  gfm: true,
  breaks: true,
  pedantic: false,
});

function openExternalLink(url) {
  if (!url) return;
  try {
    if (typeof window !== 'undefined' && window.launcher?.minecraftOpenFolder) {
      window.launcher.minecraftOpenFolder(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function parseModrinthUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim();

  // Match absolute and relative Modrinth URLs:
  // e.g. https://modrinth.com/mod/creativecore
  // /mod/creativecore
  // https://modrinth.com/mod/creativecore/versions
  // https://www.modrinth.com/shader/complementary-unbound
  const match = cleanUrl.match(/(?:(?:https?:\/\/)?(?:www\.)?modrinth\.com)?\/?(mod|shader|resourcepack|datapack|plugin|project)\/([a-zA-Z0-9_\-]+)/i);
  if (match) {
    const rawType = match[1].toLowerCase();
    const slug = match[2].toLowerCase();
    let projectType = 'mod';
    if (rawType === 'shader') projectType = 'shader';
    else if (rawType === 'resourcepack') projectType = 'resourcepack';
    return {
      slug,
      projectType,
      url: cleanUrl,
    };
  }
  return null;
}

export function MarkdownRenderer({ content, className = '', onNavigateModrinth = null }) {
  const html = useMemo(() => {
    if (!content || typeof content !== 'string') return '';

    try {
      // 1. Preprocess comments and common Modrinth formatting quirks
      let processed = content
        .replace(/<!--[\s\S]*?-->/g, '') // remove comments
        .replace(/<iframe\s+([^>]*?)src=["']([^"']+)["']([^>]*?)><\/iframe>/gi, (match, before, src, after) => {
          const embedSrc = src.replace('watch?v=', 'embed/');
          return `<div class="md-video-container"><iframe ${before}src="${embedSrc}"${after} frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        });

      // 2. Parse using marked
      let parsed = marked.parse(processed);

      return parsed;
    } catch (e) {
      console.warn('Failed to parse markdown:', e);
      return `<p>${content}</p>`;
    }
  }, [content]);

  if (!html) return null;

  const handleClick = (e) => {
    const link = e.target.closest('a');
    if (link) {
      const href = link.getAttribute('href') || link.href;
      if (!href) return;

      const modrinthInfo = parseModrinthUrl(href);
      if (modrinthInfo && typeof onNavigateModrinth === 'function') {
        e.preventDefault();
        e.stopPropagation();
        onNavigateModrinth(modrinthInfo);
        return;
      }

      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) {
        e.preventDefault();
        e.stopPropagation();
        openExternalLink(href);
      }
    }
  };

  return (
    <div
      className={`markdown-renderer-root ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={handleClick}
    />
  );
}
