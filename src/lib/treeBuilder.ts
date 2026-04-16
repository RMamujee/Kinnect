/**
 * Tree Builder
 * Converts a flat map of WikiTreeProfile objects into Person + Family records
 * and merges them into the genealogy store.
 *
 * Flow:
 *  1. getWikiTreeAncestors(wikiTreeId, depth) → Record<numericId, WikiTreeProfile>
 *  2. buildPersonsFromWikiTree(profiles) → { persons, families }
 *  3. Store.importExternalPersons(persons, families)
 */

import type { Person, Family, PersonName, Fact, ConfidenceLevel } from './types';
import type { WikiTreeProfile } from './wikitree';
import { parseWikiTreeYear } from './wikitree';
import { generateId, nowISO } from './utils';

export interface BuildResult {
  persons: Person[];
  families: Family[];
  /** Maps WikiTree numeric ID → our internal personId */
  idMap: Record<number, string>;
}

function defaultGPSStatus() {
  return {
    searchCompleted: true,
    sourcesSearched: ['WikiTree'],
    allFactsCited: false,
    citationCount: 0,
    sourcesAnalyzed: false,
    conflictsIdentified: 0,
    conflictsResolved: false,
    unresolvedConflicts: 0,
    conclusionWritten: false,
    overallConfidence: 'unverified' as ConfidenceLevel,
  };
}

function wikiTreeProfileToPerson(profile: WikiTreeProfile): Person {
  const id = generateId();
  const now = nowISO();

  const given = profile.FirstName ?? '';
  const surname = profile.LastNameAtBirth ?? profile.LastNameCurrent ?? '';
  const birthYear = parseWikiTreeYear(profile.BirthDate);
  const deathYear = parseWikiTreeYear(profile.DeathDate);

  const name: PersonName = {
    id: generateId(),
    personId: id,
    given,
    surname,
    type: 'birth',
    isPreferred: true,
    citationIds: [],
  };

  const facts: Fact[] = [];

  if (birthYear || profile.BirthLocation) {
    facts.push({
      id: generateId(),
      personId: id,
      type: 'birth',
      date: birthYear ? { year: birthYear } : undefined,
      place: profile.BirthLocation ? { fullText: profile.BirthLocation } : undefined,
      confidence: 'probable',
      citationIds: [],
      isPreferred: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (deathYear || profile.DeathLocation) {
    facts.push({
      id: generateId(),
      personId: id,
      type: 'death',
      date: deathYear ? { year: deathYear } : undefined,
      place: profile.DeathLocation ? { fullText: profile.DeathLocation } : undefined,
      confidence: 'probable',
      citationIds: [],
      isPreferred: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  const gender = profile.Gender === 'Male' ? 'male'
    : profile.Gender === 'Female' ? 'female'
    : 'unknown';

  return {
    id,
    names: [name],
    gender,
    facts,
    birthYear,
    birthPlace: profile.BirthLocation || undefined,
    deathYear,
    isLiving: profile.IsLiving === 1,
    wikiTreeId: profile.Name,
    gpsStatus: defaultGPSStatus(),
    addedByUser: false,
    autoPopulated: true,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Convert a flat map of WikiTree profiles into Person[] + Family[].
 * Handles deduplication — skips any wikiTreeId already in `existingWikiTreeIds`.
 */
export function buildPersonsFromWikiTree(
  profiles: Record<number, WikiTreeProfile>,
  existingWikiTreeIds: Set<string> = new Set(),
): BuildResult {
  const persons: Person[] = [];
  const idMap: Record<number, string> = {};  // numericId → our personId

  // First pass: create Person objects (skip already-known profiles)
  for (const [numId, profile] of Object.entries(profiles)) {
    const numericId = Number(numId);
    if (numericId <= 0 || !profile.Name) continue;
    if (existingWikiTreeIds.has(profile.Name)) continue;

    const person = wikiTreeProfileToPerson(profile);
    persons.push(person);
    idMap[numericId] = person.id;
  }

  // Second pass: build Family units from Father/Mother relationships
  const familyMap = new Map<string, Family>();  // key: "fatherId|motherId"

  for (const [numId, profile] of Object.entries(profiles)) {
    const numericId = Number(numId);
    const childPersonId = idMap[numericId];
    if (!childPersonId) continue;  // might be a known person — still need their family

    const fatherNumId = profile.Father && profile.Father > 0 ? profile.Father : undefined;
    const motherNumId = profile.Mother && profile.Mother > 0 ? profile.Mother : undefined;

    if (!fatherNumId && !motherNumId) continue;

    // Get our internal IDs for parents (they might be in idMap OR in existingPersonIds)
    const fatherPersonId = fatherNumId ? idMap[fatherNumId] : undefined;
    const motherPersonId = motherNumId ? idMap[motherNumId] : undefined;

    if (!fatherPersonId && !motherPersonId) continue;

    const famKey = `${fatherPersonId ?? '?'}|${motherPersonId ?? '?'}`;

    if (!familyMap.has(famKey)) {
      const now = nowISO();
      familyMap.set(famKey, {
        id: generateId(),
        spouse1Id: fatherPersonId,
        spouse2Id: motherPersonId,
        childIds: [childPersonId],
        relationshipType: 'biological',
        citationIds: [],
        createdAt: now,
        updatedAt: now,
      });
    } else {
      const fam = familyMap.get(famKey)!;
      if (!fam.childIds.includes(childPersonId)) {
        fam.childIds.push(childPersonId);
      }
    }
  }

  return {
    persons,
    families: Array.from(familyMap.values()),
    idMap,
  };
}
