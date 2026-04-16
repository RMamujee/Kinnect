'use client';

import { useState } from 'react';
import { Search, Loader2, ExternalLink, UserPlus, CheckCircle } from 'lucide-react';
import type { Person, RecordSearchResult } from '@/lib/types';
import { getPreferredName, confidenceColor, cn } from '@/lib/utils';
import { useGenealogyStore } from '@/store/genealogyStore';
import { generateId, nowISO } from '@/lib/utils';

interface Props {
  person: Person;
}

export function RecordSearch({ person }: Props) {
  const [results, setResults] = useState<RecordSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());

  const { addPerson, addSource, addCitation, addFact, updatePerson } = useGenealogyStore(s => ({
    addPerson: s.addPerson,
    addSource: s.addSource,
    addCitation: s.addCitation,
    addFact: s.addFact,
    updatePerson: s.updatePerson,
  }));

  async function handleSearch() {
    const preferred = person.names.find(n => n.isPreferred) ?? person.names[0];
    if (!preferred) return;

    setLoading(true);
    setSearched(false);

    const params = new URLSearchParams({
      givenName: preferred.given,
      surname: preferred.surname,
    });
    if (person.birthYear) params.set('birthYear', String(person.birthYear));
    if (person.birthPlace) params.set('birthPlace', person.birthPlace);

    try {
      const res = await fetch(`/api/records/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch (err) {
      console.error('Record search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function handleImport(result: RecordSearchResult) {
    // Add a source for this record
    const source = addSource({
      title: `${result.name} — ${result.source} ${result.recordType.replace('_', ' ')}`,
      recordType: result.recordType,
      evidenceType: 'original',
      informationType: 'primary',
      quality: 2,
      url: result.url,
      repositoryUrl: result.url,
      accessDate: new Date().toISOString().split('T')[0],
    });

    // Link external ID to person
    const updates: Partial<Person> = {};
    if (result.source === 'familysearch') updates.familySearchId = result.externalId;
    if (result.source === 'wikitree') updates.wikiTreeId = result.externalId;
    updatePerson(person.id, updates);

    // Add birth/death facts from the result if we don't have them
    if (result.birthYear && !person.birthYear) {
      const fact = addFact(person.id, {
        type: 'birth',
        date: { year: result.birthYear },
        place: result.birthPlace ? { fullText: result.birthPlace } : undefined,
        confidence: 'probable',
        citationIds: [],
        isPreferred: true,
      });
      addCitation({
        sourceId: source.id,
        personId: person.id,
        factId: fact.id,
        confidence: 'probable',
        detail: `Found in ${result.source} record`,
      });
    }

    setImportedIds(prev => new Set([...prev, result.id]));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-500 mb-3">
          Search public genealogy databases for records matching{' '}
          <strong>{getPreferredName(person)}</strong>.
        </p>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Searching…' : 'Search Public Records'}
        </button>
        <p className="text-xs text-gray-400 mt-1.5 text-center">
          Searches FamilySearch &amp; WikiTree simultaneously
        </p>
      </div>

      {searched && results.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No records found.</p>
          <p className="text-xs mt-1">Try searching with different name spellings.</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">{results.length} result(s) found</span>
          </div>
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

function RecordResultCard({
  result,
  imported,
  onImport,
}: {
  result: RecordSearchResult;
  imported: boolean;
  onImport: () => void;
}) {
  const sourceLabel = {
    familysearch: 'FamilySearch',
    wikitree: 'WikiTree',
    findagrave: 'Find A Grave',
    other: 'Other',
  }[result.source];

  const sourceBg = {
    familysearch: 'bg-green-100 text-green-700',
    wikitree: 'bg-blue-100 text-blue-700',
    findagrave: 'bg-stone-100 text-stone-700',
    other: 'bg-gray-100 text-gray-700',
  }[result.source];

  return (
    <div className="p-3 rounded-xl border border-gray-200 hover:border-primary-200 hover:bg-primary-50/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{result.name}</span>
            <span className={cn('text-xs px-1.5 py-0.5 rounded-full font-medium', sourceBg)}>
              {sourceLabel}
            </span>
            <span className="text-xs text-gray-400">{result.confidence}% match</span>
          </div>

          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
            {result.birthYear && (
              <div>b. {result.birthYear}{result.birthPlace ? ` · ${result.birthPlace}` : ''}</div>
            )}
            {result.deathYear && (
              <div>d. {result.deathYear}{result.deathPlace ? ` · ${result.deathPlace}` : ''}</div>
            )}
            {result.fatherName && <div>Father: {result.fatherName}</div>}
            {result.motherName && <div>Mother: {result.motherName}</div>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          {result.url && (
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
              title="View source"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onImport}
            disabled={imported}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              imported
                ? 'text-green-500 bg-green-50'
                : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50'
            )}
            title={imported ? 'Already imported' : 'Import to tree'}
          >
            {imported
              ? <CheckCircle className="w-3.5 h-3.5" />
              : <UserPlus className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>
    </div>
  );
}
