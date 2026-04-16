'use client';

import { useState } from 'react';
import { TreePine, Loader2, CheckCircle2, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { cn } from '@/lib/utils';

/**
 * Scans all persons with a wikiTreeId and offers to extend the entire tree at once.
 * Shows a floating banner on the tree page.
 */
export function AutoBuildBanner() {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [building, setBuilding] = useState(false);
  const [stats, setStats] = useState<{ added: number; processed: number } | null>(null);
  const [depth, setDepth] = useState(5);

  const { persons, importExternalPersons, getExistingWikiTreeIds } = useGenealogyStore(s => ({
    persons: s.persons,
    importExternalPersons: s.importExternalPersons,
    getExistingWikiTreeIds: s.getExistingWikiTreeIds,
  }));

  const linkedPersons = Object.values(persons).filter(p => p.wikiTreeId);
  if (linkedPersons.length === 0 || dismissed) return null;

  async function handleBuildAll() {
    setBuilding(true);
    setStats(null);

    let totalAdded = 0;
    let processed = 0;

    for (const person of linkedPersons) {
      if (!person.wikiTreeId) continue;
      try {
        const existingWikiTreeIds = getExistingWikiTreeIds();
        const res = await fetch('/api/tree/extend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wikiTreeId: person.wikiTreeId, depth, existingWikiTreeIds }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.persons?.length > 0) {
            const result = importExternalPersons(data.persons, data.families ?? []);
            totalAdded += result.added;
          }
        }
      } catch {
        // continue with next person
      }
      processed++;
    }

    setStats({ added: totalAdded, processed });
    setBuilding(false);
  }

  return (
    <div className={cn(
      'absolute bottom-4 right-4 z-10 bg-white rounded-2xl shadow-xl border border-primary-200 transition-all',
      expanded ? 'w-80' : 'w-72'
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(s => !s)}
      >
        <div className="w-8 h-8 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <TreePine className="w-4 h-4 text-primary-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">Auto-Build Tree</div>
          <div className="text-xs text-gray-500">
            {linkedPersons.length} linked profile{linkedPersons.length !== 1 ? 's' : ''} found
          </div>
        </div>
        <div className="flex items-center gap-1">
          {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
          <button onClick={e => { e.stopPropagation(); setDismissed(true); }}
            className="p-1 rounded-lg text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500">
            Automatically fetch ancestors from WikiTree for all linked profiles and add them to your tree.
          </p>

          {/* Depth selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 font-medium">Generations:</span>
            <div className="flex gap-1.5">
              {[3, 5, 7, 10].map(d => (
                <button key={d} onClick={() => setDepth(d)}
                  className={cn('w-8 h-7 rounded-lg text-xs font-semibold border transition-colors',
                    depth === d ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  )}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Linked profiles list */}
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {linkedPersons.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0" />
                <span className="truncate">{p.names[0]?.given} {p.names[0]?.surname}</span>
                <span className="text-gray-400 flex-shrink-0">→ {p.wikiTreeId}</span>
              </div>
            ))}
          </div>

          {/* Action */}
          {!building && !stats ? (
            <button onClick={handleBuildAll}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
              <TreePine className="w-4 h-4" />
              Build {depth} Generations
            </button>
          ) : building ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-primary-700">
              <Loader2 className="w-4 h-4 animate-spin" />
              Building tree…
            </div>
          ) : stats ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Done! {stats.added} ancestors added
              </div>
              <button onClick={() => setStats(null)}
                className="text-xs text-primary-600 hover:underline">
                Build more generations
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
