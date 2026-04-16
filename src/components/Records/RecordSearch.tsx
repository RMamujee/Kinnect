'use client';

import { useState } from 'react';
import {
  Search, Loader2, ExternalLink, UserPlus, CheckCircle, TreePine,
  ChevronDown, ChevronUp, AlertCircle, Newspaper, Globe, BookOpen,
  Archive, Users, Lightbulb,
} from 'lucide-react';
import type { Person, RecordSearchResult } from '@/lib/types';
import { getPreferredName, cn } from '@/lib/utils';
import { useGenealogyStore } from '@/store/genealogyStore';

interface Props {
  person: Person;
}

type ExtendStatus = 'idle' | 'loading' | 'done' | 'error' | 'private';

interface AncestorSuggestion {
  relation: string;
  estimatedBirthYear?: number;
  estimatedBirthRange?: string | null;
  suggestions: RecordSearchResult[];
}

const RELATION_LABELS: Record<string, string> = {
  father:               'Father',
  mother:               'Mother',
  paternal_grandfather: 'Paternal Grandfather',
  paternal_grandmother: 'Paternal Grandmother',
  maternal_grandfather: 'Maternal Grandfather',
  maternal_grandmother: 'Maternal Grandmother',
  spouse:               'Spouse',
  sibling:              'Sibling',
  child:                'Child',
};

