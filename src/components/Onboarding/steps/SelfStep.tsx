'use client';

import type { OnboardingPersonInput } from '@/lib/types';

interface Props {
  value: OnboardingPersonInput;
  onChange: (v: OnboardingPersonInput) => void;
}

export function SelfStep({ value, onChange }: Props) {
  const update = (field: keyof OnboardingPersonInput, val: string | number | boolean | undefined) =>
    onChange({ ...value, [field]: val });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Tell us about yourself</h2>
        <p className="mt-1 text-sm text-gray-500">
          This is the foundation of your family tree. All fields marked * are required.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First / Given Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.given}
            onChange={e => update('given', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="e.g. John"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last / Family Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={value.surname}
            onChange={e => update('surname', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="e.g. Smith"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
        <div className="flex gap-4">
          {(['male', 'female', 'unknown'] as const).map(g => (
            <label key={g} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={value.gender === g}
                onChange={() => update('gender', g)}
                className="accent-primary-600"
              />
              <span className="text-sm capitalize text-gray-700">{g}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Birth Date</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <input
              type="number"
              value={value.birthYear ?? ''}
              onChange={e => update('birthYear', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              placeholder="Year (e.g. 1985)"
              min={1600}
              max={new Date().getFullYear()}
            />
          </div>
          <div>
            <select
              value={value.birthMonth ?? ''}
              onChange={e => update('birthMonth', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none bg-white"
            >
              <option value="">Month</option>
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="number"
              value={value.birthDay ?? ''}
              onChange={e => update('birthDay', e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
              placeholder="Day"
              min={1}
              max={31}
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Birth Place</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={value.birthCity ?? ''}
            onChange={e => update('birthCity', e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="City"
          />
          <input
            type="text"
            value={value.birthState ?? ''}
            onChange={e => update('birthState', e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="State / Province"
          />
          <input
            type="text"
            value={value.birthCountry ?? ''}
            onChange={e => update('birthCountry', e.target.value || undefined)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
            placeholder="Country"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isLiving"
          type="checkbox"
          checked={value.isLiving ?? true}
          onChange={e => update('isLiving', e.target.checked)}
          className="accent-primary-600 w-4 h-4"
        />
        <label htmlFor="isLiving" className="text-sm text-gray-700">I am currently living</label>
      </div>
    </div>
  );
}
