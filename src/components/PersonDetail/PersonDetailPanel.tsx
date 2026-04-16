'use client';

import { useRef, useState } from 'react';
import { X, Edit3, ExternalLink, Calendar, MapPin, User2, Camera, Trash2 } from 'lucide-react';
import type { Person } from '@/lib/types';
import { useGenealogyStore } from '@/store/genealogyStore';
import { getPreferredName, formatLifespan, formatPartialDate, confidenceColor, confidenceLabel, cn } from '@/lib/utils';
import { RecordSearch } from '../Records/RecordSearch';
import { CommentsTab } from './CommentsTab';

type Tab = 'details' | 'records' | 'comments';

interface Props {
  personId: string;
  onClose: () => void;
}

export function PersonDetailPanel({ personId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('details');

  const { person, updatePerson, deletePerson, sources, citations, commentCount } = useGenealogyStore(s => ({
    person: s.persons[personId],
    updatePerson: s.updatePerson,
    deletePerson: s.deletePerson,
    sources: s.sources,
    citations: s.citations,
    commentCount: Object.values(s.comments).filter(c => c.personId === personId).length,
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!person) return null;

  const name = getPreferredName(person);
  const lifespan = formatLifespan(person.birthYear, person.deathYear, person.isLiving);

  const personCitations = Object.values(citations).filter(c => c.personId === personId);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeImage(file, 400).then(dataUrl => {
      updatePerson(personId, { profileImageUrl: dataUrl });
    });
    // Reset so same file can be re-selected
    e.target.value = '';
  }

  const avatarBg =
    person.gender === 'male' ? 'bg-blue-200'
    : person.gender === 'female' ? 'bg-pink-200'
    : 'bg-gray-200';

  return (
    <div className="fixed inset-x-0 bottom-0 h-[85vh] z-40 sm:relative sm:h-full sm:inset-auto sm:w-96 bg-white rounded-t-2xl sm:rounded-none border-t sm:border-t-0 sm:border-l border-gray-200 flex flex-col shadow-xl animate-slide-up">
      {/* Mobile drag handle */}
      <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>
      {/* Header */}
      <div className={cn(
        'p-4 border-b border-gray-100',
        person.gender === 'male' ? 'bg-blue-50' : person.gender === 'female' ? 'bg-pink-50' : 'bg-gray-50'
      )}>
        <div className="flex items-start gap-3">
          {/* Clickable photo avatar */}
          <div className="relative flex-shrink-0 group">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white shadow-md block"
              title="Upload photo"
            >
              {person.profileImageUrl ? (
                <img src={person.profileImageUrl} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className={cn('w-full h-full flex items-center justify-center', avatarBg)}>
                  <User2 className="w-8 h-8 text-gray-500" />
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </button>
            {person.profileImageUrl && (
              <button
                onClick={() => updatePerson(personId, { profileImageUrl: undefined })}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                title="Remove photo"
              >
                <Trash2 className="w-2.5 h-2.5 text-white" />
              </button>
            )}
          </div>

          {/* Name + lifespan */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-lg text-gray-900 truncate">{name}</h3>
            <p className="text-sm text-gray-500">{lifespan}</p>
            {person.birthPlace && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{person.birthPlace}
              </p>
            )}
          </div>

          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {(['details', 'records', 'comments'] as Tab[]).map(t => {
          const label = t === 'comments' ? 'Notes' : t;
          const count = t === 'comments' ? commentCount : 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 min-w-0 py-2.5 text-xs font-semibold capitalize whitespace-nowrap transition-colors px-1',
                tab === t
                  ? 'border-b-2 border-primary-600 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {label}
              {t === 'comments' && count > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
                  {count > 9 ? '9+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'details' && (
          <DetailsTab person={person} citations={personCitations} sources={sources} />
        )}
        {tab === 'records' && (
          <RecordSearch person={person} />
        )}
        {tab === 'comments' && (
          <CommentsTab personId={personId} />
        )}
      </div>

      {/* Delete */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100">
        <button
          onClick={() => {
            if (confirm(`Delete ${name}? This cannot be undone.`)) {
              deletePerson(personId);
              onClose();
            }
          }}
          className="w-full py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Person
        </button>
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

/** Resize an image file to at most maxSize×maxSize and return a JPEG data URL. */
function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = Math.round(height * maxSize / width); width = maxSize; }
      } else {
        if (height > maxSize) { width = Math.round(width * maxSize / height); height = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}
