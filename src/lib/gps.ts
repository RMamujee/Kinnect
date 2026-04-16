/**
 * GPS — Genealogical Proof Standard helpers
 *
 * The 5 GPS elements:
 *  1. Reasonably exhaustive search
 *  2. Complete and accurate citations of source(s) consulted
 *  3. Analysis and correlation of the collected information
 *  4. Resolution of any conflicting evidence
 *  5. A soundly reasoned, coherently written conclusion
 *
 * Reference: Board for Certification of Genealogists, Genealogy Standards, 2nd ed. (2019)
 */

import type { Person, Family, Source, Citation, GPSStatus, ConfidenceLevel } from './types';
import { nowISO } from './utils';

export const GPS_ELEMENTS = [
  {
    id: 'search',
    label: 'Exhaustive Search',
    description: 'All reasonably available sources have been consulted.',
    weight: 20,
  },
  {
    id: 'citations',
    label: 'Complete Citations',
    description: 'Every assertion is backed by a complete, accurate citation.',
    weight: 20,
  },
  {
    id: 'analysis',
    label: 'Source Analysis',
    description: 'Each source has been evaluated for origin, content, and purpose.',
    weight: 20,
  },
  {
    id: 'conflicts',
    label: 'Conflict Resolution',
    description: 'All conflicting evidence has been identified and resolved.',
    weight: 20,
  },
  {
    id: 'conclusion',
    label: 'Reasoned Conclusion',
    description: 'A written conclusion correlates all evidence and explains the reasoning.',
    weight: 20,
  },
] as const;

export const RECOMMENDED_SOURCES: { type: string; description: string; url?: string }[] = [
  { type: 'FamilySearch', description: 'Largest free genealogy database; birth, death, marriage, census records', url: 'https://www.familysearch.org' },
  { type: 'WikiTree', description: 'Collaborative open family tree with linked sources', url: 'https://www.wikitree.com' },
  { type: 'Find A Grave', description: 'Millions of grave records with photos and transcriptions', url: 'https://www.findagrave.com' },
  { type: 'BillionGraves', description: 'GPS-tagged grave records', url: 'https://billiongraves.com' },
  { type: 'US Census Records', description: '1790–1940 census records (digitized by FamilySearch & Ancestry)', url: 'https://www.familysearch.org/search/collection/list' },
  { type: 'State Vital Records', description: 'Birth, death, and marriage certificates from state offices' },
  { type: 'SSDI', description: 'Social Security Death Index — deaths after 1962', url: 'https://www.familysearch.org/search/collection/1202535' },
  { type: 'Ellis Island / Immigration', description: 'Ship manifests and immigration records 1892–1957', url: 'https://www.libertyellisfoundation.org' },
  { type: 'Fold3', description: 'Military records, draft registrations, pension files' },
  { type: 'Newspapers.com / Chronicling America', description: 'Historical newspaper archives', url: 'https://chroniclingamerica.loc.gov' },
];

export function evaluateGPS(
  person: Person,
  citations: Record<string, Citation>,
  sources: Record<string, Source>,
): GPSStatus {
  const personCitations = Object.values(citations).filter(c => c.personId === person.id);
  const citedFactIds = new Set(personCitations.map(c => c.factId));
  const allFactIds = person.facts.map(f => f.id);
  const allFactsCited = allFactIds.length > 0 && allFactIds.every(id => citedFactIds.has(id));

  const sourcesForPerson = personCitations
    .map(c => sources[c.sourceId])
    .filter(Boolean);

  const sourcesAnalyzed = sourcesForPerson.length > 0 &&
    sourcesForPerson.every(s => s.analysis && s.analysis.length > 10);

  const conflictingSources = sourcesForPerson.filter(s => s.conflicts && s.conflicts.length > 0);
  const conflictsIdentified = conflictingSources.length;
  const conflictsResolved = conflictingSources.every(
    s => s.resolutionNotes && s.resolutionNotes.length > 0
  );
  const unresolvedConflicts = conflictingSources.filter(
    s => !s.resolutionNotes || s.resolutionNotes.length === 0
  ).length;

  const existing = person.gpsStatus;

  return {
    searchCompleted: existing?.searchCompleted ?? false,
    sourcesSearched: existing?.sourcesSearched ?? [],
    allFactsCited,
    citationCount: personCitations.length,
    sourcesAnalyzed,
    conflictsIdentified,
    conflictsResolved,
    unresolvedConflicts,
    conclusionWritten: !!(existing?.conclusionText && existing.conclusionText.length > 50),
    conclusionText: existing?.conclusionText,
    overallConfidence: computeOverallConfidence(person, personCitations),
    lastReviewedAt: nowISO(),
  };
}

function computeOverallConfidence(
  person: Person,
  citations: Citation[],
): ConfidenceLevel {
  if (citations.length === 0) return 'unverified';
  const hasConflict = citations.some(c => c.confidence === 'conflicting');
  if (hasConflict) return 'conflicting';
  const allProven = citations.every(c => c.confidence === 'proven');
  if (allProven && citations.length >= 2) return 'proven';
  const anyProbable = citations.some(c => c.confidence === 'proven' || c.confidence === 'probable');
  if (anyProbable) return 'probable';
  return 'possible';
}

const CREDIBLE_SOURCES = new Set([
  'WikiTree', 'FamilySearch', 'Ancestry', 'FindMyPast', 'MyHeritage',
  'NARA', 'Findmypast', 'Fold3', 'DPLA', 'LOC',
]);

export interface GPSGateResult {
  approved: boolean;
  reason?: string;
}

/**
 * Internal gate applied before any person is automatically added to the tree.
 * Enforces minimum GPS-standard evidence requirements without exposing the
 * framework to the user.
 */
export function checkGPSGate(candidate: Person): GPSGateResult {
  // Must originate from at least one credible genealogical source
  const hasCredibleSource = candidate.gpsStatus.sourcesSearched.some(s => CREDIBLE_SOURCES.has(s));
  if (!hasCredibleSource) {
    return { approved: false, reason: 'No credible genealogical source recorded' };
  }

  // Must have an identifiable name
  const preferredName = candidate.names.find(n => n.isPreferred) ?? candidate.names[0];
  if (!preferredName || (!preferredName.given.trim() && !preferredName.surname.trim())) {
    return { approved: false, reason: 'No identifiable name' };
  }

  return { approved: true };
}

export function buildCitationString(source: Source, citation: Citation): string {
  // Mills' Evidence Explained citation format (abbreviated)
  const parts: string[] = [];
  if (source.author) parts.push(source.author + ',');
  parts.push(`"${source.title}"`);
  if (source.publisher) parts.push(`(${source.publisher})`);
  if (citation.page) parts.push(`p. ${citation.page}`);
  if (source.repositoryUrl) parts.push(`[${source.repositoryUrl}]`);
  if (citation.detail) parts.push(`— ${citation.detail}`);
  parts.push(`accessed ${source.accessDate ?? 'n.d.'}`);
  return parts.join(', ') + '.';
}
