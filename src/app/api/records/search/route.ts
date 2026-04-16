import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchFamilySearch } from '@/lib/familysearch';
import { searchWikiTree } from '@/lib/wikitree';
import type { RecordSearchQuery, RecordSearchResult } from '@/lib/types';

const querySchema = z.object({
  givenName: z.string().optional(),
  surname: z.string().optional(),
  birthYear: z.coerce.number().optional(),
  birthYearRange: z.coerce.number().optional(),
  birthPlace: z.string().optional(),
  deathYear: z.coerce.number().optional(),
  deathPlace: z.string().optional(),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  spouseName: z.string().optional(),
  sources: z.string().optional(), // comma-separated: "familysearch,wikitree"
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }

  const { sources: sourcesParam, ...queryFields } = parsed.data;
  const query: RecordSearchQuery = queryFields;
  // FamilySearch requires OAuth — default to WikiTree only until user authenticates
  const requestedSources = sourcesParam?.split(',') ?? ['wikitree'];

  // Require at least a name to search
  if (!query.givenName && !query.surname) {
    return NextResponse.json({ error: 'At least givenName or surname is required' }, { status: 400 });
  }

  const accessToken = request.headers.get('x-familysearch-token') ?? undefined;
  const promises: Promise<RecordSearchResult[]>[] = [];

  if (requestedSources.includes('familysearch')) {
    promises.push(searchFamilySearch(query, accessToken));
  }
  if (requestedSources.includes('wikitree')) {
    promises.push(searchWikiTree(query));
  }

  const results = await Promise.allSettled(promises);
  const allResults: RecordSearchResult[] = [];

  results.forEach(r => {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  });

  // Sort by confidence desc
  allResults.sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({ results: allResults, total: allResults.length });
}
