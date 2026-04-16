/**
 * Demo seed data for testing the app without going through onboarding.
 * Includes a realistic multi-generation family and one ancestor with a
 * pre-set WikiTree ID so the Auto-Build feature can be tested immediately.
 *
 * Usage:
 *   import { seedDemoData } from '@/lib/seedData';
 *   seedDemoData();  // Call from anywhere outside React render (e.g., button handler)
 */

import { useGenealogyStore } from '@/store/genealogyStore';
import { generateId, nowISO } from './utils';
import type { Fact, PersonName } from './types';

function makeName(given: string, surname: string, maidenName?: string): PersonName {
  return {
    id: generateId(),
    personId: '',        // fixed by addPerson
    given,
    surname,
    maidenName,
    type: 'birth',
    isPreferred: true,
    citationIds: [],
  };
}

function makeBirthFact(
  year?: number,
  city?: string,
  state?: string,
  country?: string,
): Fact[] {
  if (!year && !city && !state) return [];
  const now = nowISO();
  const fullText = [city, state, country].filter(Boolean).join(', ') || undefined;
  return [{
    id: generateId(),
    personId: '',
    type: 'birth',
    date: year ? { year } : undefined,
    place: fullText ? { city, state, country, fullText } : undefined,
    confidence: 'unverified',
    citationIds: [],
    isPreferred: true,
    createdAt: now,
    updatedAt: now,
  }];
}

function makeDeathFact(year?: number, city?: string, state?: string): Fact[] {
  if (!year && !city) return [];
  const now = nowISO();
  const fullText = [city, state].filter(Boolean).join(', ') || undefined;
  return [{
    id: generateId(),
    personId: '',
    type: 'death',
    date: year ? { year } : undefined,
    place: fullText ? { city, state, fullText } : undefined,
    confidence: 'unverified',
    citationIds: [],
    isPreferred: true,
    createdAt: now,
    updatedAt: now,
  }];
}

