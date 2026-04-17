'use client';

import { useRef, useState } from 'react';
import { X, ExternalLink, Calendar, MapPin, User2, Camera, Trash2, Pencil, Check } from 'lucide-react';
import type { Person, Fact, Gender } from '@/lib/types';
import { useGenealogyStore } from '@/store/genealogyStore';
import { getPreferredName, formatLifespan, formatPartialDate, confidenceColor, confidenceLabel, cn } from '@/lib/utils';
import { RecordSearch } from '../Records/RecordSearch';
import { CommentsTab } from './CommentsTab';
import { EditFacts } from './EditFacts';

type Tab = 'details' | 'records' | 'comments';

interface Props {
  personId: string;
  onClose: () => void;
}

export function PersonDetailPanel({ personId, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('details');

  // Edit mode lives here (not inside DetailsTab) so store re-renders can't reset it
  const [editing, setEditing] = useState(false);
  const [nameForm, setNameForm] = useState({ given: '', surname: '', maiden: '', gender: 'unknown' as Gender });

  const { person, updatePerson, deletePerson, addFact, updateFact, deleteFact, sources, citations, commentCount } = useGenealogyStore(s => ({
    person: s.persons[personId],
    updatePerson: s.updatePerson,
    deletePerson: s.deletePerson,
    addFact: s.addFact,
    updateFact: s.updateFact,
    deleteFact: s.deleteFact,
    sources: s.sources,
    citations: s.citations,
    commentCount: Object.values(s.comments).filter(c => c.personId === personId).length,
  }));

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!person) return null;

  const displayName = getPreferredName(person);
  const lifespan = formatLifespan(person.birthYear, person.deathYear, person.isLiving);
  const personCitations = Object.values(citations).filter(c => c.personId === personId);

  function startEditing() {
    const pname = person.names.find(n => n.isPreferred) ?? person.names[0];
    setNameForm({
      given:   pname?.given        ?? '',
      surname: pname?.surname      ?? '',
      maiden:  pname?.maidenName   ?? '',
      gender:  person.gender,
    });
    setEditing(true);
  }

  function saveEdits() {
    updatePerson(personId, {
      names: person.names.map(n =>
        n.isPreferred
          ? { ...n, given: nameForm.given.trim(), surname: nameForm.surname.trim(), maidenName: nameForm.maiden.trim() || undefined }
          : n
      ),
      gender: nameForm.gender,
    });
    setEditing(false);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resizeImage(file, 400).then(dataUrl => updatePerson(personId, { profileImageUrl: dataUrl }));
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
        'p-4 border-b border-gray-100 flex-shrink-0',
        person.gender === 'male' ? 'bg-blue-50' : person.gender === 'female' ? 'bg-pink-50' : 'bg-gray-50'
      )}>
        <div className="flex items-start gap-3">
          {/* Photo */}
          <div className="relative flex-shrink-0 group">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-md block" title="Upload photo">
              {person.profileImageUrl ? (
                <img src={person.profileImageUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className={cn('w-full h-full flex items-center justify-center', avatarBg)}>
                  <User2 className="w-7 h-7 text-gray-500" />
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </button>
            {person.profileImageUrl && (
              <button onClick={() => updatePerson(personId, { profileImageUrl: undefined })}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                title="Remove photo">
                <Trash2 className="w-2 h-2 text-white" />
              </button>
            )}
          </div>

          {/* Name + lifespan */}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base text-gray-900 truncate">{displayName}</h3>
            <p className="text-xs text-gray-500">{lifespan}</p>
            {person.birthPlace && (
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1 truncate">
                <MapPin className="w-3 h-3 flex-shrink-0" />{person.birthPlace}
              </p>
            )}
          </div>

          {/* Edit / Save / Cancel — only visible on Details tab */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {tab === 'details' && (
              editing ? (
                <>
                  <button onClick={saveEdits}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button onClick={cancelEditing}
                    className="text-xs font-semibold px-2.5 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={startEditing}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg transition-colors">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
              )
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto flex-shrink-0">
        {(['details', 'records', 'comments'] as Tab[]).map(t => {
          const label = t === 'comments' ? 'Notes' : t;
          const count = t === 'comments' ? commentCount : 0;
          return (
            <button key={t} onClick={() => { setTab(t); if (t !== 'details') setEditing(false); }}
              className={cn(
                'flex-1 min-w-0 py-2.5 text-xs font-semibold capitalize whitespace-nowrap transition-colors px-1',
                tab === t ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500 hover:text-gray-700'
              )}>
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
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {tab === 'details' && (
          <DetailsTab
            person={person}
            citations={personCitations}
            sources={sources}
            editing={editing}
            nameForm={nameForm}
            setNameForm={setNameForm}
            onAddFact={fact => addFact(personId, fact)}
            onUpdateFact={(factId, data) => updateFact(personId, factId, data)}
            onDeleteFact={factId => deleteFact(personId, factId)}
          />
        )}
        {tab === 'records' && <RecordSearch person={person} />}
        {tab === 'comments' && <CommentsTab personId={personId} />}
      </div>

      {/* Delete */}
      <div className="px-4 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
        <button
          onClick={() => {
            if (confirm(`Delete ${displayName}? This cannot be undone.`)) {
              deletePerson(personId);
              onClose();
            }
          }}
          className="w-full py-2 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm font-semibold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4" /> Delete Person
        </button>
      </div>
    </div>
  );
}

// ── Details Tab ────────────────────────────────────────────────────────────────

interface DetailsTabProps {
  person: Person;
  citations: import('@/lib/types').Citation[];
  sources: Record<string, import('@/lib/types').Source>;
  editing: boolean;
  nameForm: { given: string; surname: string; maiden: string; gender: Gender };
  setNameForm: React.Dispatch<React.SetStateAction<{ given: string; surname: string; maiden: string; gender: Gender }>>;
  onAddFact: (fact: Omit<Fact, 'id' | 'personId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateFact: (factId: string, data: Partial<Fact>) => void;
  onDeleteFact: (factId: string) => void;
}

function DetailsTab({ person, citations, sources, editing, nameForm, setNameForm, onAddFact, onUpdateFact, onDeleteFact }: DetailsTabProps) {
  const set = (k: keyof typeof nameForm, v: string) => setNameForm(s => ({ ...s, [k]: v }));

  if (editing) {
    return (
      <div className="space-y-5">
        {/* ── Name & Identity ── */}
        <Section title="Name & Identity">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Given Name</label>
                <input
                  value={nameForm.given}
                  onChange={e => set('given', e.target.value)}
                  placeholder="First / given name"
                  className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Surname</label>
                <input
                  value={nameForm.surname}
                  onChange={e => set('surname', e.target.value)}
                  placeholder="Last name"
                  className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Maiden / Birth Surname</label>
              <input
                value={nameForm.maiden}
                onChange={e => set('maiden', e.target.value)}
                placeholder="Birth surname, if different from current"
                className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
              <div className="flex gap-2">
                {(['male', 'female', 'unknown'] as Gender[]).map(g => (
                  <button key={g} type="button" onClick={() => set('gender', g)}
                    className={cn(
                      'flex-1 py-2 text-xs font-semibold rounded-lg border capitalize transition-colors',
                      nameForm.gender === g
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    )}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Life Events ── */}
        <Section title="Life Events">
          <EditFacts
            facts={person.facts}
            onAdd={onAddFact}
            onUpdate={onUpdateFact}
            onDelete={onDeleteFact}
          />
        </Section>
      </div>
    );
  }

  // ── View mode ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Name & Identity */}
      <Section title="Name & Identity">
        {person.names.map(name => (
          <div key={name.id} className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-medium text-gray-800">{name.given} {name.surname}</span>
            {name.maidenName && <span className="text-gray-400">(née {name.maidenName})</span>}
            {name.isPreferred && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 py-0.5 rounded-full">Primary</span>}
            <span className="text-xs text-gray-400 capitalize">{name.type}</span>
          </div>
        ))}
        <div className="text-xs text-gray-400 capitalize mt-0.5">{person.gender}</div>
      </Section>

      {/* Life Events */}
      {person.facts.length > 0 && (
        <Section title="Life Events">
          <div className="space-y-2">
            {person.facts.map(fact => (
              <div key={fact.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold capitalize text-gray-700">{fact.type.replace('_', ' ')}</span>
                    <span className={cn('text-xs px-1.5 py-0.5 rounded-full border', confidenceColor(fact.confidence))}>
                      {confidenceLabel(fact.confidence)}
                    </span>
                  </div>
                  {fact.date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      {formatPartialDate(fact.date)}
                    </div>
                  )}
                  {fact.place && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      {fact.place.fullText ?? [fact.place.city, fact.place.state, fact.place.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {fact.value && (
                    <div className="text-xs text-gray-600 mt-0.5 italic">{fact.value}</div>
                  )}
                  {fact.citationIds.length > 0 && (
                    <div className="mt-1 text-xs text-primary-600">{fact.citationIds.length} source(s)</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Empty facts state */}
      {person.facts.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <p className="text-sm">No life events recorded.</p>
          <p className="text-xs mt-1">Click <strong>Edit</strong> above to add birth, death, and other events.</p>
        </div>
      )}

      {/* External IDs */}
      {(person.familySearchId || person.wikiTreeId) && (
        <Section title="External Links">
          {person.familySearchId && (
            <a href={`https://www.familysearch.org/tree/person/details/${person.familySearchId}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />FamilySearch: {person.familySearchId}
            </a>
          )}
          {person.wikiTreeId && (
            <a href={`https://www.wikitree.com/wiki/${person.wikiTreeId}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" />WikiTree: {person.wikiTreeId}
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
