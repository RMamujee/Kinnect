/**
 * WikiTree API client (no auth required for public profiles)
 * Docs: https://www.wikitree.com/wiki/API_Documentation
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

const BASE_URL = process.env.WIKITREE_BASE_URL ?? 'https://api.wikitree.com/api.php';

const FIELDS = 'Id,Name,FirstName,LastNameAtBirth,LastNameCurrent,BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Gender,IsLiving,Privacy';

export interface WikiTreeProfile {
  Id: number;
  Name?: string;
  FirstName?: string;
  LastNameAtBirth?: string;
  LastNameCurrent?: string;
  BirthDate?: string;   // "YYYY-MM-DD" or "0000-00-00"
  DeathDate?: string;
  BirthLocation?: string;
  DeathLocation?: string;
  Father?: number;      // numeric WT id, 0 = unknown
  Mother?: number;
  Gender?: string;      // "Male" | "Female"
  IsLiving?: number;
  Privacy?: number;     // 60 = public
  status?: string;      // "Ancestor/Descendant permission denied." etc.
}

// ─── Search ───────────────────────────────────────────────────────────────────

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
    fields: FIELDS,
    limit: '20',
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 600 },
    });

    if (!res.ok) return [];

    // WikiTree returns an ARRAY — [{ status, matches: [...] }]
    const data = await res.json();
    const payload = Array.isArray(data) ? data[0] : data;
    const matches: WikiTreeProfile[] = payload?.matches ?? [];

    return matches
      .filter(p => p.Id > 0 && p.Name)
      .map((p): RecordSearchResult => ({
        id: String(p.Id),
        source: 'wikitree',
        externalId: p.Name!,
        name: buildDisplayName(p),
        birthYear: parseWikiTreeYear(p.BirthDate),
        birthPlace: p.BirthLocation || undefined,
        deathYear: parseWikiTreeYear(p.DeathDate),
        deathPlace: p.DeathLocation || undefined,
        recordType: 'other',
        confidence: scoreMatch(p, query),
        url: `https://www.wikitree.com/wiki/${p.Name}`,
        rawData: p as unknown as Record<string, unknown>,
      }));
  } catch (err) {
    console.error('WikiTree search error:', err);
    return [];
  }
}

// ─── Fetch a single profile ───────────────────────────────────────────────────

export async function getWikiTreeProfile(
  wikiTreeId: string,
): Promise<WikiTreeProfile | null> {
  const params = new URLSearchParams({
    action: 'getPeople',
    format: 'json',
    keys: wikiTreeId,
    fields: FIELDS,
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const payload = Array.isArray(data) ? data[0] : data;
    const people = payload?.people ?? {};
    const profiles = Object.values(people) as WikiTreeProfile[];
    return profiles.find(p => p.Id > 0) ?? null;
  } catch {
    return null;
  }
}

// ─── Fetch ancestors (multi-generation) ──────────────────────────────────────
// Uses `action=getPeople&ancestors=N` — the current recommended endpoint.
// Returns a flat map of numeric-id → profile for ALL accessible ancestors.

export async function getWikiTreeAncestors(
  wikiTreeId: string,
  depth: number = 5,
): Promise<Record<number, WikiTreeProfile>> {
  const params = new URLSearchParams({
    action: 'getPeople',
    format: 'json',
    keys: wikiTreeId,
    ancestors: String(Math.min(depth, 10)),
    fields: FIELDS,
  });

  try {
    const res = await fetch(`${BASE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const payload = Array.isArray(data) ? data[0] : data;
    const rawPeople = payload?.people ?? {};

    // Filter out placeholder entries (Id <= 0) and private profiles
    const result: Record<number, WikiTreeProfile> = {};
    for (const [, profile] of Object.entries(rawPeople)) {
      const p = profile as WikiTreeProfile;
      if (p.Id > 0 && !p.status?.includes('denied') && p.Name) {
        result[p.Id] = p;
      }
    }
    return result;
  } catch (err) {
    console.error('WikiTree getAncestors error:', err);
    return {};
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDisplayName(p: WikiTreeProfile): string {
  const given = p.FirstName ?? '';
  const sur = p.LastNameAtBirth ?? p.LastNameCurrent ?? '';
  return [given, sur].filter(Boolean).join(' ') || p.Name || 'Unknown';
}

export function parseWikiTreeYear(dateStr?: string): number | undefined {
  if (!dateStr || dateStr.startsWith('0000')) return undefined;
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : undefined;
}

function scoreMatch(p: WikiTreeProfile, query: RecordSearchQuery): number {
  let score = 50;
  const birthYear = parseWikiTreeYear(p.BirthDate);
  if (query.birthYear && birthYear) {
    const diff = Math.abs(query.birthYear - birthYear);
    if (diff === 0) score += 30;
    else if (diff <= 2) score += 20;
    else if (diff <= 5) score += 10;
    else score -= 10;
  }
  if (query.birthPlace && p.BirthLocation?.toLowerCase().includes(query.birthPlace.toLowerCase())) {
    score += 15;
  }
  return Math.max(0, Math.min(100, score));
}
