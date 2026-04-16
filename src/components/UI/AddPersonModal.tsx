'use client';

import { useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { getPreferredName, cn } from '@/lib/utils';
import type { Gender } from '@/lib/types';
import { generateId, nowISO } from '@/lib/utils';

interface Props {
  onClose: () => void;
}

type Relationship = 'standalone' | 'child_of' | 'spouse_of' | 'parent_of';

export function AddPersonModal({ onClose }: Props) {
  const {
    persons, families, rootPersonId, selectedPersonId,
    addPerson, addFamily, updateFamily, linkChildToFamily,
  } = useGenealogyStore(s => ({
    persons: s.persons,
    families: s.families,
    rootPersonId: s.rootPersonId,
    selectedPersonId: s.selectedPersonId,
    addPerson: s.addPerson,
    addFamily: s.addFamily,
    updateFamily: s.updateFamily,
    linkChildToFamily: s.linkChildToFamily,
  }));

  const [given, setGiven] = useState('');
  const [surname, setSurname] = useState('');
  const [gender, setGender] = useState<Gender>('unknown');
  const [birthYear, setBirthYear] = useState('');
  const [birthCity, setBirthCity] = useState('');
  const [birthState, setBirthState] = useState('');
  const [deathYear, setDeathYear] = useState('');
  const [isLiving, setIsLiving] = useState(true);
  const [relationship, setRelationship] = useState<Relationship>('standalone');
  const [relativeId, setRelativeId] = useState<string>(selectedPersonId ?? rootPersonId ?? '');

  const canSubmit = given.trim().length > 0 && surname.trim().length > 0;

  const sortedPersons = Object.values(persons).sort((a, b) =>
    getPreferredName(a).localeCompare(getPreferredName(b))
  );

  function handleSubmit() {
    if (!canSubmit) return;

    const now = nowISO();
    const birthYearNum = birthYear ? parseInt(birthYear, 10) : undefined;
    const deathYearNum = deathYear ? parseInt(deathYear, 10) : undefined;
    const birthPlace = [birthCity, birthState].filter(Boolean).join(', ') || undefined;

    const facts = [];
    if (birthYearNum || birthCity || birthState) {
      facts.push({
        id: generateId(),
        personId: '',
        type: 'birth' as const,
        date: birthYearNum ? { year: birthYearNum } : undefined,
        place: birthPlace ? { city: birthCity || undefined, state: birthState || undefined, fullText: birthPlace } : undefined,
        confidence: 'unverified' as const,
        citationIds: [],
        isPreferred: true,
        createdAt: now,
        updatedAt: now,
      });
    }
    if (deathYearNum) {
      facts.push({
        id: generateId(),
        personId: '',
        type: 'death' as const,
        date: { year: deathYearNum },
        confidence: 'unverified' as const,
        citationIds: [],
        isPreferred: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const newPerson = addPerson({
      names: [{
        id: generateId(),
        personId: '',
        given: given.trim(),
        surname: surname.trim(),
        type: 'birth',
        isPreferred: true,
        citationIds: [],
      }],
      gender,
      birthYear: birthYearNum,
      birthPlace,
      deathYear: deathYearNum,
      isLiving: deathYearNum ? false : isLiving,
      facts,
    });

    // Wire up family relationships
    if (relationship !== 'standalone' && relativeId) {
      const relative = persons[relativeId];
      if (!relative) { onClose(); return; }

      if (relationship === 'child_of') {
        // Find existing family where relative is a parent
        const parentFamily = Object.values(families).find(
          f => (f.spouse1Id === relativeId || f.spouse2Id === relativeId) &&
               f.childIds.length >= 0
        );
        if (parentFamily) {
          linkChildToFamily(parentFamily.id, newPerson.id);
        } else {
          const fam = addFamily({ spouse1Id: relativeId });
          linkChildToFamily(fam.id, newPerson.id);
        }
      }

      if (relationship === 'parent_of') {
        // Find existing family where relative is a child
        const childFamily = Object.values(families).find(
          f => f.childIds.includes(relativeId)
        );
        if (childFamily) {
          // Add new person as a spouse in the family that has this child
          if (!childFamily.spouse1Id) {
            updateFamily(childFamily.id, { spouse1Id: newPerson.id });
          } else if (!childFamily.spouse2Id) {
            updateFamily(childFamily.id, { spouse2Id: newPerson.id });
          } else {
            // Both parents occupied — create a separate family
            const fam = addFamily({ spouse1Id: newPerson.id });
            linkChildToFamily(fam.id, relativeId);
          }
        } else {
          const fam = addFamily({ spouse1Id: newPerson.id });
          linkChildToFamily(fam.id, relativeId);
        }
      }

      if (relationship === 'spouse_of') {
        // Find existing family where relative is a spouse without a partner
        const spouseFamily = Object.values(families).find(
          f => (f.spouse1Id === relativeId && !f.spouse2Id) ||
               (f.spouse2Id === relativeId && !f.spouse1Id)
        );
        if (spouseFamily) {
          if (!spouseFamily.spouse1Id) {
            updateFamily(spouseFamily.id, { spouse1Id: newPerson.id });
          } else {
            updateFamily(spouseFamily.id, { spouse2Id: newPerson.id });
          }
        } else {
          addFamily({ spouse1Id: relativeId, spouse2Id: newPerson.id });
        }
      }
    }

    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-600" />
            <h2 className="text-base font-serif font-bold text-gray-900">Add a Person</h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
              <input
                type="text"
                value={given}
                onChange={e => setGiven(e.target.value)}
                placeholder="Given name"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
              <input
                type="text"
                value={surname}
                onChange={e => setSurname(e.target.value)}
                placeholder="Surname"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
            <div className="flex gap-2">
              {(['male', 'female', 'unknown'] as Gender[]).map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors',
                    gender === g
                      ? g === 'male' ? 'bg-blue-100 border-blue-400 text-blue-700'
                        : g === 'female' ? 'bg-pink-100 border-pink-400 text-pink-700'
                        : 'bg-gray-100 border-gray-400 text-gray-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Birth */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Birth</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={birthYear}
                onChange={e => setBirthYear(e.target.value)}
                placeholder="Year"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <input
                type="text"
                value={birthCity}
                onChange={e => setBirthCity(e.target.value)}
                placeholder="City"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <input
                type="text"
                value={birthState}
                onChange={e => setBirthState(e.target.value)}
                placeholder="State"
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Living / Death */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={isLiving}
                onChange={e => setIsLiving(e.target.checked)}
                className="rounded"
              />
              Currently living
            </label>
            {!isLiving && (
              <div className="flex-1">
                <input
                  type="number"
                  value={deathYear}
                  onChange={e => setDeathYear(e.target.value)}
                  placeholder="Death year"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            )}
          </div>

          {/* Relationship */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Relationship to existing person</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([
                ['standalone', 'No connection'],
                ['child_of',   'Child of…'],
                ['parent_of',  'Parent of…'],
                ['spouse_of',  'Spouse of…'],
              ] as [Relationship, string][]).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setRelationship(val)}
                  className={cn(
                    'py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    relationship === val
                      ? 'bg-primary-100 border-primary-400 text-primary-700'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {relationship !== 'standalone' && (
              <select
                value={relativeId}
                onChange={e => setRelativeId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                <option value="">— select person —</option>
                {sortedPersons.map(p => (
                  <option key={p.id} value={p.id}>
                    {getPreferredName(p)}{p.birthYear ? ` (${p.birthYear})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white text-sm font-semibold transition-colors"
          >
            Add Person
          </button>
        </div>
      </div>
    </div>
  );
}
