/**
 * Trove — National Library of Australia newspaper & records search.
 * Free API. Set TROVE_API_KEY env var for higher rate limits.
 * Covers Australian papers 1803–present, family notices, obituaries.
 * Docs: https://trove.nla.gov.au/about/create-something/using-api
 */
import type { RecordSearchQuery, RecordSearchResult, RecordType } from './types';

const TROVE_API = 'https://api.trove.nla.gov.au/v3';
const TROVE_KEY = process.env.TROVE_API_KEY ?? '';

function inferRecordType(text: string): RecordType {
  const t = text.toLowerCase();
  if (t.includes('obituar') || t.includes('died') || t.includes('death notice')) return 'obituary';
  if (t.includes('birth') || t.includes('born')) return 'birth_certificate';
  if (t.includes('marr') || t.includes('wed')) return 'marriage_certificate';
  return 'newspaper';
}

export async function searchTrove(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    q: `"${fullName}"`,
    category: 'newspaper',
    n: '20',
    sortby: 'relevance',
    encoding: 'json',
    include: 'articleText',
  });
  if (TROVE_KEY) params.set('key', TROVE_KEY);
  if (birthYear) params.set('l-decade', String(Math.floor(birthYear / 10) * 10));

  try {
    const res = await fetch(`${TROVE_API}/result?${params}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as {
      category?: Array<{
        records?: {
          article?: Array<{
            id?: string | number;
            heading?: string;
            snippet?: string;
            date?: string;
            title?: { value?: string };
            troveUrl?: string;
          }>;
        };
      }>;
    };

    const articles = data.category?.[0]?.records?.article ?? [];
    return articles.map(a => {
      const title = a.heading ?? '';
      const snippet = a.snippet ?? '';
      const date = a.date ?? '';
      const year = date ? new Date(date).getFullYear() : undefined;
      const newspaper = a.title?.value ?? '';

      const combined = title + ' ' + snippet;
      let confidence = 25;
      if (snippet.toLowerCase().includes(fullName.toLowerCase())) confidence += 30;
      else if (snippet.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 15;
      if (combined.toLowerCase().includes('obituar') || combined.toLowerCase().includes('death notice')) confidence += 10;
      if (combined.toLowerCase().includes('birth') || combined.toLowerCase().includes('married')) confidence += 8;
      if (birthYear && year && Math.abs(year - birthYear) <= 25) confidence += 5;
      confidence = Math.min(confidence, 85);

      return {
        id: `trove-${a.id ?? Math.random()}`,
        source: 'newspaper' as const,
        externalId: String(a.id ?? ''),
        name: fullName,
        recordType: inferRecordType(combined),
        confidence,
        url: a.troveUrl ?? `https://trove.nla.gov.au/newspaper/article/${a.id}`,
        snippet: snippet.slice(0, 250),
        publicationDate: date,
        publicationName: `Trove · ${newspaper}`,
        rawData: a as unknown as Record<string, unknown>,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 25);
  } catch {
    return [];
  }
}
