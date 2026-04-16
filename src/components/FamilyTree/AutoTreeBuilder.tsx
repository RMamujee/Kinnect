'use client';

/**
 * AutoTreeBuilder
 *
 * Fires automatically on the first visit to the tree page after onboarding.
 * Searches WikiTree for the root person, lets the user confirm the match,
 * then pulls in ancestors automatically so the tree builds itself.
 *
 * Only runs once — guarded by `autoSearchCompleted` in the store.
 */

import { useEffect, useState } from 'react';
import {
  TreePine, Loader2, CheckCircle2, X, Search,
  ExternalLink, ChevronRight, AlertCircle, Users,
} from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { getPreferredName, cn } from '@/lib/utils';
import type { RecordSearchResult } from '@/lib/types';

type Phase =
  | 'searching'
  | 'selecting'
  | 'building'
  | 'done'
  | 'none_found'
  | 'error';

export function AutoTreeBuilder() {
  const {
    rootPersonId,
    persons,
    autoSearchCompleted,
    setAutoSearchCompleted,
    updatePerson,
    importExternalPersons,
    getExistingWikiTreeIds,
  } = useGenealogyStore(s => ({
    rootPersonId: s.rootPersonId,
    persons: s.persons,
    autoSearchCompleted: s.autoSearchCompleted,
    setAutoSearchCompleted: s.setAutoSearchCompleted,
    updatePerson: s.updatePerson,
    importExternalPersons: s.importExternalPersons,
    getExistingWikiTreeIds: s.getExistingWikiTreeIds,
  }));

  const [phase, setPhase] = useState<Phase>('searching');
  const [matches, setMatches] = useState<RecordSearchResult[]>([]);
  const [buildStats, setBuildStats] = useState<{ added: number; skipped: number } | null>(null);

  const rootPerson = rootPersonId ? persons[rootPersonId] : null;

  // Don't show if already done, already linked, or no root person
  const shouldRun =
    !autoSearchCompleted &&
    !!rootPerson &&
    !rootPerson.wikiTreeId;

  useEffect(() => {
    if (!shouldRun) return;
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // run once on mount

  async function runSearch() {
    if (!rootPerson) return;
    setPhase('searching');

    const preferred = rootPerson.names.find(n => n.isPreferred) ?? rootPerson.names[0];
    if (!preferred?.given && !preferred?.surname) {
      setPhase('none_found');
      return;
    }

    const params = new URLSearchParams();
    if (preferred.given)   params.set('givenName', preferred.given);
    if (preferred.surname) params.set('surname', preferred.surname);
    if (rootPerson.birthYear)  params.set('birthYear', String(rootPerson.birthYear));
    if (rootPerson.birthPlace) params.set('birthPlace', rootPerson.birthPlace);

    try {
      const res = await fetch(`/api/records/search?${params.toString()}`);
      if (!res.ok) { setPhase('error'); return; }
      const data = await res.json();
      const results: RecordSearchResult[] = data.results ?? [];

      if (results.length === 0) {
        setPhase('none_found');
        return;
      }

      setMatches(results.slice(0, 5));
      setPhase('selecting');
    } catch {
      setPhase('error');
    }
  }

  async function handleSelect(match: RecordSearchResult) {
    if (!rootPersonId) return;
    setPhase('building');

    // Link WikiTree ID to the root person
    updatePerson(rootPersonId, { wikiTreeId: match.externalId });

    try {
      const existingWikiTreeIds = getExistingWikiTreeIds();
      const res = await fetch('/api/tree/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wikiTreeId: match.externalId,
          depth: 6,
          existingWikiTreeIds,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if ((data.persons?.length ?? 0) > 0) {
          const stats = importExternalPersons(data.persons, data.families ?? []);
          setBuildStats(stats);
        } else {
          setBuildStats({ added: 0, skipped: 0 });
        }
      }
    } catch {
      // Still show done even if extend failed — the WikiTree ID is linked
      setBuildStats({ added: 0, skipped: 0 });
    }

    setPhase('done');
    setAutoSearchCompleted(true);
  }

  function dismiss() {
    setAutoSearchCompleted(true);
  }

  if (!shouldRun) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Searching ── */}
        {phase === 'searching' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto">
              <TreePine className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-gray-900">Building your family tree</h2>
              <p className="text-sm text-gray-500 mt-1">
                Searching public genealogy records for{' '}
                <strong>{rootPerson ? getPreferredName(rootPerson) : 'you'}</strong>…
              </p>
            </div>
            <Loader2 className="w-6 h-6 text-primary-500 animate-spin mx-auto" />
          </div>
        )}

        {/* ── Match selection ── */}
        {phase === 'selecting' && (
          <div>
            <div className="px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-serif font-bold text-gray-900">
                    We found possible matches
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Select the record that matches you so we can build your ancestors.
                  </p>
                </div>
                <button
                  onClick={dismiss}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-80 overflow-y-auto">
              {matches.map(match => (
                <button
                  key={match.id}
                  onClick={() => handleSelect(match)}
                  className="w-full text-left px-6 py-4 hover:bg-primary-50 transition-colors group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{match.name}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          WikiTree
                        </span>
                        <span className="text-xs text-gray-400">{match.confidence}% match</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500 space-x-2">
                        {match.birthYear && <span>b. {match.birthYear}</span>}
                        {match.birthPlace && <span>· {match.birthPlace}</span>}
                        {match.deathYear && <span>· d. {match.deathYear}</span>}
                      </div>
                      {match.fatherName && (
                        <div className="mt-0.5 text-xs text-gray-400">Father: {match.fatherName}</div>
                      )}
                      {match.motherName && (
                        <div className="text-xs text-gray-400">Mother: {match.motherName}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {match.url && (
                        <a
                          href={match.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="p-1 rounded text-gray-300 hover:text-primary-500 transition-colors"
                          title="View on WikiTree"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-primary-500 transition-colors" />
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
              <button
                onClick={dismiss}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                None of these are me — skip for now
              </button>
            </div>
          </div>
        )}

        {/* ── Building ── */}
        {phase === 'building' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto">
              <TreePine className="w-7 h-7 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-gray-900">Building your tree</h2>
              <p className="text-sm text-gray-500 mt-1">
                Fetching 6 generations of ancestors from WikiTree…
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-primary-600">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>This may take a moment</span>
            </div>
          </div>
        )}

        {/* ── Done ── */}
        {phase === 'done' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-gray-900">Your tree is ready!</h2>
              {buildStats && buildStats.added > 0 ? (
                <p className="text-sm text-gray-500 mt-1">
                  We added <strong className="text-gray-900">{buildStats.added} ancestors</strong> to
                  your tree across up to 6 generations.
                </p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">
                  Profile linked successfully. Ancestor records may be private on WikiTree.
                </p>
              )}
            </div>
            {buildStats && buildStats.added > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl py-2.5 px-4">
                <Users className="w-4 h-4 text-primary-500" />
                <span>Explore your ancestors in the tree view</span>
              </div>
            )}
            <button
              onClick={dismiss}
              className="w-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              View My Tree
            </button>
          </div>
        )}

        {/* ── None found ── */}
        {phase === 'none_found' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
              <Search className="w-7 h-7 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-gray-900">No records found yet</h2>
              <p className="text-sm text-gray-500 mt-1">
                We couldn't find <strong>{rootPerson ? getPreferredName(rootPerson) : 'you'}</strong> in
                WikiTree's public records. This is common for living people or recent generations.
              </p>
            </div>
            <div className={cn(
              'text-xs text-gray-500 bg-gray-50 rounded-xl p-3 text-left space-y-1.5'
            )}>
              <p className="font-semibold text-gray-700">Tips to improve results:</p>
              <p>· Add a birth year and city in your profile</p>
              <p>· Try searching for a parent or grandparent instead</p>
              <p>· Use the Search Records button on any person card</p>
            </div>
            <button
              onClick={dismiss}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
            >
              Continue to My Tree
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <div className="p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-gray-900">Search unavailable</h2>
              <p className="text-sm text-gray-500 mt-1">
                Couldn't reach WikiTree right now. You can search manually from any person's detail panel.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={runSearch}
                className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Retry
              </button>
              <button
                onClick={dismiss}
                className="flex-1 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
