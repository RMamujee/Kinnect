import { NextRequest } from 'next/server';
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

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  givenName:      z.string().optional(),
  surname:        z.string().optional(),
  birthYear:      z.coerce.number().optional(),
  birthYearRange: z.coerce.number().optional(),
  birthPlace:     z.string().optional(),
  deathYear:      z.coerce.number().optional(),
  deathPlace:     z.string().optional(),
  fatherName:     z.string().optional(),
  motherName:     z.string().optional(),
  spouseName:     z.string().optional(),
  occupation:     z.string().optional(),
  sources:        z.string().optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid query' }), { status: 400 });
  }

  const { sources: sourcesParam, ...queryFields } = parsed.data;
  const query: RecordSearchQuery = queryFields;

  if (!query.givenName && !query.surname) {
    return new Response(JSON.stringify({ error: 'At least givenName or surname is required' }), { status: 400 });
  }

  const accessToken = request.headers.get('x-familysearch-token') ?? undefined;
  const requestedSources = sourcesParam
    ? sourcesParam.split(',').map(s => s.trim())
    : ['wikitree', 'newspaper', 'wikipedia', 'archive', 'news',
       'wikidata', 'nara', 'dpla', 'openlibrary', 'trove', 'loc', 'europeana', 'snac'];

  if (accessToken) requestedSources.push('familysearch');

  const encoder = new TextEncoder();
  const seen = new Set<string>();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch { /* client disconnected */ }
      }

      function makeJob(sourceName: string, fn: () => Promise<RecordSearchResult[]>) {
        return fn()
          .then(results => {
            const fresh = results.filter(r => {
              const key = r.url ?? `${r.source}-${r.externalId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            if (fresh.length > 0) send({ source: sourceName, results: fresh });
          })
          .catch(() => { /* swallow individual source errors */ });
      }

      const jobs: Promise<void>[] = [];

      if (requestedSources.includes('familysearch') && accessToken)
        jobs.push(makeJob('familysearch', () => searchFamilySearch(query, accessToken!)));
      if (requestedSources.includes('wikitree'))
        jobs.push(makeJob('wikitree', () => searchWikiTree(query)));
      if (requestedSources.includes('newspaper'))
        jobs.push(makeJob('newspaper', () => searchChroniclingAmerica(query)));
      if (requestedSources.includes('wikipedia'))
        jobs.push(makeJob('wikipedia', () => searchWikipedia(query)));
      if (requestedSources.includes('archive'))
        jobs.push(makeJob('archive', () => searchInternetArchive(query)));
      if (requestedSources.includes('news')) {
        const bingKey = process.env.BING_NEWS_API_KEY;
        jobs.push(makeJob('news', () => bingKey ? searchBingNews(query) : searchGoogleNews(query)));
      }
      if (requestedSources.includes('wikidata'))
        jobs.push(makeJob('wikidata', () => searchWikidata(query)));
      if (requestedSources.includes('nara'))
        jobs.push(makeJob('nara', () => searchNARA(query)));
      if (requestedSources.includes('dpla'))
        jobs.push(makeJob('dpla', () => searchDPLA(query)));
      if (requestedSources.includes('openlibrary'))
        jobs.push(makeJob('openlibrary', () => searchOpenLibrary(query)));
      if (requestedSources.includes('trove'))
        jobs.push(makeJob('trove', () => searchTrove(query)));
      if (requestedSources.includes('loc'))
        jobs.push(makeJob('loc', () => searchLOCCollections(query)));
      if (requestedSources.includes('europeana'))
        jobs.push(makeJob('europeana', () => searchEuropeana(query)));
      if (requestedSources.includes('snac'))
        jobs.push(makeJob('snac', () => searchSNAC(query)));

      // Emit "searching N sources" immediately so UI can show progress
      send({ searching: jobs.length });

      await Promise.all(jobs);
      send({ done: true, total: seen.size });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
