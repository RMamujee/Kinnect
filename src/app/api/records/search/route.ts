import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchFamilySearch }       from '@/lib/familysearch';
import { searchWikiTree }           from '@/lib/wikitree';
import { searchChroniclingAmerica } from '@/lib/chroniclingamerica';
import { searchWikipedia }          from '@/lib/wikipedia';
import { searchInternetArchive }    from '@/lib/internetarchive';
import { searchGoogleNews, searchBingNews } from '@/lib/googlenews';
import type { RecordSearchQuery, RecordSearchResult } from '@/lib/types';

const querySchema = z.object({
  givenName:     z.string().optional(),
  surname:       z.string().optional(),
  birthYear:     z.coerce.number().optional(),
  birthYearRange:z.coerce.number().optional(),
  birthPlace:    z.string().optional(),
  deathYear:     z.coerce.number().optional(),
  deathPlace:    z.string().optional(),
  fatherName:    z.string().optional(),
  motherName:    z.string().optional(),
  spouseName:    z.string().optional(),
  occupation:    z.string().optional(),
  sources:       z.string().optional(), // comma-separated source names
});

// All sources available — caller can restrict via ?sources=wikitree,newspaper
const ALL_SOURCES = ['wikitree', 'newspaper', 'wikipedia', 'archive', 'news'] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sources: sourcesParam, ...queryFields } = parsed.data;
  const query: RecordSearchQuery = queryFields;

  if (!query.givenName && !query.surname) {
    return NextResponse.json(
      { error: 'At least givenName or surname is required' },
      { status: 400 },
    );
  }

  // Default: run everything except FamilySearch (requires OAuth)
  const requestedSources = sourcesParam
    ? sourcesParam.split(',').map(s => s.trim())
    : [...ALL_SOURCES];

  const accessToken = request.headers.get('x-familysearch-token') ?? undefined;

  // Build parallel search promises
  const jobs: Promise<RecordSearchResult[]>[] = [];

  if (requestedSources.includes('familysearch')) {
    jobs.push(searchFamilySearch(query, accessToken));
  }
  if (requestedSources.includes('wikitree')) {
    jobs.push(searchWikiTree(query));
  }
  if (requestedSources.includes('newspaper')) {
    jobs.push(searchChroniclingAmerica(query));
  }
  if (requestedSources.includes('wikipedia')) {
    jobs.push(searchWikipedia(query));
  }
  if (requestedSources.includes('archive')) {
    jobs.push(searchInternetArchive(query));
  }
  if (requestedSources.includes('news')) {
    // Try Bing first (higher quality); fall back to Google News RSS
    const bingKey = process.env.BING_NEWS_API_KEY;
    jobs.push(bingKey ? searchBingNews(query) : searchGoogleNews(query));
  }

  const settled = await Promise.allSettled(jobs);
  const allResults: RecordSearchResult[] = [];

  settled.forEach(r => {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  });

  // Sort by confidence descending
  allResults.sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    results: allResults,
    total:   allResults.length,
    sources: requestedSources,
  });
}