export function RecordSearch({ person }: Props) {
  const [results, setResults]           = useState<RecordSearchResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [searched, setSearched]         = useState(false);
  const [importedIds, setImportedIds]   = useState<Set<string>>(new Set());
  const [extendStatus, setExtendStatus] = useState<ExtendStatus>('idle');
  const [extendStats, setExtendStats]   = useState<{ added: number; skipped: number } | null>(null);
  const [extendDepth, setExtendDepth]   = useState(6);
  const [showDepthPicker, setShowDepthPicker] = useState(false);
  const [suggestions, setSuggestions]   = useState<AncestorSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen]   = useState(false);

  const {
    persons, families,
    addSource, addCitation, addFact, updatePerson,
    importExternalPersons, getExistingWikiTreeIds,
  } = useGenealogyStore(s => ({
    persons:              s.persons,
    families:             s.families,
    addSource:            s.addSource,
    addCitation:          s.addCitation,
    addFact:              s.addFact,
    updatePerson:         s.updatePerson,
    importExternalPersons:s.importExternalPersons,
    getExistingWikiTreeIds: s.getExistingWikiTreeIds,
  }));

  /** Which relations are missing for this person */
  function getMissingRelations(): string[] {
    const missing: string[] = [];
    // Does this person appear as a child in any family?
    const asChild = Object.values(families).find(f => f.childIds.includes(person.id));
    const hasFather = asChild?.spouse1Id && persons[asChild.spouse1Id]?.gender === 'male';
    const hasMother = asChild?.spouse2Id && persons[asChild.spouse2Id]?.gender === 'female';
    if (!hasFather) missing.push('father');
    if (!hasMother) missing.push('mother');
    // Grandparents if we have parents
    if (hasFather && asChild?.spouse1Id) {
      const dadAsChild = Object.values(families).find(f => f.childIds.includes(asChild.spouse1Id!));
      if (!dadAsChild) { missing.push('paternal_grandfather', 'paternal_grandmother'); }
    }
    if (hasMother && asChild?.spouse2Id) {
      const momAsChild = Object.values(families).find(f => f.childIds.includes(asChild.spouse2Id!));
      if (!momAsChild) { missing.push('maternal_grandfather', 'maternal_grandmother'); }
    }
    return missing;
  }

  async function handleSearch() {
    const preferred = person.names.find(n => n.isPreferred) ?? person.names[0];
    if (!preferred) return;

    setLoading(true);
    setSearched(false);

    const params = new URLSearchParams({ givenName: preferred.given, surname: preferred.surname });
    if (person.birthYear)  params.set('birthYear',  String(person.birthYear));
    if (person.birthPlace) params.set('birthPlace', person.birthPlace);

    try {
      const res  = await fetch(`/api/records/search?${params}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function handleFindAncestors() {
    const preferred = person.names.find(n => n.isPreferred) ?? person.names[0];
    if (!preferred) return;

    setSuggestLoading(true);
    setSuggestOpen(true);
    setSuggestions([]);

    const missingRelations = getMissingRelations();
    if (missingRelations.length === 0) {
      setSuggestLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/ancestors/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person: {
            givenName:  preferred.given,
            surname:    preferred.surname,
            birthYear:  person.birthYear,
            birthPlace: person.birthPlace,
            gender:     person.gender,
          },
          missingRelations,
        }),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  }

  function handleImport(result: RecordSearchResult) {
    const source = addSource({
      title:         `${result.name} — ${result.publicationName ?? result.source} record`,
      recordType:    result.recordType,
      evidenceType:  'original',
      informationType: 'primary',
      quality:       2,
      url:           result.url,
      repositoryUrl: result.url,
      accessDate:    new Date().toISOString().split('T')[0],
    });

    const updates: Partial<Person> = {};
    if (result.source === 'familysearch') updates.familySearchId = result.externalId;
    if (result.source === 'wikitree')     updates.wikiTreeId     = result.externalId;
    updatePerson(person.id, updates);

    if (result.birthYear && !person.birthYear) {
      const fact = addFact(person.id, {
        type:       'birth',
        date:       { year: result.birthYear },
        place:      result.birthPlace ? { fullText: result.birthPlace } : undefined,
        confidence: 'probable',
        citationIds:[],
        isPreferred: true,
      });
      addCitation({
        sourceId:   source.id,
        personId:   person.id,
        factId:     fact.id,
        confidence: 'probable',
        detail:     `Found in ${result.publicationName ?? result.source} record`,
      });
    }

    setImportedIds(prev => new Set([...prev, result.id]));
  }

  async function handleExtendTree(wikiTreeId: string) {
    setExtendStatus('loading');
    setExtendStats(null);
    try {
      const existingWikiTreeIds = getExistingWikiTreeIds();
      const res = await fetch('/api/tree/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wikiTreeId, depth: extendDepth, existingWikiTreeIds }),
      });
      if (!res.ok) throw new Error('extend failed');
      const data = await res.json();
      if (!data.persons?.length) { setExtendStatus('private'); return; }
      const stats = importExternalPersons(data.persons ?? [], data.families ?? []);
      setExtendStats(stats);
      setExtendStatus('done');
    } catch {
      setExtendStatus('error');
    }
  }

  const currentWikiTreeId = useGenealogyStore(s => s.persons[person.id]?.wikiTreeId);
  const missingCount = getMissingRelations().length;

  return (
    <div className="space-y-4">

      {/* ── Auto-extend (WikiTree linked) ───────────────────────────────────── */}
      {currentWikiTreeId && (
        <div className="rounded-xl border-2 border-primary-200 bg-primary-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TreePine className="w-4 h-4 text-primary-600" />
            <span className="text-sm font-semibold text-primary-800">Auto-Extend Tree</span>
          </div>
          <p className="text-xs text-primary-700">
            WikiTree ID <strong>{currentWikiTreeId}</strong> is linked. Fetch ancestors automatically.
          </p>

          <div>
            <button
              onClick={() => setShowDepthPicker(s => !s)}
              className="flex items-center gap-1 text-xs text-primary-600 font-medium"
            >
              Generations: {extendDepth}
              {showDepthPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {showDepthPicker && (
              <div className="flex gap-2 mt-2">
                {[3, 4, 5, 6, 8, 10].map(d => (
                  <button key={d} onClick={() => { setExtendDepth(d); setShowDepthPicker(false); }}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors',
                      extendDepth === d
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                    )}>
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {extendStatus === 'idle' || extendStatus === 'error' ? (
            <button onClick={() => handleExtendTree(currentWikiTreeId)}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
              <TreePine className="w-4 h-4" />
              Build {extendDepth} Generations of Ancestors
            </button>
          ) : extendStatus === 'loading' ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-primary-700">
              <Loader2 className="w-4 h-4 animate-spin" />Fetching ancestors from WikiTree…
            </div>
          ) : extendStatus === 'done' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-green-700 font-semibold">
                <CheckCircle className="w-4 h-4 text-green-500" />Tree extended!
              </div>
              {extendStats && (
                <div className="text-xs text-gray-600 space-y-0.5">
                  <div>✓ <strong>{extendStats.added}</strong> ancestors added</div>
                  <div>↩ <strong>{extendStats.skipped}</strong> already in tree</div>
                </div>
              )}
              <button onClick={() => { setExtendStatus('idle'); setExtendStats(null); }}
                className="text-xs text-primary-600 hover:underline">Extend further</button>
            </div>
          ) : extendStatus === 'private' ? (
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>This WikiTree profile's ancestors are private. Contact the profile manager on WikiTree.</span>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Ancestor / Kin Suggestions ──────────────────────────────────────── */}
      {missingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
          <button
            onClick={() => suggestOpen ? setSuggestOpen(false) : handleFindAncestors()}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
          >
            <Lightbulb className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-800">Find Missing Ancestors</div>
              <div className="text-xs text-amber-600">
                {missingCount} relation{missingCount !== 1 ? 's' : ''} not yet in tree — search across 14+ databases
              </div>
            </div>
            {suggestLoading
              ? <Loader2 className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" />
              : suggestOpen
                ? <ChevronUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
            }
          </button>

          {suggestOpen && !suggestLoading && suggestions.length > 0 && (
            <div className="border-t border-amber-200 divide-y divide-amber-100">
              {suggestions.map(group => (
                <div key={group.relation} className="px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                      {RELATION_LABELS[group.relation] ?? group.relation}
                    </span>
                    {group.estimatedBirthRange && (
                      <span className="text-xs text-amber-600 ml-auto">
                        est. b. {group.estimatedBirthRange}
                      </span>
                    )}
                  </div>
                  {group.suggestions.length === 0 ? (
                    <p className="text-xs text-amber-600">No matches found across searched databases.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {group.suggestions.slice(0, 5).map(result => (
                        <RecordResultCard
                          key={result.id}
                          result={result}
                          imported={importedIds.has(result.id)}
                          onImport={() => handleImport(result)}
                          compact
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {suggestOpen && !suggestLoading && suggestions.length === 0 && (
            <div className="border-t border-amber-200 px-4 py-3 text-xs text-amber-600">
              No suggestions found. Try adding birth year or location to improve results.
            </div>
          )}
        </div>
      )}

      {/* ── Manual record search ────────────────────────────────────────────── */}
      <div>
        <p className="text-xs text-gray-500 mb-3">
          Search public genealogy databases for records matching{' '}
          <strong>{getPreferredName(person)}</strong>.
        </p>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 disabled:bg-gray-400 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Searching 14+ databases…' : 'Search All Public Records'}
        </button>
        <p className="text-xs text-gray-400 mt-1.5 text-center leading-relaxed">
          WikiTree · FamilySearch · Chronicling America · Wikipedia · Internet Archive ·
          Wikidata · NARA · DPLA · Open Library · Trove · LOC · Europeana · SNAC · News
        </p>
      </div>

      {searched && results.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No records found.</p>
          <p className="text-xs mt-1">Try different name spellings or add a birth year.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">
            {results.length} result{results.length !== 1 ? 's' : ''} across{' '}
            14+ databases — click import to link &amp; cite a record
          </p>
          {results.map(result => (
            <RecordResultCard
              key={result.id}
              result={result}
              imported={importedIds.has(result.id)}
              onImport={() => handleImport(result)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Source metadata ────────────────────────────────────────────────────────────

const SOURCE_META: Record<string, { label: string; bg: string; icon: React.ReactNode }> = {
  familysearch: { label: 'FamilySearch',        bg: 'bg-green-100 text-green-700',   icon: <Globe    className="w-3 h-3" /> },
  wikitree:     { label: 'WikiTree',            bg: 'bg-blue-100 text-blue-700',     icon: <TreePine className="w-3 h-3" /> },
  findagrave:   { label: 'Find A Grave',        bg: 'bg-stone-100 text-stone-700',   icon: <Globe    className="w-3 h-3" /> },
  newspaper:    { label: 'Historic Newspaper',  bg: 'bg-amber-100 text-amber-700',   icon: <Newspaper className="w-3 h-3" /> },
  wikipedia:    { label: 'Wikipedia/Wikidata',  bg: 'bg-slate-100 text-slate-700',   icon: <BookOpen className="w-3 h-3" /> },
  archive:      { label: 'Digital Archive',     bg: 'bg-violet-100 text-violet-700', icon: <Archive  className="w-3 h-3" /> },
  news:         { label: 'News Article',        bg: 'bg-sky-100 text-sky-700',       icon: <Globe    className="w-3 h-3" /> },
  other:        { label: 'Record',              bg: 'bg-gray-100 text-gray-700',     icon: <Globe    className="w-3 h-3" /> },
};

// ── Result card ────────────────────────────────────────────────────────────────

function RecordResultCard({
  result, imported, onImport, compact = false,
}: {
  result: RecordSearchResult;
  imported: boolean;
  onImport: () => void;
  compact?: boolean;
}) {
  const meta = SOURCE_META[result.source] ?? SOURCE_META.other;
  const isLinkable = result.source === 'wikitree';
  const isArticle  = ['newspaper', 'news', 'wikipedia', 'archive'].includes(result.source);

  return (
    <div className={cn(
      'rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 transition-colors overflow-hidden',
      compact && 'rounded-lg',
    )}>
      <div className={cn('p-3', compact && 'p-2')}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('font-semibold text-gray-900 truncate', compact ? 'text-xs' : 'text-sm')}>
                {result.name}
              </span>
              <span className={cn('flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium', meta.bg)}>
                {meta.icon}
                {result.publicationName
                  ? result.publicationName.split('·')[0].trim()
                  : meta.label}
              </span>
              <span className="text-xs text-gray-400">{result.confidence}%</span>
            </div>

            {isArticle && (result.publicationName || result.publicationDate) && (
              <p className="text-xs text-gray-500 mt-0.5">
                {result.publicationName && <span className="font-medium">{result.publicationName}</span>}
                {result.publicationDate && <span className="text-gray-400"> · {result.publicationDate}</span>}
              </p>
            )}

            {!isArticle && !compact && (
              <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                {result.birthYear && <div>b. {result.birthYear}{result.birthPlace ? ` · ${result.birthPlace}` : ''}</div>}
                {result.deathYear && <div>d. {result.deathYear}{result.deathPlace ? ` · ${result.deathPlace}` : ''}</div>}
                {result.fatherName && <div>Father: {result.fatherName}</div>}
                {result.motherName && <div>Mother: {result.motherName}</div>}
              </div>
            )}

            {!isArticle && compact && (result.birthYear || result.deathYear) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {result.birthYear ? `b. ${result.birthYear}` : ''}{result.deathYear ? ` d. ${result.deathYear}` : ''}
                {result.birthPlace ? ` · ${result.birthPlace}` : ''}
              </p>
            )}

            {isLinkable && !imported && (
              <p className="text-xs text-primary-600 mt-1">↳ Import to enable auto-extend tree</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 flex-shrink-0">
            {result.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                title="View source">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onImport} disabled={imported}
              className={cn('p-1.5 rounded-lg transition-colors',
                imported
                  ? 'text-green-500 bg-green-50'
                  : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
              )}
              title={imported ? 'Saved' : 'Save to record'}>
              {imported ? <CheckCircle className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isArticle && result.snippet && !compact && (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed line-clamp-3 border-t border-gray-100 pt-2">
            {result.snippet}
          </p>
        )}
      </div>
    </div>
  );
}
