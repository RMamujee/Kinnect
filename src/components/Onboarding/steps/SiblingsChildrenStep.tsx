'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { OnboardingPersonInput } from '@/lib/types';
import { PersonMiniForm } from '../PersonMiniForm';

interface Props {
  siblings: OnboardingPersonInput[];
  children: OnboardingPersonInput[];
  spouse?: OnboardingPersonInput;
  onChangeSiblings: (v: OnboardingPersonInput[]) => void;
  onChangeChildren: (v: OnboardingPersonInput[]) => void;
  onChangeSpouse: (v?: OnboardingPersonInput) => void;
}

const emptyPerson = (gender: 'male' | 'female' | 'unknown' = 'unknown'): OnboardingPersonInput => ({
  given: '', surname: '', gender, isLiving: true,
});

export function SiblingsChildrenStep({
  siblings, children, spouse,
  onChangeSiblings, onChangeChildren, onChangeSpouse,
}: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Spouse, Siblings & Children</h2>
        <p className="mt-1 text-sm text-gray-500">Add as many as you know. You can always add more later.</p>
      </div>

      {/* Spouse */}
      <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Spouse / Partner</h3>
        <PersonMiniForm
          label="Spouse / Partner"
          value={spouse}
          defaultGender="unknown"
          onChange={onChangeSpouse}
          showMaiden
        />
      </div>

      {/* Siblings */}
      <RepeatableSection
        title="Siblings"
        items={siblings}
        onChange={onChangeSiblings}
        renderItem={(sibling, idx) => (
          <PersonMiniForm
            key={idx}
            label={`Sibling ${idx + 1}`}
            value={sibling}
            defaultGender="unknown"
            onChange={v => {
              if (!v) {
                onChangeSiblings(siblings.filter((_, i) => i !== idx));
              } else {
                onChangeSiblings(siblings.map((s, i) => i === idx ? v : s));
              }
            }}
          />
        )}
        onAdd={() => onChangeSiblings([...siblings, emptyPerson()])}
      />

      {/* Children */}
      <RepeatableSection
        title="Children"
        items={children}
        onChange={onChangeChildren}
        renderItem={(child, idx) => (
          <PersonMiniForm
            key={idx}
            label={`Child ${idx + 1}`}
            value={child}
            defaultGender="unknown"
            onChange={v => {
              if (!v) {
                onChangeChildren(children.filter((_, i) => i !== idx));
              } else {
                onChangeChildren(children.map((c, i) => i === idx ? v : c));
              }
            }}
          />
        )}
        onAdd={() => onChangeChildren([...children, emptyPerson()])}
      />
    </div>
  );
}

function RepeatableSection<T>({
  title, items, onChange, renderItem, onAdd
}: {
  title: string;
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, idx: number) => React.ReactNode;
  onAdd: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-gray-50/50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <button
          type="button"
          onClick={onAdd}
          className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add {title.slice(0, -1)}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">No {title.toLowerCase()} added yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item, idx) => renderItem(item, idx))}
        </div>
      )}
    </div>
  );
}
