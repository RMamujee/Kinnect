/**
 * POST /api/ancestors/suggest
 *
 * Streams ranked suggestions per missing relation via SSE.
 * Each SSE event: { relation, estimatedBirthYear, estimatedBirthRange, suggestions[] }
 * Final event:   { done: true }
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { searchWikiTree }           from '@/lib/wikitree';
import { searchFamilySearch }       from '@/lib/familysearch';
import { searchChroniclingAmerica } from '@/lib/chroniclingamerica';
import { searchNARA }               from '@/lib/nara';
import { searchDPLA }               from '@/lib/dpla';
import { searchWikidata }           from '@/lib/wikidata';
import { searchInternetArchive }    from '@/lib/internetarchive';
import type { RecordSearchQuery, RecordSearchResult } from '@/lib/types';

export const dynamic = 'force-dynamic';

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
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid request' }), { status: 400 });
  }

  const { person, missingRelations, accessToken } = parsed.data;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {}
      }

      // Run all relations in parallel; emit each as soon as it resolves
      const jobs = missingRelations.map(async relation => {
        const yearRange = person.birthYear
          ? estimatedBirthYear(person.birthYear, relation)
          : null;

        const baseQuery: RecordSearchQuery = {
          surname:        person.surname,
          birthYear:      yearRange?.estimate,
          birthYearRange: yearRange ? (yearRange.max - yearRange.min) / 2 : 10,
          birthPlace:     person.birthPlace,
        };

        if (relation === 'mother') {
          baseQuery.surname    = undefined;
          baseQuery.givenName  = undefined;
          baseQuery.spouseName = [person.givenName, person.surname].filter(Boolean).join(' ') || undefined;
        } else if (relation === 'child') {
          baseQuery.fatherName = person.gender === 'male'
            ? [person.givenName, person.surname].filter(Boolean).join(' ') : undefined;
          baseQuery.motherName = person.gender === 'female'
            ? [person.givenName, person.surname].filter(Boolean).join(' ') : undefined;
        } else if (relation === 'spouse') {
          baseQuery.spouseName = [person.givenName, person.surname].filter(Boolean).join(' ');
          baseQuery.surname    = undefined;
        }

        const [wt, fs, ca, nara, dpla, wd, ia] = await Promise.allSettled([
          searchWikiTree(baseQuery),
          accessToken ? searchFamilySearch(baseQuery, accessToken) : Promise.resolve([]),
          searchChroniclingAmerica(baseQuery),
          searchNARA(baseQuery),
          searchDPLA(baseQuery),
          searchWikidata(baseQuery),
          searchInternetArchive(baseQuery),
        ]);

        const results: RecordSearchResult[] = [];
        [wt, fs, ca, nara, dpla, wd, ia].forEach(r => {
          if (r.status === 'fulfilled') results.push(...r.value);
        });

        const seen = new Set<string>();
        const deduped = results
          .sort((a, b) => b.confidence - a.confidence)
          .filter(r => {
            const key = r.url ?? r.externalId;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 10);

        // Emit this relation's results immediately
        send({
          relation,
          estimatedBirthYear:  yearRange?.estimate,
          estimatedBirthRange: yearRange ? `${yearRange.min}–${yearRange.max}` : null,
          suggestions:         deduped,
        });
      });

      await Promise.all(jobs);
      send({ done: true });
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
