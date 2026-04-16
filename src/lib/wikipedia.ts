/**
 * Wikipedia Search
 * https://www.mediawiki.org/wiki/API:Search
 *
 * Free API, no key required. Good for finding biographical articles on
 * notable ancestors, historical figures, and well-documented individuals.
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

interface WikiSearchHit {
  pageid: number;
  title: string;
  snippet: string;   // HTML with <span class="searchmatch"> highlights
  size: number;
  wordcount: number;
  timestamp: string;
}

interface WikiSearchResponse {
  query?: {
    search: WikiSearchHit[];
  };
}

export async function searchWikipedia(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  if (!query.givenName && !query.surname) return [];

  const fullName = [query.givenName, query.surname].filter(Boolean).join(' ');

  // Add birth year as extra context if available — narrows results significantly
  const searchTerm = query.birthYear
    ? `${fullName} ${query.birthYear}`
    : fullName;

  const params = new URLSearchParams({
    action:   'query',
    list:     'search',
    srsearch: searchTerm,
    srlimit:  '5',
    srprop:   'snippet|size|wordcount|timestamp',
    format:   'json',
    utf8:     '1',
    origin:   '*',
  });

  try {
    const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: {
        'User-Agent': 'Kinnect Genealogy App/1.0 (genealogy research)',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data: WikiSearchResponse = await res.json();
    const hits = data.query?.search ?? [];

    return hits.map((hit): RecordSearchResult => ({
      id:             `wiki-${hit.pageid}`,
      source:         'wikipedia',
      externalId:     String(hit.pageid),
      name:           hit.title,
      recordType:     'other',
      confidence:     scoreWikiHit(hit, query, fullName),
      snippet:        stripHtml(hit.snippet),
      publicationDate: hit.timestamp.slice(0, 10),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, '_'))}`,
      rawData: {
        pageid:    hit.pageid,
        wordcount: hit.wordcount,
        size:      hit.size,
      },
    }));
  } catch (err) {
    console.error('[Wikipedia] search error:', err);
    return [];
  }
}

function scoreWikiHit(hit: WikiSearchHit, query: RecordSearchQuery, fullName: string): number {
  const title   = hit.title.toLowerCase();
  const snippet = stripHtml(hit.snippet).toLowerCase();
  let score     = 25;

  const given   = (query.givenName  ?? '').toLowerCase();
  const surname = (query.surname ?? '').toLowerCase();

  if (title === fullName.toLowerCase())               score += 40;
  else if (title.startsWith(surname))                 score += 20;
  else if (title.includes(surname))                   score += 10;
  if (given && title.includes(given))                 score += 10;
  if (query.birthYear && snippet.includes(String(query.birthYear))) score += 15;
  if (query.birthPlace && snippet.includes(query.birthPlace.toLowerCase())) score += 10;

  return Math.min(90, score);
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
}
