/**
 * WikiTree API client (no auth required for read-only operations)
 * Docs: https://www.wikitree.com/wiki/API_Documentation
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

const BASE_URL = process.env.WIKITREE_BASE_URL ?? 'https://api.wikitree.com/api.php';

interface WikiTreeProfile {
  Id?: number;
  Name?: string;
  FirstName?: string;
  LastNameAtBirth?: string;
  LastNameCurrent?: string;
  BirthDate?: string;
  DeathDate?: string;
  BirthLocation?: string;
  DeathLocation?: string;
  Father?: number;
  Mother?: number;
  Gender?: string;
  PageId?: number;
}

interface WikiTreeSearchResponse {
  status?: string;
  matches?: WikiTreeProfile[];
}

export async function searchWikiTree(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  if (!query.surname && !query.givenName) return [];

  const params = new URLSearchParams({
    action: 'searchPerson',
    format: 'json',
    FirstName: query.givenName ?? '',
    LastName: query.surname ?? '',
    BirthDate: query.birthYear ? String(query.birthYear) : '',
    BirthLocation: query.birthPlace ?? '',
    fields: 'Id,Name,FirstName,LastNameAtBirth,BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Gender',
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];
    const data: WikiTreeSearchResponse = await res.json();
    return parseWikiTreeResults(data);
  } catch (err) {
    console.error('WikiTree fetch error:', err);
    return [];
  }
}

function parseWikiTreeResults(data: WikiTreeSearchResponse): RecordSearchResult[] {
  if (!data.matches) return [];

  return data.matches.map((profile): RecordSearchResult => {
    const name = [profile.FirstName, profile.LastNameAtBirth].filter(Boolean).join(' ') || profile.Name || 'Unknown';
    return {
      id: String(profile.Id ?? Math.random()),
      source: 'wikitree',
      externalId: profile.Name ?? String(profile.Id ?? ''),
      name,
      birthYear: parseWikiTreeYear(profile.BirthDate),
      birthPlace: profile.BirthLocation,
      deathYear: parseWikiTreeYear(profile.DeathDate),
      deathPlace: profile.DeathLocation,
      recordType: 'other',
      confidence: 70,
      url: profile.Name ? `https://www.wikitree.com/wiki/${profile.Name}` : undefined,
      rawData: profile as Record<string, unknown>,
    };
  });
}

function parseWikiTreeYear(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : undefined;
}

export async function getWikiTreeProfile(
  wikiTreeId: string,
): Promise<WikiTreeProfile | null> {
  const params = new URLSearchParams({
    action: 'getProfile',
    format: 'json',
    key: wikiTreeId,
    fields: '*',
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile ?? null;
  } catch {
    return null;
  }
}

export async function getWikiTreeAncestors(
  wikiTreeId: string,
  depth: number = 5,
): Promise<WikiTreeProfile[]> {
  const params = new URLSearchParams({
    action: 'getAncestors',
    format: 'json',
    key: wikiTreeId,
    depth: String(depth),
    fields: 'Id,Name,FirstName,LastNameAtBirth,BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Gender',
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const ancestors: WikiTreeProfile[] = [];
    if (data.ancestors) {
      Object.values(data.ancestors).forEach((p) => {
        ancestors.push(p as WikiTreeProfile);
      });
    }
    return ancestors;
  } catch {
    return [];
  }
}
