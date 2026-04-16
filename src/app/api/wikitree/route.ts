import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getWikiTreeAncestors, getWikiTreeProfile } from '@/lib/wikitree';

const schema = z.object({
  action: z.enum(['profile', 'ancestors']),
  key: z.string().min(1),
  depth: z.coerce.number().min(1).max(10).optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams.entries()));

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { action, key, depth } = parsed.data;

  if (action === 'profile') {
    const profile = await getWikiTreeProfile(key);
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    return NextResponse.json({ profile });
  }

  if (action === 'ancestors') {
    const ancestors = await getWikiTreeAncestors(key, depth ?? 5);
    return NextResponse.json({ ancestors, total: Object.keys(ancestors).length });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
