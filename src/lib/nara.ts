/**
 * NARA Catalog API — US National Archives federal records.
 * No API key required. Covers military, immigration, census, land, naturalization.
 * Docs: https://catalog.archives.gov/api/v2
 */
import type { RecordSearchQuery, RecordSearchResult } from './types';
import type { RecordType } from './types';

const NARA_API = 'https://catalog.archives.gov/api/v2';

function inferRecordType(text: string): RecordType {
  const t = text.toLowerCase();
  if (t.includes('census')) return 'census';
  if (t.includes('draft') || t.includes('service record') || t.includes('veteran') || t.includes('pension')) return 'military';
  if (t.includes('passenger') || t.includes('immigr') || t.includes('arrival') || t.includes('ship manifest')) return 'immigration';
  if (t.includes('homestead') || t.includes('land') || t.includes('deed')) return 'land_deed';
  if (t.includes('naturaliz') || t.includes('citizen') || t.includes('declaration of intention')) return 'naturalization';
  if (t.includes('birth')) return 'birth_certificate';
  if (t.includes('death')) return 'death_certificate';
  if (t.includes('marriage') || t.includes('divorce')) return 'marriage_certificate';
  if (t.includes('church') || t.includes('baptism') || t.includes('christening')) return 'church_record';
  return 'other';
}

export async function searchNARA(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear, birthPlace } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  let q = `"${fullName}"`;
  if (birthPlace) q += ` ${birthPlace.split(',')[0]}`; // just city/state, not full address

  const params = new URLSearchParams({ q, resultTypes: 'item', rows: '20', offset: '0' });

  try {
    const res = await fetch(`${NARA_API}/records?${params}`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json() as {
      opaResponse?: {
        results?: {
          result?: Array<{
            naId?: number;
            title?: string;
            scopeAndContentNote?: string | string[];
            beginDate?: string;
            endDate?: string;
            levelOfDescription?: string;
          }>;
        };
      };
    };

    const results = data.opaResponse?.results?.result ?? [];

    return results.map((item, i) => {
      const title = item.title ?? '';
      const desc = Array.isArray(item.scopeAndContentNote)
        ? item.scopeAndContentNote.join(' ')
        : (item.scopeAndContentNote ?? '');
      const combined = title + ' ' + desc;
      const naId = item.naId ?? i;
      const dateStr = item.beginDate ?? '';
      const year = dateStr ? parseInt(dateStr, 10) : undefined;

      let confidence = 20;
      if (combined.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 20;
      if (combined.toLowerCase().includes((givenName ?? '').toLowerCase())) confidence += 10;
      if (birthYear && year && Math.abs(year - birthYear) <= 10) confidence += 10;
      confidence = Math.min(confidence, 80);

      return {
        id: `nara-${naId}`,
        source: 'other' as const,
        externalId: String(naId),
        name: fullName,
        recordType: inferRecordType(combined),
        confidence,
        url: `https://catalog.archives.gov/id/${naId}`,
        snippet: desc.slice(0, 250) || title,
        publicationDate: dateStr,
        publicationName: 'National Archives (NARA)',
        rawData: item as unknown as Record<string, unknown>,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 20);
  } catch {
    return [];
  }
}