export function seedDemoData() {
  const store = useGenealogyStore.getState();
  store.clearAll();

  // ── Generation 0: Root + Spouse + Children ───────────────────────────────────

  const root = store.addPerson({
    names: [makeName('Alex', 'Johnson')],
    gender: 'male',
    birthYear: 1985,
    birthPlace: 'New York, NY, USA',
    isLiving: true,
    facts: makeBirthFact(1985, 'New York', 'NY', 'USA'),
  });

  const spouse = store.addPerson({
    names: [makeName('Jordan', 'Johnson', 'Williams')],
    gender: 'female',
    birthYear: 1987,
    birthPlace: 'Boston, MA, USA',
    isLiving: true,
    facts: makeBirthFact(1987, 'Boston', 'MA', 'USA'),
  });

  const child1 = store.addPerson({
    names: [makeName('Sam', 'Johnson')],
    gender: 'male',
    birthYear: 2012,
    birthPlace: 'New York, NY, USA',
    isLiving: true,
    facts: makeBirthFact(2012, 'New York', 'NY', 'USA'),
  });

  const child2 = store.addPerson({
    names: [makeName('Riley', 'Johnson')],
    gender: 'female',
    birthYear: 2015,
    birthPlace: 'New York, NY, USA',
    isLiving: true,
    facts: makeBirthFact(2015, 'New York', 'NY', 'USA'),
  });

  // ── Generation 1: Parents ────────────────────────────────────────────────────

  const father = store.addPerson({
    names: [makeName('Robert', 'Johnson')],
    gender: 'male',
    birthYear: 1955,
    birthPlace: 'Chicago, IL, USA',
    deathYear: 2020,
    facts: [
      ...makeBirthFact(1955, 'Chicago', 'IL', 'USA'),
      ...makeDeathFact(2020, 'Chicago', 'IL'),
    ],
  });

  const mother = store.addPerson({
    names: [makeName('Linda', 'Johnson', 'Davis')],
    gender: 'female',
    birthYear: 1958,
    birthPlace: 'Los Angeles, CA, USA',
    isLiving: true,
    facts: makeBirthFact(1958, 'Los Angeles', 'CA', 'USA'),
  });

  // ── Generation 2: Grandparents ───────────────────────────────────────────────

  const patGF = store.addPerson({
    names: [makeName('George', 'Johnson')],
    gender: 'male',
    birthYear: 1928,
    birthPlace: 'Detroit, MI, USA',
    deathYear: 1998,
    facts: [
      ...makeBirthFact(1928, 'Detroit', 'MI', 'USA'),
      ...makeDeathFact(1998, 'Detroit', 'MI'),
    ],
  });

  const patGM = store.addPerson({
    names: [makeName('Eleanor', 'Johnson', 'Smith')],
    gender: 'female',
    birthYear: 1930,
    birthPlace: 'Detroit, MI, USA',
    deathYear: 2005,
    facts: [
      ...makeBirthFact(1930, 'Detroit', 'MI', 'USA'),
      ...makeDeathFact(2005, 'Detroit', 'MI'),
    ],
  });

  const matGF = store.addPerson({
    names: [makeName('James', 'Davis')],
    gender: 'male',
    birthYear: 1930,
    birthPlace: 'Houston, TX, USA',
    deathYear: 2010,
    facts: [
      ...makeBirthFact(1930, 'Houston', 'TX', 'USA'),
      ...makeDeathFact(2010, 'Houston', 'TX'),
    ],
  });

  const matGM = store.addPerson({
    names: [makeName('Dorothy', 'Davis', 'Brown')],
    gender: 'female',
    birthYear: 1932,
    birthPlace: 'Houston, TX, USA',
    deathYear: 2015,
    facts: [
      ...makeBirthFact(1932, 'Houston', 'TX', 'USA'),
      ...makeDeathFact(2015, 'Houston', 'TX'),
    ],
  });

  // ── Generation 3: Paternal Great-grandparents ────────────────────────────────

  const patGGF = store.addPerson({
    names: [makeName('William', 'Johnson')],
    gender: 'male',
    birthYear: 1900,
    birthPlace: 'Philadelphia, PA, USA',
    deathYear: 1965,
    // Pre-linked WikiTree ID → Auto-Build Banner appears immediately for testing.
    // Click "Auto-Build" on this person (or the banner) to fetch his ancestors.
    wikiTreeId: 'Washington-1',
    facts: [
      ...makeBirthFact(1900, 'Philadelphia', 'PA', 'USA'),
      ...makeDeathFact(1965, 'Philadelphia', 'PA'),
    ],
  });

  const patGGM = store.addPerson({
    names: [makeName('Clara', 'Johnson', 'Moore')],
    gender: 'female',
    birthYear: 1903,
    birthPlace: 'Philadelphia, PA, USA',
    deathYear: 1978,
    facts: [
      ...makeBirthFact(1903, 'Philadelphia', 'PA', 'USA'),
      ...makeDeathFact(1978, 'Philadelphia', 'PA'),
    ],
  });

  // ── Build Families ───────────────────────────────────────────────────────────

  // Alex + Jordan → Sam, Riley
  const rootFam = store.addFamily({ spouse1Id: root.id, spouse2Id: spouse.id });
  store.linkChildToFamily(rootFam.id, child1.id);
  store.linkChildToFamily(rootFam.id, child2.id);

  // Robert + Linda → Alex
  const parentFam = store.addFamily({ spouse1Id: father.id, spouse2Id: mother.id });
  store.linkChildToFamily(parentFam.id, root.id);

  // George + Eleanor → Robert
  const patGrandFam = store.addFamily({ spouse1Id: patGF.id, spouse2Id: patGM.id });
  store.linkChildToFamily(patGrandFam.id, father.id);

  // James + Dorothy → Linda
  const matGrandFam = store.addFamily({ spouse1Id: matGF.id, spouse2Id: matGM.id });
  store.linkChildToFamily(matGrandFam.id, mother.id);

  // William + Clara → George
  const patGGFam = store.addFamily({ spouse1Id: patGGF.id, spouse2Id: patGGM.id });
  store.linkChildToFamily(patGGFam.id, patGF.id);

  // ── Finalise ─────────────────────────────────────────────────────────────────

  store.setRootPerson(root.id);
  store.setOnboardingComplete(true);
}
