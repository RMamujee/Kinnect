/**
 * Internet Archive — Full-Text Search
 * https://archive.org/advancedsearch.php
 *
 * Free API, no key required. Covers:
 *   - Digitized books & genealogy guides
 *   - Scanned newspapers and periodicals
 *   - Historical documents (city directories, census transcriptions)
 *   - Oral history recordings
 *   - Family history collections uploaded by researchers
 *
 * Particularly strong for city directory transcriptions (pre-1960)
 * which list names, addresses, and occupations year by year.
 */

import type { RecordSearchQuery, RecordSearchResult } from './types';

interface ArchiveDoc {
  identifier:   string;
  title:        string | string[];
  description?: string | string[];
  date?:        string;
  subject?:     string | string[];
  creator?:     string | string[];
  mediatype?:   string;
  downloads?:   number;
}

interface ArchiveResponse {
  response?: {
    docs:     ArchiveDoc[];
    numFound: number;
  };
}

export async function searchInternetArchive(
  query: RecordSearchQuery,
): Promise<RecordSearchResult[]> {
  if (!query.givenName && !query.surname) return [];

  const fullName = [query.givenName, query.surname].filter(Boolean).join(' ');

  // Build a targeted Lucene query
  const namePart = `"${fullName}"`;
  const subjectFilter =
    '(subject:genealogy OR subject:biography OR subject:directory ' +
    'OR subject:census OR subject:obituary OR subject:immigration ' +
    'OR mediatype:texts)';
  const q = `${namePart} AND ${subjectFilter}`;

  const fields = ['identifier', 'title', 'description', 'date', 'subject', 'creator', 'mediatype', 'downloads'].join(',');

  const params = new URLSearchParams({
    q,
    fl:     fields,
    rows:   '10',
    output: 'json',
    sort:   'downloads desc',   // most-accessed items first
  });

  // Add date constraint when birth year known
  if (query.birthYear) {
    const from = query.birthYear - 10;
    const to   = query.deathYear ? query.deathYear + 20 : query.birthYear + 100;
    params.append('q', ` AND date:[${from} TO ${to}]`);
  }

  try {
    const res = await fetch(`https://archive.org/advancedsearch.php?${params}`, {
      headers: {
        'User-Agent': 'Kinnect Genealogy App/1.0 (genealogy research)',
        Accept: 'application/json',
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];

    const data: ArchiveResponse = await res.json();
    const docs = data.response?.docs ?? [];

    return docs.map((doc): RecordSearchResult => {
      const title       = firstOf(doc.title)       ?? fullName;
      const description = firstOf(doc.description) ?? undefined;
      const date        = doc.date?.slice(0, 10)   ?? undefined;
      const confidence  = scoreArchiveDoc(doc, query, fullName);

      return {
        id:             `ia-${doc.identifier}`,
        source:         'archive',
        externalId:     doc.identifier,
        name:           title,
        recordType:     inferMediaType(doc),
        confidence,
        publicationDate: date,
        snippet:        description ? description.slice(0, 300).trim() : undefined,
        url:            `https://archive.org/details/${doc.identifier}`,
        rawData: {
          identifier: doc.identifier,
          mediatype:  doc.mediatype,
          date,
          downloads:  doc.downloads,
        },
      };
    });
  } catch (err) {
    console.error('[InternetArchive] search error:', err);
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function firstOf(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function scoreArchiveDoc(doc: ArchiveDoc, query: RecordSearchQuery, fullName: string): number {
  const title = firstOf(doc.title)?.toLowerCase() ?? '';
  const desc  = firstOf(doc.description)?.toLowerCase() ?? '';
  const subj  = (Array.isArray(doc.subject) ? doc.subject : [doc.subject ?? '']).join(' ').toLowerCase();
  let score   = 25;

  const surname = (query.surname ?? '').toLowerCase();
  if (title.includes(fullName.toLowerCase()))  score += 25;
  else if (title.includes(surname))            score += 10;
  if (desc.includes(fullName.toLowerCase()))   score += 15;
  if (query.birthPlace && (title + desc + subj).includes(query.birthPlace.toLowerCase())) score += 10;
  if (query.birthYear && desc.includes(String(query.birthYear)))                          score += 10;
  if (subj.includes('genealogy') || subj.includes('biography'))                           score += 5;
  if ((doc.downloads ?? 0) > 1000) score += 5;  // popular items more likely to be useful

  return Math.min(85, score);
}

function inferMediaType(doc: ArchiveDoc): RecordSearchResult['recordType'] {
  const subj = (Array.isArray(doc.subject) ? doc.subject : [doc.subject ?? '']).join(' ').toLowerCase();
  const title = firstOf(doc.title)?.toLowerCase() ?? '';

  if (subj.includes('obituary') || title.includes('obituary'))       return 'obituary';
  if (subj.includes('census'))                                        return 'census';
  if (subj.includes('immigration') || title.includes('immigration'))  return 'immigration';
  if (subj.includes('military') || title.includes('military'))        return 'military';
  if (subj.includes('newspaper') || doc.mediatype === 'texts')        return 'newspaper';
  return 'other';
}
