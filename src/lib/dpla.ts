/**
 * Digital Public Library of America (DPLA) API
 * Free. Set DPLA_API_KEY in env or falls back to demo key.
 * Aggregates 500M+ items from thousands of US libraries, archives, museums.
 * Docs: https://pro.dp.la/developers/api-codex
 */
import type { RecordSearchQuery, RecordSearchResult, RecordType } from './types';

const DPLA_ENDPOINT = 'https://api.dp.la/v2/items';
const DPLA_KEY = process.env.DPLA_API_KEY ?? 'a5b72f2f8a70ca88de26d53adb06f56d';

function inferRecordType(combined: string): RecordType {
  const t = combined.toLowerCase();
  if (t.includes('census')) return 'census';
  if (t.includes('obituar')) return 'obituary';
  if (t.includes('birth certificate')) return 'birth_certificate';
  if (t.includes('death certificate')) return 'death_certificate';
  if (t.includes('marriage')) return 'marriage_certificate';
  if (t.includes('militar') || t.includes('veteran') || t.includes('war record')) return 'military';
  if (t.includes('immigr') || t.includes('passenger') || t.includes('arrival')) return 'immigration';
  if (t.includes('newspaper')) return 'newspaper';
  if (t.includes('photograph') || t.includes('portrait')) return 'photograph';
  if (t.includes('church') || t.includes('baptism')) return 'church_record';
  return 'other';
}

export async function searchDPLA(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear, birthPlace, deathYear } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  let q = `"${fullName}"`;
  if (birthPlace) q += ` ${birthPlace.split(',')[0]}`;

  const params = new URLSearchParams({
    q,
    api_key: DPLA_KEY,
    page_size: '20',
    sort_by: 'score',
    fields: 'id,sourceResource,isShownAt,dataProvider,provider,object',
  });
  if (birthYear) {
    params.set('sourceResource.date.begin', String(birthYear - 10));
    params.set('sourceResource.date.end', String((deathYear ?? birthYear) + 30));
  }

  try {
    const res = await fetch(`${DPLA_ENDPOINT}?${params}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { docs?: Record<string, unknown>[] };

    return (data.docs ?? []).map(doc => {
      const sr = (doc.sourceResource ?? {}) as Record<string, unknown>;
      const title = Array.isArray(sr.title) ? (sr.title as string[])[0] : ((sr.title as string) ?? '');
      const desc = Array.isArray(sr.description)
        ? (sr.description as string[])[0]
        : ((sr.description as string) ?? '');
      const creator = Array.isArray(sr.creator)
        ? (sr.creator as string[])[0]
        : ((sr.creator as string) ?? '');
      const dateDisplay = (sr.date as { displayDate?: string } | undefined)?.displayDate ?? '';
      const subjects = ((sr.subject as Array<{ name: string }>) ?? []).map(s => s.name).join(' ');
      const provider = (doc.provider as { name?: string } | undefined)?.name ?? '';
      const url = (doc.isShownAt as string) ?? '';
      const id = (doc['@id'] as string) ?? (doc.id as string) ?? '';

      const combined = title + ' ' + desc + ' ' + subjects;
      let confidence = 25;
      if (combined.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 20;
      if (combined.toLowerCase().includes((givenName ?? '').toLowerCase())) confidence += 10;
      if (combined.toLowerCase().includes(fullName.toLowerCase())) confidence += 15;
      const dateYear = dateDisplay ? parseInt(dateDisplay, 10) : NaN;
      if (birthYear && !isNaN(dateYear) && Math.abs(dateYear - birthYear) <= 15) confidence += 10;
      confidence = Math.min(confidence, 85);

      return {
        id: `dpla-${id}`,
        source: 'archive' as const,
        externalId: id,
        name: creator || fullName,
        recordType: inferRecordType(combined),
        confidence,
        url,
        snippet: (desc || title).slice(0, 250),
        publicationDate: dateDisplay,
        publicationName: `DPLA · ${provider}`,
        rawData: doc,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 25);
  } catch {
    return [];
  }
}
