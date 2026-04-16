/**
 * Library of Congress Digital Collections — manuscripts, photographs, maps, books.
 * No API key required. Goes beyond Chronicling America (newspapers already covered).
 * Docs: https://www.loc.gov/apis/json-and-yaml/
 */
import type { RecordSearchQuery, RecordSearchResult, RecordType } from './types';

const LOC_BASE = 'https://www.loc.gov';

function inferRecordType(text: string): RecordType {
  const t = text.toLowerCase();
  if (t.includes('census')) return 'census';
  if (t.includes('photograph') || t.includes('portrait')) return 'photograph';
  if (t.includes('militar') || t.includes('war') || t.includes('veteran')) return 'military';
  if (t.includes('immigr') || t.includes('passenger')) return 'immigration';
  if (t.includes('newspaper')) return 'newspaper';
  if (t.includes('church') || t.includes('baptism')) return 'church_record';
  if (t.includes('will') || t.includes('probate')) return 'will_probate';
  return 'other';
}

export async function searchLOCCollections(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear, birthPlace } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    q: `"${fullName}"`,
    fo: 'json',
    c: '20',
    sp: '1',
    // Exclude Chronicling America newspapers (already covered by another source)
    'fa': 'partof:chronicling america',
    'not[partof]': 'chronicling america',
  });
  if (birthPlace) params.set('location', birthPlace.split(',')[0]);

  // LOC JSON search endpoint (undocumented but stable)
  const url = `${LOC_BASE}/search/?${params}`;

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Record<string, unknown>[] };

    return (data.results ?? []).map((item, i) => {
      const title = (item.title as string) ?? '';
      const desc = Array.isArray(item.description)
        ? (item.description as string[])[0]
        : ((item.description as string) ?? '');
      const subject: string[] = (item.subject as string[] | undefined) ?? [];
      const date = (item.date as string) ?? '';
      const itemUrl = (item.url as string) ?? '';
      const online = (item['online-format'] as string[] | undefined) ?? [];
      const typeLabel = (item.type as string[] | undefined)?.[0] ?? '';

      const combined = title + ' ' + desc + ' ' + subject.join(' ') + ' ' + typeLabel;
      let confidence = 20;
      if (combined.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 20;
      if (combined.toLowerCase().includes((givenName ?? '').toLowerCase())) confidence += 10;
      if (combined.toLowerCase().includes(fullName.toLowerCase())) confidence += 15;
      if (online.length > 0) confidence += 5; // digitized and available online
      confidence = Math.min(confidence, 80);

      return {
        id: `loc-${i}-${itemUrl}`,
        source: 'archive' as const,
        externalId: itemUrl,
        name: fullName,
        recordType: inferRecordType(combined),
        confidence,
        url: itemUrl.startsWith('http') ? itemUrl : `${LOC_BASE}${itemUrl}`,
        snippet: (desc || title).slice(0, 250),
        publicationDate: date,
        publicationName: 'Library of Congress',
        rawData: item,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 20);
  } catch {
    return [];
  }
}
