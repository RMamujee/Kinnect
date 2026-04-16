import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchFamilySearch }       from '@/lib/familysearch';
import { searchWikiTree }           from '@/lib/wikitree';
import { searchChroniclingAmerica } from '@/lib/chroniclingamerica';
import { searchWikipedia }          from '@/lib/wikipedia';
import { searchInternetArchive }    from '@/lib/internetarchive';
import { searchGoogleNews, searchBingNews } from '@/lib/googlenews';
import { searchWikidata }           from '@/lib/wikidata';
import { searchNARA }               from '@/lib/nara';
import { searchDPLA }               from '@/lib/dpla';
import { searchOpenLibrary }        from '@/lib/openlibrary';
import { searchTrove }              from '@/lib/trove';
import { searchLOCCollections }     from '@/lib/loc';
import { searchEuropeana }          from '@/lib/europeana';
import { searchSNAC }               from '@/lib/snac';
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

// All source keys — caller can restrict via ?sources=wikitree,newspaper
const ALL_SOURCES = [
  'wikitree', 'familysearch',
  'newspaper', 'wikipedia', 'archive', 'news',
  'wikidata', 'nara', 'dpla', 'openlibrary',
  'trove', 'loc', 'europeana', 'snac',
] as const;

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

  // Default: run all sources except FamilySearch (requires OAuth token)
  const requestedSources = sourcesParam
    ? sourcesParam.split(',').map(s => s.trim())
    : ALL_SOURCES.filter(s => s !== 'familysearch');

  const accessToken = request.headers.get('x-familysearch-token') ?? undefined;

  // Build parallel search promises
  const jobs: Promise<RecordSearchResult[]>[] = [];

  if (requestedSources.includes('familysearch') && accessToken) {
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
    const bingKey = process.env.BING_NEWS_API_KEY;
    jobs.push(bingKey ? searchBingNews(query) : searchGoogleNews(query));
  }
  // ── New sources ──────────────────────────────────────────────────────────────
  if (requestedSources.includes('wikidata')) {
    jobs.push(searchWikidata(query));
  }
  if (requestedSources.includes('nara')) {
    jobs.push(searchNARA(query));
  }
  if (requestedSources.includes('dpla')) {
    jobs.push(searchDPLA(query));
  }
  if (requestedSources.includes('openlibrary')) {
    jobs.push(searchOpenLibrary(query));
  }
  if (requestedSources.includes('trove')) {
    jobs.push(searchTrove(query));
  }
  if (requestedSources.includes('loc')) {
    jobs.push(searchLOCCollections(query));
  }
  if (requestedSources.includes('europeana')) {
    jobs.push(searchEuropeana(query));
  }
  if (requestedSources.includes('snac')) {
    jobs.push(searchSNAC(query));
  }

  const settled = await Promise.allSettled(jobs);
  const allResults: RecordSearchResult[] = [];
  settled.forEach(r => {
    if (r.status === 'fulfilled') allResults.push(...r.value);
  });

  // Deduplicate by URL, keeping highest-confidence version
  const byUrl = new Map<string, RecordSearchResult>();
  for (const r of allResults) {
    const key = r.url ?? `${r.source}-${r.externalId}`;
    const existing = byUrl.get(key);
    if (!existing || r.confidence > existing.confidence) byUrl.set(key, r);
  }

  const deduped = [...byUrl.values()].sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({
    results: deduped,
    total:   deduped.length,
    sources: requestedSources,
    sourcesQueried: jobs.length,
  });
}
