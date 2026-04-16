/**
 * Open Library (Internet Archive) — genealogy books, local histories, family records.
 * No API key required. https://openlibrary.org/developers/api
 */
import type { RecordSearchQuery, RecordSearchResult } from './types';

const OL_SEARCH = 'https://openlibrary.org/search.json';

export async function searchOpenLibrary(query: RecordSearchQuery): Promise<RecordSearchResult[]> {
  const { givenName, surname, birthPlace } = query;
  if (!surname) return [];

  // Search for surname genealogy + location books
  const location = birthPlace?.split(',').find(p => p.trim().length > 1)?.trim() ?? '';
  const q = [`${surname} genealogy`, location].filter(Boolean).join(' ');

  const params = new URLSearchParams({
    q,
    fields: 'key,title,author_name,first_publish_year,subject,edition_count,ia,cover_i',
    limit: '20',
  });

  try {
    const res = await fetch(`${OL_SEARCH}?${params}`, { next: { revalidate: 7200 } });
    if (!res.ok) return [];
    const data = await res.json() as { docs?: Record<string, unknown>[] };

    return (data.docs ?? []).slice(0, 15).map(doc => {
      const title = (doc.title as string) ?? '';
      const authors: string[] = (doc.author_name as string[] | undefined) ?? [];
      const year = doc.first_publish_year as number | undefined;
      const subjects: string[] = (doc.subject as string[] | undefined) ?? [];
      const key = (doc.key as string) ?? '';
      const ia = (doc.ia as string[] | undefined)?.[0];
      const subjectStr = subjects.slice(0, 5).join(' ');

      let confidence = 15;
      if (title.toLowerCase().includes(surname.toLowerCase())) confidence += 25;
      if (title.toLowerCase().includes('genealog')) confidence += 10;
      if (title.toLowerCase().includes('famil')) confidence += 5;
      if (subjectStr.toLowerCase().includes(surname.toLowerCase())) confidence += 15;
      if (location && (title + subjectStr).toLowerCase().includes(location.toLowerCase())) confidence += 10;
      if ((doc.edition_count as number) > 1) confidence += 3; // multiple editions = well-known work
      confidence = Math.min(confidence, 75);

      const url = ia
        ? `https://archive.org/details/${ia}`
        : `https://openlibrary.org${key}`;

      return {
        id: `ol-${key}`,
        source: 'archive' as const,
        externalId: key,
        name: [givenName, surname].filter(Boolean).join(' '),
        recordType: 'other' as const,
        confidence,
        url,
        snippet: [title, authors[0] ? `by ${authors[0]}` : '', year ? `(${year})` : ''].filter(Boolean).join(' · '),
        publicationDate: year ? String(year) : undefined,
        publicationName: 'Open Library',
        rawData: doc,
      } satisfies RecordSearchResult;
    }).filter(r => r.confidence >= 20);
  } catch {
    return [];
  }
}
