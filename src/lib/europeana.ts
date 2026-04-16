/**
 * Europeana API — European cultural heritage: archives, photos, manuscripts, newspapers.
 * Free. Set EUROPEANA_API_KEY in env or uses demo key.
 * Aggregates 50M+ items from 3,000+ European institutions.
 * Docs: https://pro.europeana.eu/page/record-api
 */
import type { RecordSearchQuery, RecordSearchResult, RecordType } from './types';

const EUROPEANA_SEARCH = 'https://api.europeana.eu/record/v2/search.json';
const EUROPEANA_KEY = process.env.EUROPEANA_API_KEY ?? 'api2demo';

function inferRecordType(text: string): RecordType {
  const t = text.toLowerCase();
  if (t.includes('baptis') || t.includes('christening')) return 'church_record';
  if (t.includes('burial') || t.includes('gravestone') || t.includes('funeral')) return 'church_record';
  if (t.includes('newspaper') || t.includes('periodical')) return 'newspaper';
  if (t.includes('photograph') || t.includes('portrait')) return 'photograph';
  if (t.includes('militar') || t.includes('war')) return 'military';
  if (t.includes('immigr') || t.includes('emigr')) return 'immigration';
  if (t.includes('marriage') || t.includes('wed')) return 'marriage_certificate';
  return 'other';
}

export async function searchEuropeana(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear, birthPlace } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    wskey: EUROPEANA_KEY,
    query: `"${fullName}"`,
    rows: '20',
    profile: 'standard',
    sort: 'score desc',
  });

  try {
    const res = await fetch(`${EUROPEANA_SEARCH}?${params}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { items?: Record<string, unknown>[] };

    return (data.items ?? []).map((item, i) => {
      const title = (Array.isArray(item.title) ? item.title[0] : item.title) as string ?? '';
      const desc = (Array.isArray(item.dcDescription) ? item.dcDescription[0] : item.dcDescription) as string ?? '';
      const creator = (Array.isArray(item.dcCreator) ? item.dcCreator[0] : item.dcCreator) as string ?? '';
      const year = (Array.isArray(item.year) ? item.year[0] : item.year) as string ?? '';
      const provider: string = (item.dataProvider as string[] | undefined)?.[0] ?? '';
      const country: string = (item.country as string[] | undefined)?.[0] ?? '';
      const guid = (item.guid as string) ?? (item.id as string) ?? '';
      const thumbnail = (item.edmPreview as string[] | undefined)?.[0] ?? '';

      const combined = title + ' ' + desc + ' ' + creator;
      let confidence = 20;
      if (combined.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 20;
      if (combined.toLowerCase().includes((givenName ?? '').toLowerCase())) confidence += 10;
      if (combined.toLowerCase().includes(fullName.toLowerCase())) confidence += 15;
      if (birthYear && year && Math.abs(parseInt(year, 10) - birthYear) <= 10) confidence += 8;
      if (thumbnail) confidence += 3; // has image = real digitized record
      confidence = Math.min(confidence, 78);

      return {
        id: `europeana-${i}-${guid}`,
        source: 'archive' as const,
        externalId: guid,
        name: creator || fullName,
        recordType: inferRecordType(combined),
        confidence,
        url: guid,
        snippet: (desc || title).slice(0, 250),
        publicationDate: year,
        publicationName: `Europeana · ${provider}${country ? ` (${country})` : ''}`,
        rawData: item,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 20);
  } catch {
    return [];
  }
}
