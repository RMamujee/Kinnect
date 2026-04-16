/**
 * SNAC Cooperative — Social Networks and Archival Contexts.
 * Links historical figures to their archival records across 4,000+ repositories.
 * No API key required. https://snaccooperative.org
 */
import type { RecordSearchQuery, RecordSearchResult } from './types';

const SNAC_API = 'https://snaccooperative.org/api';

export async function searchSNAC(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthYear } = query;
  if (!givenName && !surname) return [];

  const fullName = [givenName, surname].filter(Boolean).join(' ');

  try {
    const res = await fetch(SNAC_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: 'search',
        term: fullName,
        entity_type: 'person',
        count: 20,
        start: 0,
      }),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json() as { results?: Record<string, unknown>[] };

    return (data.results ?? []).map((r, i) => {
      const nameEntries = (r.nameEntries as Array<{ original?: string }> | undefined) ?? [];
      const name = nameEntries[0]?.original ?? fullName;
      const dates = (r.dates as string) ?? '';
      const bio = (r.biogHist as string) ?? '';
      const ark = (r.ark as string) ?? '';
      const entityId = (r.id as string | number) ?? i;

      // Parse dates "YYYY-YYYY" or "b. YYYY" or "fl. YYYY-YYYY"
      const yearMatch = dates.match(/(\d{4})/g) ?? [];
      const bYear = yearMatch[0] ? parseInt(yearMatch[0], 10) : undefined;
      const dYear = yearMatch[1] ? parseInt(yearMatch[1], 10) : undefined;

      let confidence = 25;
      if (name.toLowerCase().includes((surname ?? '').toLowerCase())) confidence += 20;
      if (name.toLowerCase().includes((givenName ?? '').toLowerCase())) confidence += 10;
      if (birthYear && bYear && Math.abs(bYear - birthYear) <= 5) confidence += 20;
      else if (birthYear && bYear && Math.abs(bYear - birthYear) <= 10) confidence += 10;
      if (bio.length > 50) confidence += 5; // has biographical info
      confidence = Math.min(confidence, 85);

      const url = ark
        ? `https://n2t.net/ark:/99166/${ark}`
        : `https://snaccooperative.org/view/${entityId}`;

      return {
        id: `snac-${entityId}`,
        source: 'other' as const,
        externalId: String(entityId),
        name,
        birthYear: bYear,
        deathYear: dYear,
        recordType: 'other' as const,
        confidence,
        url,
        snippet: bio.slice(0, 250) || `${name}${dates ? ` · ${dates}` : ''}`,
        publicationName: 'SNAC Cooperative',
        rawData: r,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 25);
  } catch {
    return [];
  }
}
