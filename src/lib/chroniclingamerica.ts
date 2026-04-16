/**
 * Chronicling America — Library of Congress Historic Newspaper Search
 * https://chroniclingamerica.loc.gov/about/api/
 *
 * Free API, no key required. Covers ~20 million pages of US newspapers
 * published between 1770 and 1963.
 *
 * Great for finding:
 *   - Birth / death / marriage notices
 *   - Obituaries
 *   - Employment / business mentions
 *   - Immigration & naturalization announcements
 *   - Legal notices (land sales, wills, probate)
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

const BASE = 'https://chroniclingamerica.loc.gov';

const HEADERS = {
  'User-Agent': 'Kinnect Genealogy App/1.0 (genealogy research; https://github.com/RMamujee/Kinnect)',
  Accept: 'application/json',
};

interface LocPage {
  id: string;
  title: string;          // newspaper name
  date: string;           // "YYYY-MM-DD"
  state?: string[];
  city?: string[];
  county?: string[];
  edition_label?: string;
  page?: string;
  ocr_eng?: string;       // full OCR text of the page
  url: string;
}

interface LocResponse {
  items: LocPage[];
  totalItems: number;
}

export async function searchChroniclingAmerica(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  if (!query.givenName && !query.surname) return [];

  const fullName = [query.givenName, query.surname].filter(Boolean).join(' ');

  // Build a phrase-first query so exact name matches score higher
  let searchText = `"${fullName}"`;
  if (query.occupation) searchText += ` ${query.occupation}`;

  const params = new URLSearchParams({
    andtext: searchText,
    format: 'json',
    rows: '15',
    sort: 'relevance',
  });

  // Narrow date range if we know birth / death years
  if (query.birthYear || query.deathYear) {
    const from = query.birthYear ? Math.max(1770, query.birthYear - 5) : 1770;
    const to   = query.deathYear ? Math.min(1963, query.deathYear + 10)
                                 : query.birthYear ? Math.min(1963, query.birthYear + 90)
                                 : 1963;
    params.set('dateFilterType', 'range');
    params.set('date1', String(from));
    params.set('date2', String(to));
  }

  try {
    const res = await fetch(`${BASE}/search/pages/results/?${params}`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data: LocResponse = await res.json();
    if (!data.items?.length) return [];

    return data.items.map((page): RecordSearchResult => {
      const location = [...(page.city ?? []), ...(page.state ?? [])].filter(Boolean).join(', ');
      const year     = page.date ? parseInt(page.date.slice(0, 4), 10) : undefined;
      const snippet  = extractSnippet(page.ocr_eng ?? '', fullName);
      const confidence = scoreLocPage(page, query, fullName);

      return {
        id:              `loc-${page.id.replace(/\//g, '-')}`,
        source:          'newspaper',
        externalId:      page.id,
        name:            fullName,
        recordType:      inferRecordType(snippet),
        confidence,
        birthPlace:      location || undefined,
        publicationDate: page.date,
        publicationName: page.title,
        snippet,
        url: `${BASE}${page.id}`,
        rawData: {
          newspaper: page.title,
          date:      page.date,
          location,
          page:      page.page ?? page.edition_label ?? '',
        },
      };
    });
  } catch (err) {
    console.error('[ChroniclingAmerica] search error:', err);
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a 250-char context window around the first name occurrence.
 */
function extractSnippet(ocr: string, name: string): string | undefined {
  if (!ocr) return undefined;
  const idx = ocr.toLowerCase().indexOf(name.toLowerCase());
  if (idx === -1) return ocr.slice(0, 200).trim() + '…';
  const start = Math.max(0, idx - 80);
  const end   = Math.min(ocr.length, idx + name.length + 170);
  return (start > 0 ? '…' : '') + ocr.slice(start, end).trim() + (end < ocr.length ? '…' : '');
}

/**
 * Confidence: phrase match + birth year match + birth place match.
 */
function scoreLocPage(page: LocPage, query: RecordSearchQuery, name: string): number {
  const text = (page.ocr_eng ?? '').toLowerCase();
  let score  = 30;

  if (text.includes(`"${name.toLowerCase()}"`)) score += 25;
  else if (text.includes(name.toLowerCase()))   score += 15;

  if (query.birthYear) {
    const yr = query.birthYear;
    if (text.includes(String(yr)))     score += 10;
    if (text.includes(String(yr - 1))) score += 5;
    if (text.includes(String(yr + 1))) score += 5;
  }

  if (query.birthPlace) {
    const place = query.birthPlace.toLowerCase();
    const pageLocation = [...(page.city ?? []), ...(page.state ?? [])].join(' ').toLowerCase();
    if (pageLocation.includes(place) || place.includes(pageLocation)) score += 15;
  }

  if (query.occupation) {
    if (text.includes(query.occupation.toLowerCase())) score += 10;
  }

  return Math.min(90, score);
}

const OBITUARY_KEYWORDS = ['died', 'death', 'obituary', 'funeral', 'interred', 'passed away', 'late of'];
const BIRTH_KEYWORDS    = ['born', 'birth', 'infant', 'christened', 'baptized'];
const MARRIAGE_KEYWORDS = ['married', 'marriage', 'wedding', 'nuptials'];
const EMPLOYMENT_KEYWORDS = ['employed', 'occupation', 'business', 'profession', 'works at', 'labor'];

function inferRecordType(snippet?: string): RecordSearchResult['recordType'] {
  if (!snippet) return 'newspaper';
  const t = snippet.toLowerCase();
  if (OBITUARY_KEYWORDS.some(k => t.includes(k)))   return 'obituary';
  if (MARRIAGE_KEYWORDS.some(k => t.includes(k)))   return 'marriage_certificate';
  if (BIRTH_KEYWORDS.some(k => t.includes(k)))      return 'birth_certificate';
  if (EMPLOYMENT_KEYWORDS.some(k => t.includes(k))) return 'newspaper';
  return 'newspaper';
}
