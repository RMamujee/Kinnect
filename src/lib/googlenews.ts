/**
 * Google News RSS Search
 *
 * Searches Google News via the public RSS feed endpoint.
 * No API key required. Good for finding recent (last ~5 years) news
 * articles that mention a person — useful for living relatives or
 * recently documented individuals.
 *
 * Also supports Bing News Search when BING_NEWS_API_KEY is set
 * in environment variables (Azure Cognitive Services free tier:
 * 1,000 calls/month). Set it in Vercel env vars for richer results.
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

// ── RSS parser (no dependency) ────────────────────────────────────────────────

interface RSSItem {
  title:       string;
  link:        string;
  pubDate:     string;
  description: string;
  source:      string;
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1];

    const title = cdataOrText(block, 'title');
    const link  = cdataOrText(block, 'link') || (block.match(/<link\s*\/>([^<]+)/)?.[1] ?? '');
    const date  = cdataOrText(block, 'pubDate');
    const desc  = cdataOrText(block, 'description');
    const src   = cdataOrText(block, 'source') || '';

    if (title) items.push({ title, link: link.trim(), pubDate: date, description: desc, source: src });
  }
  return items;
}

function cdataOrText(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/${tag}>`, 'i');
  const m = block.match(re);
  if (!m) return '';
  return (m[1] ?? m[2] ?? '').trim();
}

// ── Google News RSS ───────────────────────────────────────────────────────────

export async function searchGoogleNews(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  if (!query.givenName && !query.surname) return [];

  const fullName  = [query.givenName, query.surname].filter(Boolean).join(' ');
  const searchQ   = `"${fullName}"`;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQ)}&hl=en-US&gl=US&ceid=US:en`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Kinnect/1.0; genealogy research)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];

    const xml   = await res.text();
    const items = parseRSS(xml).slice(0, 8);

    return items.map((item, i): RecordSearchResult => ({
      id:             `gnews-${i}-${hashStr(item.link)}`,
      source:         'news',
      externalId:     item.link,
      name:           item.title,
      recordType:     'newspaper',
      confidence:     scoreNewsItem(item, query, fullName),
      snippet:        stripHtml(item.description).slice(0, 300),
      publicationDate: item.pubDate ? isoDate(item.pubDate) : undefined,
      publicationName: item.source || 'Google News',
      url:            item.link,
      rawData: { pubDate: item.pubDate, source: item.source },
    }));
  } catch (err) {
    console.error('[GoogleNews] RSS error:', err);
    return [];
  }
}

// ── Bing News (optional — requires BING_NEWS_API_KEY) ────────────────────────

export async function searchBingNews(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  const key = process.env.BING_NEWS_API_KEY;
  if (!key || !query.givenName && !query.surname) return [];

  const fullName = [query.givenName, query.surname].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    q:     `"${fullName}"`,
    count: '8',
    mkt:   'en-US',
  });

  try {
    const res = await fetch(`https://api.bing.microsoft.com/v7.0/news/search?${params}`, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];

    const data = await res.json();
    const articles: Array<{
      name: string; url: string; description: string;
      datePublished: string; provider: Array<{ name: string }>;
    }> = data.value ?? [];

    return articles.map((a, i): RecordSearchResult => ({
      id:             `bing-${i}-${hashStr(a.url)}`,
      source:         'news',
      externalId:     a.url,
      name:           a.name,
      recordType:     'newspaper',
      confidence:     scoreNewsItem({ title: a.name, description: a.description }, query, fullName),
      snippet:        a.description?.slice(0, 300),
      publicationDate: a.datePublished?.slice(0, 10),
      publicationName: a.provider?.[0]?.name ?? 'Bing News',
      url:            a.url,
      rawData: { datePublished: a.datePublished },
    }));
  } catch (err) {
    console.error('[BingNews] search error:', err);
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function scoreNewsItem(
  item: { title: string; description: string },
  query: RecordSearchQuery,
  fullName: string,
): number {
  const text  = `${item.title} ${item.description}`.toLowerCase();
  const name  = fullName.toLowerCase();
  let score   = 30;

  if (item.title.toLowerCase().includes(name))  score += 30;
  else if (text.includes(name))                 score += 15;
  if (query.birthPlace && text.includes(query.birthPlace.toLowerCase())) score += 10;

  return Math.min(85, score);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();
}

function isoDate(dateStr: string): string {
  try { return new Date(dateStr).toISOString().slice(0, 10); } catch { return dateStr; }
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < Math.min(s.length, 20); i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h) % 100000;
}
