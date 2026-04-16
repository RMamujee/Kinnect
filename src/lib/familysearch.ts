/**
 * FamilySearch API client
 * Docs: https://www.familysearch.org/developers/docs/api
 *
 * Uses OAuth 2.0 — users must authorize via /api/familysearch/auth
 */

import type { RecordSearchQuery, RecordSearchResult, RecordType } from './types';

const BASE_URL = process.env.FAMILYSEARCH_BASE_URL ?? 'https://api.familysearch.org';

// Map FS collection names to our RecordType
const FS_RECORD_TYPE_MAP: Record<string, RecordType> = {
  'United States Census': 'census',
  'Birth': 'birth_certificate',
  'Death': 'death_certificate',
  'Marriage': 'marriage_certificate',
  'Immigration': 'immigration',
  'Military': 'military',
  'Obituary': 'obituary',
  'Naturalization': 'naturalization',
};

export interface FSPerson {
  id: string;
  names?: Array<{
    nameForms?: Array<{ fullText?: string; parts?: Array<{ type: string; value: string }> }>;
  }>;
  gender?: { type: string };
  facts?: Array<{
    type: string;
    date?: { original?: string; formal?: string };
    place?: { original?: string };
  }>;
  links?: { 'family-tree-url'?: { href?: string } };
}

export interface FSSearchResponse {
  entries?: Array<{
    id?: string;
    score?: number;
    content?: {
      gedcomx?: {
        persons?: FSPerson[];
        relationships?: unknown[];
      };
    };
    links?: { 'about'?: { href?: string } };
    title?: string;
  }>;
  results?: number;
}

export async function searchFamilySearch(
  query: RecordSearchQuery,
  accessToken?: string,
): Promise<RecordSearchResult[]> {
  const params = new URLSearchParams();
  params.set('count', '20');

  if (query.givenName) params.set('q.givenName', query.givenName);
  if (query.surname) params.set('q.surname', query.surname);
  if (query.birthYear) {
    const range = query.birthYearRange ?? 2;
    params.set('q.birthLikeDate.from', String(query.birthYear - range));
    params.set('q.birthLikeDate.to', String(query.birthYear + range));
  }
  if (query.birthPlace) params.set('q.birthLikePlace', query.birthPlace);
  if (query.deathYear) params.set('q.deathLikeDate.from', String(query.deathYear - 2));
  if (query.fatherName) params.set('q.fatherGivenName', query.fatherName.split(' ')[0]);
  if (query.motherName) params.set('q.motherGivenName', query.motherName.split(' ')[0]);
  if (query.spouseName) params.set('q.spouseGivenName', query.spouseName.split(' ')[0]);

  const headers: HeadersInit = {
    Accept: 'application/x-gedcomx-atom+json',
  };
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(
      `${BASE_URL}/platform/records/search?${params.toString()}`,
      { headers, next: { revalidate: 300 } }
    );

    if (!res.ok) {
      console.error('FamilySearch search failed:', res.status, await res.text());
      return [];
    }

    const data: FSSearchResponse = await res.json();
    return parseFSResults(data);
  } catch (err) {
    console.error('FamilySearch fetch error:', err);
    return [];
  }
}

function parseFSResults(data: FSSearchResponse): RecordSearchResult[] {
  if (!data.entries) return [];

  return data.entries.map((entry) => {
    const person = entry.content?.gedcomx?.persons?.[0];
    const name = person?.names?.[0]?.nameForms?.[0]?.fullText ?? entry.title ?? 'Unknown';

    const birthFact = person?.facts?.find(f => f.type?.includes('Birth'));
    const deathFact = person?.facts?.find(f => f.type?.includes('Death'));

    const birthYear = parseFSYear(birthFact?.date?.formal ?? birthFact?.date?.original);
    const deathYear = parseFSYear(deathFact?.date?.formal ?? deathFact?.date?.original);

    return {
      id: entry.id ?? crypto.randomUUID(),
      source: 'familysearch' as const,
      externalId: entry.id ?? '',
      name,
      birthYear,
      birthPlace: birthFact?.place?.original,
      deathYear,
      deathPlace: deathFact?.place?.original,
      recordType: 'other' as RecordType,
      confidence: Math.round((entry.score ?? 0) * 100),
      url: entry.links?.about?.href,
      rawData: entry as Record<string, unknown>,
    };
  });
}

function parseFSYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : undefined;
}

export async function getFamilySearchPerson(
  personId: string,
  accessToken: string,
): Promise<FSPerson | null> {
  const res = await fetch(
    `${BASE_URL}/platform/tree/persons/${personId}`,
    {
      headers: {
        Accept: 'application/x-gedcomx-v1+json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  return data?.persons?.[0] ?? null;
}

export async function getFamilySearchAncestry(
  personId: string,
  generations: number,
  accessToken: string,
): Promise<FSPerson[]> {
  const res = await fetch(
    `${BASE_URL}/platform/tree/ancestry?person=${personId}&generations=${generations}`,
    {
      headers: {
        Accept: 'application/x-gedcomx-v1+json',
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) return [];
  const data = await res.json();
  return data?.persons ?? [];
}
