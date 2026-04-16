'use client';

import type { OnboardingPersonInput, Gender } from '@/lib/types';

interface Props {
  label: string;
  value?: OnboardingPersonInput;
  defaultGender: Gender;
  onChange: (v?: OnboardingPersonInput) => void;
  showMaiden?: boolean;
}

const empty = (gender: Gender): OnboardingPersonInput => ({
  given: '', surname: '', gender, isLiving: false,
});

export function PersonMiniForm({ label, value, defaultGender, onChange, showMaiden }: Props) {
  const isEnabled = !!value;

  const update = (field: keyof OnboardingPersonInput, val: string | number | boolean | undefined) => {
    if (!value) return;
    onChange({ ...value, [field]: val });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">{label}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={e => onChange(e.target.checked ? empty(defaultGender) : undefined)}
            className="accent-primary-600 w-4 h-4"
          />
          <span className="text-xs text-gray-500">Add</span>
        </label>
      </div>

      {isEnabled && (
        <div className="space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={value.given}
              onChange={e => update('given', e.target.value)}
              placeholder="Given name"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <input
              type="text"
              value={value.surname}
              onChange={e => update('surname', e.target.value)}
              placeholder="Surname"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
          {showMaiden && (
            <input
              type="text"
              value={value.maidenName ?? ''}
              onChange={e => update('maidenName', e.target.value || undefined)}
              placeholder="Maiden name (if applicable)"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={value.birthYear ?? ''}
              onChange={e => update('birthYear', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Birth year"
              min={1600}
              max={new Date().getFullYear()}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
            <input
              type="text"
              value={value.birthCity ?? ''}
              onChange={e => update('birthCity', e.target.value || undefined)}
              placeholder="Birthplace"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`living-${label}`}
              checked={value.isLiving ?? false}
              onChange={e => update('isLiving', e.target.checked)}
              className="accent-primary-600 w-3.5 h-3.5"
            />
            <label htmlFor={`living-${label}`} className="text-xs text-gray-500">Still living</label>
            {!value.isLiving && (
              <>
                <span className="text-gray-300 mx-1">|</span>
                <input
                  type="number"
                  value={value.deathYear ?? ''}
                  onChange={e => update('deathYear', e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Death year"
                  min={1600}
                  max={new Date().getFullYear()}
                  className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
