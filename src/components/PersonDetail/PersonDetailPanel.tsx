'use client';

import { useState } from 'react';
import { X, Edit3, ExternalLink, Calendar, MapPin, User2 } from 'lucide-react';
import type { Person } from '@/lib/types';
import { useGenealogyStore } from '@/store/genealogyStore';
import { getPreferredName, formatLifespan, formatPartialDate, confidenceColor, confidenceLabel, cn } from '@/lib/utils';
import { GPSPanel } from '../GPS/GPSPanel';
import { RecordSearch } from '../Records/RecordSearch';

type Tab = 'details' | 'gps' | 'records';

interface Props {
  personId: string;
  onClose: () => void;
}

export function PersonDetailPanel({ personId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('details');

  const { person, updatePerson, sources, citations } = useGenealogyStore(s => ({
    person: s.persons[personId],
    updatePerson: s.updatePerson,
    sources: s.sources,
    citations: s.citations,
  }));

  if (!person) return null;

  const name = getPreferredName(person);
  const lifespan = formatLifespan(person.birthYear, person.deathYear, person.isLiving);

  const personCitations = Object.values(citations).filter(c => c.personId === personId);

  return (
    <div className="w-96 h-full bg-white border-l border-gray-200 flex flex-col shadow-xl animate-slide-up">
      {/* Header */}
      <div className={cn(
        'flex items-start justify-between p-4 border-b border-gray-100',
        person.gender === 'male' ? 'bg-blue-50' : person.gender === 'female' ? 'bg-pink-50' : 'bg-gray-50'
      )}>
        <div>
          <h3 className="font-serif font-bold text-lg text-gray-900">{name}</h3>
          <p className="text-sm text-gray-500">{lifespan}</p>
          {person.birthPlace && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" />{person.birthPlace}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white">
        {(['details', 'gps', 'records'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2.5 text-xs font-semibold capitalize transition-colors',
              tab === t
                ? 'border-b-2 border-primary-600 text-primary-700'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'gps' ? 'GPS Proof' : t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'details' && (
          <DetailsTab person={person} citations={personCitations} sources={sources} />
        )}
        {tab === 'gps' && (
          <GPSPanel
            status={person.gpsStatus}
            onUpdate={(updates) => updatePerson(personId, {
              gpsStatus: { ...person.gpsStatus, ...updates }
            })}
          />
        )}
        {tab === 'records' && (
          <RecordSearch person={person} />
        )}
      </div>
    </div>
  );
}

function DetailsTab({ person, citations, sources }: {
  person: Person;
  citations: import('@/lib/types').Citation[];
  sources: Record<string, import('@/lib/types').Source>;
}) {
  return (
    <div className="space-y-4">
      {/* Names */}
      <Section title="Names">
        {person.names.map(name => (
          <div key={name.id} className="flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-800">{name.given} {name.surname}</span>
            {name.maidenName && <span className="text-gray-400">(née {name.maidenName})</span>}
            {name.isPreferred && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">Primary</span>}
            <span className="text-xs text-gray-400 capitalize">{name.type}</span>
          </div>
        ))}
      </Section>

      {/* Facts */}
      {person.facts.length > 0 && (
        <Section title="Life Events">
          <div className="space-y-2">
            {person.facts.map(fact => (
              <div key={fact.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold capitalize text-gray-700">{fact.type.replace('_', ' ')}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', confidenceColor(fact.confidence))}>
                      {confidenceLabel(fact.confidence)}
                    </span>
                  </div>
                  {fact.date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3" />
                      {formatPartialDate(fact.date)}
                    </div>
                  )}
                  {fact.place && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />
                      {fact.place.fullText ?? [fact.place.city, fact.place.state, fact.place.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {fact.citationIds.length > 0 && (
                    <div className="mt-1 text-xs text-primary-600">
                      {fact.citationIds.length} source(s)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* External IDs */}
      {(person.familySearchId || person.wikiTreeId) && (
        <Section title="External Links">
          {person.familySearchId && (
            <a
              href={`https://www.familysearch.org/tree/person/details/${person.familySearchId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              FamilySearch: {person.familySearchId}
            </a>
          )}
          {person.wikiTreeId && (
            <a
              href={`https://www.wikitree.com/wiki/${person.wikiTreeId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary-600 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              WikiTree: {person.wikiTreeId}
            </a>
          )}
        </Section>
      )}

      {/* Citations */}
      {citations.length > 0 && (
        <Section title={`Sources (${citations.length})`}>
          <div className="space-y-2">
            {citations.map(cit => {
              const source = sources[cit.sourceId];
              if (!source) return null;
              return (
                <div key={cit.id} className="p-2 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                  <div className="font-medium text-gray-800">{source.title}</div>
                  {source.author && <div className="text-gray-500 mt-0.5">{source.author}</div>}
                  {cit.detail && <div className="text-gray-400 mt-0.5 italic">{cit.detail}</div>}
                  <div className={cn('mt-1 inline-block px-1.5 py-0.5 rounded-full border text-xs', confidenceColor(cit.confidence))}>
                    {confidenceLabel(cit.confidence)}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</h4>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
