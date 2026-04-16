import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import type {
  Person, Family, Source, Citation, Fact, PersonName,
  GenealogyState, OnboardingData, OnboardingPersonInput,
  Gender, ConfidenceLevel,
} from '@/lib/types';
import { nowISO, generateId } from '@/lib/utils';

interface GenealogyStore extends GenealogyState {
  // Hydration
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  clearAll: () => void;

  // Person actions
  addPerson: (data: Partial<Person> & { names: PersonName[] }) => Person;
  updatePerson: (id: string, data: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  setSelectedPerson: (id: string | null) => void;
  setRootPerson: (id: string) => void;

  // Family actions
  addFamily: (data: Partial<Family>) => Family;
  updateFamily: (id: string, data: Partial<Family>) => void;
  linkChildToFamily: (familyId: string, childId: string) => void;

  // Source & Citation actions
  addSource: (data: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) => Source;
  addCitation: (data: Omit<Citation, 'id' | 'createdAt'>) => Citation;
  updateSource: (id: string, data: Partial<Source>) => void;

  // Fact actions
  addFact: (personId: string, fact: Omit<Fact, 'id' | 'personId' | 'createdAt' | 'updatedAt'>) => Fact;
  updateFact: (personId: string, factId: string, data: Partial<Fact>) => void;

  // Bulk import from external sources (auto-extend)
  importExternalPersons: (persons: Person[], families: Family[]) => { added: number; skipped: number };
  getExistingWikiTreeIds: () => string[];

  // Onboarding
  completeOnboarding: (data: OnboardingData) => void;
  setOnboardingComplete: (val: boolean) => void;

  // Helpers
  getPersonById: (id: string) => Person | undefined;
  getFamiliesForPerson: (personId: string) => Family[];
  getParentsOfPerson: (personId: string) => { father?: Person; mother?: Person };
  getChildrenOfPerson: (personId: string) => Person[];
  getSpouseOfPerson: (personId: string) => Person | undefined;
}

function makeDefaultGPSStatus() {
  return {
    searchCompleted: false,
    sourcesSearched: [],
    allFactsCited: false,
    citationCount: 0,
    sourcesAnalyzed: false,
    conflictsIdentified: 0,
    conflictsResolved: false,
    unresolvedConflicts: 0,
    conclusionWritten: false,
    overallConfidence: 'unverified' as ConfidenceLevel,
  };
}

function buildPersonFromInput(
  input: OnboardingPersonInput,
  addedByUser = true,
): Omit<Person, 'id'> {
  const nameId = generateId();
  const now = nowISO();

  const facts: Fact[] = [];

  if (input.birthYear || input.birthCity || input.birthState || input.birthCountry) {
    facts.push({
      id: generateId(),
      personId: '', // filled in after
      type: 'birth',
      date: input.birthYear ? {
        year: input.birthYear,
        month: input.birthMonth,
        day: input.birthDay,
      } : undefined,
      place: (input.birthCity || input.birthState || input.birthCountry) ? {
        city: input.birthCity,
        state: input.birthState,
        country: input.birthCountry,
        fullText: [input.birthCity, input.birthState, input.birthCountry].filter(Boolean).join(', '),
      } : undefined,
      confidence: 'unverified',
      citationIds: [],
      isPreferred: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (input.deathYear || input.deathCity || input.deathState) {
    facts.push({
      id: generateId(),
      personId: '',
      type: 'death',
      date: input.deathYear ? { year: input.deathYear } : undefined,
      place: (input.deathCity || input.deathState) ? {
        city: input.deathCity,
        state: input.deathState,
        fullText: [input.deathCity, input.deathState].filter(Boolean).join(', '),
      } : undefined,
      confidence: 'unverified',
      citationIds: [],
      isPreferred: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  return {
    names: [{
      id: nameId,
      personId: '',
      given: input.given,
      surname: input.surname,
      maidenName: input.maidenName,
      type: 'birth',
      isPreferred: true,
      citationIds: [],
    }],
    gender: input.gender,
    facts,
    birthYear: input.birthYear,
    birthPlace: [input.birthCity, input.birthState, input.birthCountry].filter(Boolean).join(', ') || undefined,
    deathYear: input.deathYear,
    isLiving: input.isLiving,
    gpsStatus: makeDefaultGPSStatus(),
    addedByUser,
    autoPopulated: false,
    createdAt: now,
    updatedAt: now,
  };
}

export const useGenealogyStore = create<GenealogyStore>()(
  persist(
    (set, get) => ({
      persons: {},
      families: {},
      sources: {},
      citations: {},
      rootPersonId: null,
      selectedPersonId: null,
      onboardingComplete: false,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      clearAll: () => set({
        persons: {},
        families: {},
        sources: {},
        citations: {},
        rootPersonId: null,
        selectedPersonId: null,
        onboardingComplete: false,
      }),

      addPerson: (data) => {
        const id = generateId();
        const now = nowISO();
        const person: Person = {
          gpsStatus: makeDefaultGPSStatus(),
          gender: 'unknown',
          facts: [],
          addedByUser: true,
          autoPopulated: false,
          createdAt: now,
          updatedAt: now,
          ...data,
          id,
          names: data.names.map(n => ({ ...n, personId: id })),
        };
        // Fix personId on facts
        person.facts = person.facts.map(f => ({ ...f, personId: id }));
        set(s => ({ persons: { ...s.persons, [id]: person } }));
        return person;
      },

      updatePerson: (id, data) => {
        set(s => ({
          persons: {
            ...s.persons,
            [id]: { ...s.persons[id], ...data, updatedAt: nowISO() },
          },
        }));
      },

      deletePerson: (id) => {
        set(s => {
          const { [id]: _, ...rest } = s.persons;
          return { persons: rest };
        });
      },

      setSelectedPerson: (id) => set({ selectedPersonId: id }),
      setRootPerson: (id) => set({ rootPersonId: id }),

      addFamily: (data) => {
        const id = generateId();
        const now = nowISO();
        const family: Family = {
          childIds: [],
          relationshipType: 'biological',
          citationIds: [],
          createdAt: now,
          updatedAt: now,
          ...data,
          id,
        };
        set(s => ({ families: { ...s.families, [id]: family } }));
        return family;
      },

      updateFamily: (id, data) => {
        set(s => ({
          families: {
            ...s.families,
            [id]: { ...s.families[id], ...data, updatedAt: nowISO() },
          },
        }));
      },

      linkChildToFamily: (familyId, childId) => {
        set(s => {
          const family = s.families[familyId];
          if (!family || family.childIds.includes(childId)) return s;
          return {
            families: {
              ...s.families,
              [familyId]: {
                ...family,
                childIds: [...family.childIds, childId],
                updatedAt: nowISO(),
              },
            },
          };
        });
      },

      addSource: (data) => {
        const id = generateId();
        const now = nowISO();
        const source: Source = { ...data, id, createdAt: now, updatedAt: now };
        set(s => ({ sources: { ...s.sources, [id]: source } }));
        return source;
      },

      updateSource: (id, data) => {
        set(s => ({
          sources: {
            ...s.sources,
            [id]: { ...s.sources[id], ...data, updatedAt: nowISO() },
          },
        }));
      },

      addCitation: (data) => {
        const id = generateId();
        const citation: Citation = { ...data, id, createdAt: nowISO() };
        set(s => ({ citations: { ...s.citations, [id]: citation } }));
        return citation;
      },

      addFact: (personId, factData) => {
        const id = generateId();
        const now = nowISO();
        const fact: Fact = {
          ...factData,
          id,
          personId,
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({
          persons: {
            ...s.persons,
            [personId]: {
              ...s.persons[personId],
              facts: [...(s.persons[personId]?.facts ?? []), fact],
              updatedAt: now,
            },
          },
        }));
        return fact;
      },

      updateFact: (personId, factId, data) => {
        set(s => {
          const person = s.persons[personId];
          if (!person) return s;
          return {
            persons: {
              ...s.persons,
              [personId]: {
                ...person,
                facts: person.facts.map(f =>
                  f.id === factId ? { ...f, ...data, updatedAt: nowISO() } : f
                ),
              },
            },
          };
        });
      },

      completeOnboarding: (data: OnboardingData) => {
        const store = get();

        // Create self
        const selfPerson = store.addPerson(buildPersonFromInput(data.self, true) as Parameters<typeof store.addPerson>[0]);
        store.setRootPerson(selfPerson.id);

        const spousePerson = data.spouse ? store.addPerson(buildPersonFromInput(data.spouse) as Parameters<typeof store.addPerson>[0]) : undefined;

        // Create parents
        const fatherPerson = data.father ? store.addPerson(buildPersonFromInput(data.father) as Parameters<typeof store.addPerson>[0]) : undefined;
        const motherPerson = data.mother ? store.addPerson(buildPersonFromInput(data.mother) as Parameters<typeof store.addPerson>[0]) : undefined;

        // Create grandparents
        const patGF = data.paternalGrandfather ? store.addPerson(buildPersonFromInput(data.paternalGrandfather) as Parameters<typeof store.addPerson>[0]) : undefined;
        const patGM = data.paternalGrandmother ? store.addPerson(buildPersonFromInput(data.paternalGrandmother) as Parameters<typeof store.addPerson>[0]) : undefined;
        const matGF = data.maternalGrandfather ? store.addPerson(buildPersonFromInput(data.maternalGrandfather) as Parameters<typeof store.addPerson>[0]) : undefined;
        const matGM = data.maternalGrandmother ? store.addPerson(buildPersonFromInput(data.maternalGrandmother) as Parameters<typeof store.addPerson>[0]) : undefined;

        // Create children
        const childPersons = data.children.map(c =>
          store.addPerson(buildPersonFromInput(c) as Parameters<typeof store.addPerson>[0])
        );

        // Create siblings
        const siblingPersons = data.siblings.map(s =>
          store.addPerson(buildPersonFromInput(s) as Parameters<typeof store.addPerson>[0])
        );

        // Family: self + parents
        if (fatherPerson || motherPerson) {
          const parentFamily = store.addFamily({
            spouse1Id: fatherPerson?.id,
            spouse2Id: motherPerson?.id,
          });
          store.linkChildToFamily(parentFamily.id, selfPerson.id);
          siblingPersons.forEach(sib => store.linkChildToFamily(parentFamily.id, sib.id));
        }

        // Family: paternal grandparents → father
        if ((patGF || patGM) && fatherPerson) {
          const patFamily = store.addFamily({ spouse1Id: patGF?.id, spouse2Id: patGM?.id });
          store.linkChildToFamily(patFamily.id, fatherPerson.id);
        }

        // Family: maternal grandparents → mother
        if ((matGF || matGM) && motherPerson) {
          const matFamily = store.addFamily({ spouse1Id: matGF?.id, spouse2Id: matGM?.id });
          store.linkChildToFamily(matFamily.id, motherPerson.id);
        }

        // Family: self + spouse + children
        if (spousePerson || childPersons.length > 0) {
          const selfFamily = store.addFamily({
            spouse1Id: selfPerson.id,
            spouse2Id: spousePerson?.id,
          });
          childPersons.forEach(child => store.linkChildToFamily(selfFamily.id, child.id));
        }

        set({ onboardingComplete: true });
      },

      importExternalPersons: (newPersons, newFamilies) => {
        const existing = get().persons;
        const existingWTIds = new Set(
          Object.values(existing).map(p => p.wikiTreeId).filter(Boolean) as string[]
        );

        let added = 0;
        let skipped = 0;

        const personUpdates: Record<string, Person> = {};
        const idRemap: Record<string, string> = {}; // incoming id → final id (in case of dedup)

        for (const person of newPersons) {
          if (person.wikiTreeId && existingWTIds.has(person.wikiTreeId)) {
            // Find existing person with this wikiTreeId and remap
            const existing_person = Object.values(existing).find(p => p.wikiTreeId === person.wikiTreeId);
            if (existing_person) idRemap[person.id] = existing_person.id;
            skipped++;
          } else {
            personUpdates[person.id] = person;
            if (person.wikiTreeId) existingWTIds.add(person.wikiTreeId);
            idRemap[person.id] = person.id;
            added++;
          }
        }

        const familyUpdates: Record<string, Family> = {};
        const existingFamilies = get().families;

        for (const family of newFamilies) {
          // Remap person IDs in family to final IDs
          const s1 = family.spouse1Id ? (idRemap[family.spouse1Id] ?? family.spouse1Id) : undefined;
          const s2 = family.spouse2Id ? (idRemap[family.spouse2Id] ?? family.spouse2Id) : undefined;
          const children = family.childIds.map(cid => idRemap[cid] ?? cid);

          // Check if a family with same spouses already exists
          const existingFam = Object.values(existingFamilies).find(
            ef => (ef.spouse1Id === s1 && ef.spouse2Id === s2) ||
                  (ef.spouse1Id === s2 && ef.spouse2Id === s1)
          );

          if (existingFam) {
            // Merge children in
            const mergedChildren = Array.from(new Set([...existingFam.childIds, ...children]));
            familyUpdates[existingFam.id] = { ...existingFam, childIds: mergedChildren, updatedAt: nowISO() };
          } else if (s1 || s2) {
            familyUpdates[family.id] = { ...family, spouse1Id: s1, spouse2Id: s2, childIds: children };
          }
        }

        set(state => ({
          persons: { ...state.persons, ...personUpdates },
          families: { ...state.families, ...familyUpdates },
        }));

        return { added, skipped };
      },

      getExistingWikiTreeIds: () => {
        return Object.values(get().persons)
          .map(p => p.wikiTreeId)
          .filter(Boolean) as string[];
      },

      setOnboardingComplete: (val) => set({ onboardingComplete: val }),

      getPersonById: (id) => get().persons[id],

      getFamiliesForPerson: (personId) => {
        return Object.values(get().families).filter(
          f => f.spouse1Id === personId || f.spouse2Id === personId || f.childIds.includes(personId)
        );
      },

      getParentsOfPerson: (personId) => {
        const families = Object.values(get().families).filter(f => f.childIds.includes(personId));
        if (families.length === 0) return {};
        const family = families[0];
        const persons = get().persons;
        const p1 = family.spouse1Id ? persons[family.spouse1Id] : undefined;
        const p2 = family.spouse2Id ? persons[family.spouse2Id] : undefined;
        const father = p1?.gender === 'male' ? p1 : p2?.gender === 'male' ? p2 : undefined;
        const mother = p1?.gender === 'female' ? p1 : p2?.gender === 'female' ? p2 : undefined;
        return { father, mother };
      },

      getChildrenOfPerson: (personId) => {
        const persons = get().persons;
        const families = Object.values(get().families).filter(
          f => f.spouse1Id === personId || f.spouse2Id === personId
        );
        const childIds = families.flatMap(f => f.childIds);
        return childIds.map(id => persons[id]).filter(Boolean) as Person[];
      },

      getSpouseOfPerson: (personId) => {
        const persons = get().persons;
        const family = Object.values(get().families).find(
          f => (f.spouse1Id === personId || f.spouse2Id === personId) &&
               f.spouse1Id !== undefined && f.spouse2Id !== undefined
        );
        if (!family) return undefined;
        const spouseId = family.spouse1Id === personId ? family.spouse2Id : family.spouse1Id;
        return spouseId ? persons[spouseId] : undefined;
      },
    }),
    {
      name: 'ancestry-genealogy',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // Don't persist transient UI state
      partialize: (state) => ({
        persons: state.persons,
        families: state.families,
        sources: state.sources,
        citations: state.citations,
        rootPersonId: state.rootPersonId,
        onboardingComplete: state.onboardingComplete,
      }),
    }
  )
);
