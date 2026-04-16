/**
 * POST /api/ancestors/suggest
 *
 * Given a person and which relations are missing, searches across all available
 * sources for likely ancestors/kin. Returns ranked suggestions per relation.
 *
 * Body: {
 *   person: { givenName, surname, birthYear, birthPlace, gender },
 *   missingRelations: ('father'|'mother'|'spouse'|'sibling'|'child')[],
 *   accessToken?: string   // FamilySearch OAuth token (optional)
 * }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchWikiTree }           from '@/lib/wikitree';
import { searchFamilySearch }       from '@/lib/familysearch';
import { searchChroniclingAmerica } from '@/lib/chroniclingamerica';
import { searchNARA }               from '@/lib/nara';
import { searchDPLA }               from '@/lib/dpla';
import { searchWikidata }           from '@/lib/wikidata';
import { searchInternetArchive }    from '@/lib/internetarchive';
import type { RecordSearchQuery, RecordSearchResult } from '@/lib/types';

const bodySchema = z.object({
  person: z.object({
    givenName:  z.string().optional(),
    surname:    z.string(),
    birthYear:  z.number().optional(),
    birthPlace: z.string().optional(),
    gender:     z.enum(['male', 'female', 'unknown']).optional(),
  }),
  missingRelations: z.array(
    z.enum(['father', 'mother', 'spouse', 'sibling', 'child', 'paternal_grandfather',
            'paternal_grandmother', 'maternal_grandfather', 'maternal_grandmother'])
  ).default(['father', 'mother']),
  accessToken: z.string().optional(),
});

/** Estimate expected birth year for an ancestor relative. */
function estimatedBirthYear(
  personBirthYear: number,
  relation: string,
): { min: number; max: number; estimate: number } {
  const offsets: Record<string, number> = {
    father:               27,
    mother:               25,
    paternal_grandfather: 55,
    paternal_grandmother: 53,
    maternal_grandfather: 55,
    maternal_grandmother: 53,
    sibling:              3,
    child:               -27,
    spouse:               2,
  };
  const spread = relation.includes('grand') ? 15 : 10;
  const offset = offsets[relation] ?? 25;
  const estimate = personBirthYear - offset;
  return { min: estimate - spread, max: estimate + spread, estimate };
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { person, missingRelations, accessToken } = parsed.data;

  // Build a query for each missing relation and search in parallel
  const relationJobs = missingRelations.map(async relation => {
    const yearRange = person.birthYear
      ? estimatedBirthYear(person.birthYear, relation)
      : null;

    // For parent/grandparent searches, use the person's surname as a starting point.
    // For spouse, search both surnames. For child, use person as parent.
    const baseQuery: RecordSearchQuery = {
      surname: person.surname,
      birthYear: yearRange?.estimate,
      birthYearRange: yearRange ? (yearRange.max - yearRange.min) / 2 : 10,
      birthPlace: person.birthPlace,
    };

    // Customise the query by relation type
    if (relation === 'father') {
      baseQuery.fatherName = undefined;
      baseQuery.motherName = undefined;
    } else if (relation === 'mother') {
      // Mothers may have maiden names; surname search less reliable
      baseQuery.surname = undefined; // widen search
      baseQuery.givenName = undefined;
      baseQuery.birthYear = yearRange?.estimate;
      baseQuery.spouseName = [person.givenName, person.surname].filter(Boolean).join(' ') || undefined;
    } else if (relation === 'child') {
      baseQuery.fatherName = person.gender === 'male'
        ? [person.givenName, person.surname].filter(Boolean).join(' ')
        : undefined;
      baseQuery.motherName = person.gender === 'female'
        ? [person.givenName, person.surname].filter(Boolean).join(' ')
        : undefined;
    } else if (relation === 'spouse') {
      baseQuery.spouseName = [person.givenName, person.surname].filter(Boolean).join(' ');
      baseQuery.surname = undefined; // spouse may have different surname
    }

    // Run searches across all suitable sources in parallel
    const [
      wikitreeResults,
      familysearchResults,
      chroniclingResults,
      naraResults,
      dplaResults,
      wikidataResults,
      archiveResults,
    ] = await Promise.allSettled([
      searchWikiTree(baseQuery),
      accessToken ? searchFamilySearch(baseQuery, accessToken) : Promise.resolve([]),
      searchChroniclingAmerica(baseQuery),
      searchNARA(baseQuery),
      searchDPLA(baseQuery),
      searchWikidata(baseQuery),
      searchInternetArchive(baseQuery),
    ]);

    const results: RecordSearchResult[] = [];
    [wikitreeResults, familysearchResults, chroniclingResults, naraResults,
     dplaResults, wikidataResults, archiveResults].forEach(r => {
      if (r.status === 'fulfilled') results.push(...r.value);
    });

    // Sort by confidence and deduplicate by URL
    const seen = new Set<string>();
    const deduped = results
      .sort((a, b) => b.confidence - a.confidence)
      .filter(r => {
        const key = r.url ?? r.externalId;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10); // top 10 per relation

    return {
      relation,
      estimatedBirthYear: yearRange?.estimate,
      estimatedBirthRange: yearRange ? `${yearRange.min}–${yearRange.max}` : null,
      suggestions: deduped,
    };
  });

  const settled = await Promise.allSettled(relationJobs);
  const suggestions = settled
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<typeof relationJobs extends Array<Promise<infer T>> ? T : never>).value);

  return NextResponse.json({ suggestions });
}
