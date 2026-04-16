'use client';

import type { OnboardingPersonInput } from '@/lib/types';
import { PersonMiniForm } from '../PersonMiniForm';

interface Props {
  father?: OnboardingPersonInput;
  mother?: OnboardingPersonInput;
  paternalGrandfather?: OnboardingPersonInput;
  paternalGrandmother?: OnboardingPersonInput;
  maternalGrandfather?: OnboardingPersonInput;
  maternalGrandmother?: OnboardingPersonInput;
  onChangeFather: (v?: OnboardingPersonInput) => void;
  onChangeMother: (v?: OnboardingPersonInput) => void;
  onChangePaternalGF: (v?: OnboardingPersonInput) => void;
  onChangePaternalGM: (v?: OnboardingPersonInput) => void;
  onChangeMaternalGF: (v?: OnboardingPersonInput) => void;
  onChangeMaternalGM: (v?: OnboardingPersonInput) => void;
}

const defaultPerson = (gender: 'male' | 'female'): OnboardingPersonInput => ({
  given: '',
  surname: '',
  gender,
  isLiving: false,
});

export function ParentsStep({
  father, mother,
  paternalGrandfather, paternalGrandmother,
  maternalGrandfather, maternalGrandmother,
  onChangeFather, onChangeMother,
  onChangePaternalGF, onChangePaternalGM,
  onChangeMaternalGF, onChangeMaternalGM,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Parents & Grandparents</h2>
        <p className="mt-1 text-sm text-gray-500">
          Enter as much as you know. You can skip anyone and add them later.
        </p>
      </div>

      <Section title="Parents">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonMiniForm
            label="Father"
            value={father}
            defaultGender="male"
            onChange={onChangeFather}
            showMaiden={false}
          />
          <PersonMiniForm
            label="Mother"
            value={mother}
            defaultGender="female"
            onChange={onChangeMother}
            showMaiden
          />
        </div>
      </Section>

      <Section title="Paternal Grandparents (Father's Parents)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonMiniForm
            label="Paternal Grandfather"
            value={paternalGrandfather}
            defaultGender="male"
            onChange={onChangePaternalGF}
          />
          <PersonMiniForm
            label="Paternal Grandmother"
            value={paternalGrandmother}
            defaultGender="female"
            onChange={onChangePaternalGM}
            showMaiden
          />
        </div>
      </Section>

      <Section title="Maternal Grandparents (Mother's Parents)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PersonMiniForm
            label="Maternal Grandfather"
            value={maternalGrandfather}
            defaultGender="male"
            onChange={onChangeMaternalGF}
          />
          <PersonMiniForm
            label="Maternal Grandmother"
            value={maternalGrandmother}
            defaultGender="female"
            onChange={onChangeMaternalGM}
            showMaiden
          />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
      <h3 className="text-base font-semibold text-gray-800 mb-3">{title}</h3>
      {children}
    </div>
  );
}
