import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWikiTreeAncestors } from '@/lib/wikitree';
import { buildPersonsFromWikiTree } from '@/lib/treeBuilder';

const schema = z.object({
  wikiTreeId: z.string().min(1),
  depth: z.coerce.number().min(1).max(10).default(6),
  existingWikiTreeIds: z.array(z.string()).default([]),
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 });
  }

  const { wikiTreeId, depth, existingWikiTreeIds } = parsed.data;

  const profiles = await getWikiTreeAncestors(wikiTreeId, depth);
  const profileCount = Object.keys(profiles).length;

  if (profileCount === 0) {
    return NextResponse.json({
      persons: [],
      families: [],
      idMap: {},
      message: 'No public ancestors found. This profile may be private on WikiTree.',
    });
  }

  const existingSet = new Set(existingWikiTreeIds);
  const result = buildPersonsFromWikiTree(profiles, existingSet);

  return NextResponse.json({
    persons: result.persons,
    families: result.families,
    idMap: result.idMap,
    totalProfilesFound: profileCount,
    newPersonsAdded: result.persons.length,
  });
}
