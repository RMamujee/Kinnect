'use client';

import { useState } from 'react';
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import type { Fact, FactType, ConfidenceLevel } from '@/lib/types';
import { formatPartialDate, cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────────────────────────────

export const FACT_TYPE_LABELS: Record<FactType, string> = {
  birth:           'Birth',
  baptism:         'Baptism / Christening',
  death:           'Death',
  burial:          'Burial',
  marriage:        'Marriage',
  divorce:         'Divorce',
  immigration:     'Immigration',
  emigration:      'Emigration',
  naturalization:  'Naturalization',
  residence:       'Residence',
  occupation:      'Occupation',
  education:       'Education',
  religion:        'Religion',
  military_service:'Military Service',
  name_change:     'Name Change',
  alias:           'Alias / Also Known As',
  note:            'General Note',
};

const FACT_CATEGORIES: { label: string; types: FactType[] }[] = [
  { label: 'Vital Events',              types: ['birth', 'baptism', 'death', 'burial'] },
  { label: 'Family',                    types: ['marriage', 'divorce'] },
  { label: 'Migration & Citizenship',   types: ['immigration', 'emigration', 'naturalization'] },
  { label: 'Life',                      types: ['residence', 'occupation', 'education', 'religion', 'military_service'] },
  { label: 'Other',                     types: ['name_change', 'alias', 'note'] },
];

// Fact types where a free-text value makes sense in addition to date/place
const VALUE_TYPES = new Set<FactType>([
  'occupation', 'education', 'religion', 'military_service', 'name_change', 'alias', 'note',
]);

const VALUE_LABEL: Partial<Record<FactType, string>> = {
  occupation:       'Occupation / Job Title',
  education:        'Institution or Degree',
  religion:         'Faith / Denomination',
  military_service: 'Unit, Branch, or Details',
  name_change:      'New Name',
  alias:            'Alias or Nickname',
  note:             'Note',
};

const FACT_DISPLAY_ORDER: FactType[] = [
  'birth', 'baptism', 'marriage', 'divorce', 'death', 'burial',
  'residence', 'occupation', 'education', 'religion', 'military_service',
  'immigration', 'emigration', 'naturalization',
  'name_change', 'alias', 'note',
];

const VALID_QUALIFIERS = ['about', 'before', 'after', 'between', 'calculated', 'estimated'] as const;
type DateQualifier = typeof VALID_QUALIFIERS[number];

// ── Form state helpers ─────────────────────────────────────────────────────────

interface FactFormState {
  year: string;
  month: string;
  day: string;
  qualifier: string;
  city: string;
  county: string;
  state: string;
  country: string;
  value: string;
  confidence: ConfidenceLevel;
  notes: string;
}

function emptyForm(): FactFormState {
  return { year: '', month: '', day: '', qualifier: '', city: '', county: '', state: '', country: '', value: '', confidence: 'unverified', notes: '' };
}

function factToForm(fact: Fact): FactFormState {
  return {
    year:       fact.date?.year?.toString()  ?? '',
    month:      fact.date?.month?.toString() ?? '',
    day:        fact.date?.day?.toString()   ?? '',
    qualifier:  fact.date?.qualifier         ?? '',
    city:       fact.place?.city    ?? '',
    county:     fact.place?.county  ?? '',
    state:      fact.place?.state   ?? '',
    country:    fact.place?.country ?? '',
    value:      fact.value          ?? '',
    confidence: fact.confidence,
    notes:      fact.notes          ?? '',
  };
}

function formToFactData(s: FactFormState): Partial<Omit<Fact, 'id' | 'personId' | 'type' | 'citationIds' | 'isPreferred' | 'createdAt' | 'updatedAt'>> {
  const year  = s.year  ? parseInt(s.year)  : undefined;
  const month = s.month ? parseInt(s.month) : undefined;
  const day   = s.day   ? parseInt(s.day)   : undefined;
  const qualifier = VALID_QUALIFIERS.includes(s.qualifier as DateQualifier)
    ? (s.qualifier as DateQualifier)
    : undefined;
  const hasDate  = !!(year || month || day || qualifier);
  const hasPlace = !!(s.city || s.county || s.state || s.country);

  return {
    date: hasDate ? { year, month, day, qualifier } : undefined,
    place: hasPlace ? {
      city:     s.city     || undefined,
      county:   s.county   || undefined,
      state:    s.state    || undefined,
      country:  s.country  || undefined,
      fullText: [s.city, s.county, s.state, s.country].filter(Boolean).join(', '),
    } : undefined,
    value:      s.value || undefined,
    confidence: s.confidence,
    notes:      s.notes || undefined,
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FactForm({
  factType,
  initial,
  onSave,
  onCancel,
}: {
  factType: FactType;
  initial: FactFormState;
  onSave: (data: ReturnType<typeof formToFactData>) => void;
  onCancel: () => void;
}) {
  const [s, setS] = useState<FactFormState>(initial);
  const set = (k: keyof FactFormState, v: string) => setS(prev => ({ ...prev, [k]: v }));
  const showValue = VALUE_TYPES.has(factType);

  const inputCls = 'w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200';
  const selectCls = 'text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="space-y-4 pt-1">
      {/* Date */}
      <div>
        <span className={labelCls}>Date</span>
        <div className="flex flex-wrap gap-2">
          <select value={s.qualifier} onChange={e => set('qualifier', e.target.value)} className={selectCls}>
            <option value="">Exact</option>
            <option value="about">About</option>
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="between">Between</option>
            <option value="estimated">Estimated</option>
            <option value="calculated">Calculated</option>
          </select>
          <input type="number" placeholder="Year" value={s.year} onChange={e => set('year', e.target.value)}
            className="w-24 text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
          <input type="number" placeholder="Mo" min={1} max={12} value={s.month} onChange={e => set('month', e.target.value)}
            className="w-16 text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
          <input type="number" placeholder="Day" min={1} max={31} value={s.day} onChange={e => set('day', e.target.value)}
            className="w-16 text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
        </div>
      </div>

      {/* Value (occupation, religion, etc.) */}
      {showValue && (
        <div>
          <label className={labelCls}>{VALUE_LABEL[factType] ?? 'Details'}</label>
          <input type="text" value={s.value} onChange={e => set('value', e.target.value)}
            placeholder="Enter details…" className={inputCls} />
        </div>
      )}

      {/* Place */}
      <div>
        <label className={labelCls}>Location</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="text" placeholder="City / Town" value={s.city} onChange={e => set('city', e.target.value)} className={inputCls} />
          <input type="text" placeholder="County" value={s.county} onChange={e => set('county', e.target.value)} className={inputCls} />
          <input type="text" placeholder="State / Province" value={s.state} onChange={e => set('state', e.target.value)} className={inputCls} />
          <input type="text" placeholder="Country" value={s.country} onChange={e => set('country', e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* Confidence */}
      <div>
        <label className={labelCls}>Confidence</label>
        <div className="flex gap-2 flex-wrap">
          {(['unverified', 'possible', 'probable', 'proven'] as ConfidenceLevel[]).map(lvl => (
            <button key={lvl} type="button" onClick={() => set('confidence', lvl)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border font-semibold capitalize transition-colors',
                s.confidence === lvl
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              )}>
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className={labelCls}>Notes</label>
        <textarea value={s.notes} onChange={e => set('notes', e.target.value)} rows={2}
          placeholder="Context, source references, caveats…"
          className="w-full text-sm bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200" />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(formToFactData(s))}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
          <Check className="w-3.5 h-3.5" /> Save Event
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 py-2 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

function FactTypePicker({ onSelect, onCancel }: { onSelect: (t: FactType) => void; onCancel: () => void }) {
  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-700">Choose Event Type</span>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="max-h-60 overflow-y-auto">
        {FACT_CATEGORIES.map(cat => (
          <div key={cat.label}>
            <div className="px-3 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50 sticky top-0">
              {cat.label}
            </div>
            {cat.types.map(type => (
              <button key={type} type="button" onClick={() => onSelect(type)}
                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors">
                {FACT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface EditFactsProps {
  facts: Fact[];
  onAdd: (fact: Omit<Fact, 'id' | 'personId' | 'createdAt' | 'updatedAt'>) => void;
  onUpdate: (factId: string, data: Partial<Fact>) => void;
  onDelete: (factId: string) => void;
}

export function EditFacts({ facts, onAdd, onUpdate, onDelete }: EditFactsProps) {
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [addingType, setAddingType]   = useState<FactType | null>(null);
  const [showPicker, setShowPicker]   = useState(false);

  const sorted = [...facts].sort((a, b) => {
    const ai = FACT_DISPLAY_ORDER.indexOf(a.type);
    const bi = FACT_DISPLAY_ORDER.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div className="space-y-2">
      {sorted.map(fact => {
        const isEditing = editingId === fact.id;
        return (
          <div key={fact.id} className={cn(
            'rounded-xl border transition-colors',
            isEditing ? 'border-primary-200 bg-primary-50/40 p-3' : 'border-gray-200 bg-white'
          )}>
            {isEditing ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-primary-700">{FACT_TYPE_LABELS[fact.type]}</span>
                  <button type="button" onClick={() => setEditingId(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <FactForm
                  factType={fact.type}
                  initial={factToForm(fact)}
                  onSave={data => { onUpdate(fact.id, data); setEditingId(null); }}
                  onCancel={() => setEditingId(null)}
                />
              </>
            ) : (
              <div className="flex items-start gap-2 p-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-700">{FACT_TYPE_LABELS[fact.type]}</div>
                  {fact.date && (
                    <div className="text-xs text-gray-500 mt-0.5">{formatPartialDate(fact.date)}</div>
                  )}
                  {fact.place && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fact.place.fullText ?? [fact.place.city, fact.place.state, fact.place.country].filter(Boolean).join(', ')}
                    </div>
                  )}
                  {fact.value && (
                    <div className="text-xs text-gray-600 mt-0.5 italic">{fact.value}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button type="button" onClick={() => { setEditingId(fact.id); setAddingType(null); setShowPicker(false); }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                    title="Edit">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button type="button"
                    onClick={() => {
                      if (confirm(`Delete this ${FACT_TYPE_LABELS[fact.type]} event?`)) {
                        onDelete(fact.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Delete">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Add event UI */}
      {showPicker ? (
        <FactTypePicker
          onSelect={type => { setAddingType(type); setShowPicker(false); setEditingId(null); }}
          onCancel={() => setShowPicker(false)}
        />
      ) : addingType ? (
        <div className="rounded-xl border border-primary-200 bg-primary-50/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-primary-700">Add {FACT_TYPE_LABELS[addingType]}</span>
            <button type="button" onClick={() => setAddingType(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <FactForm
            factType={addingType}
            initial={emptyForm()}
            onSave={data => {
              const hasPreferred = facts.some(f => f.type === addingType && f.isPreferred);
              onAdd({
                type: addingType,
                ...data,
                citationIds: [],
                isPreferred: !hasPreferred,
              } as Omit<Fact, 'id' | 'personId' | 'createdAt' | 'updatedAt'>);
              setAddingType(null);
            }}
            onCancel={() => setAddingType(null)}
          />
        </div>
      ) : (
        <button type="button" onClick={() => { setShowPicker(true); setEditingId(null); }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-primary-400 hover:text-primary-600 transition-colors text-xs font-semibold">
          <Plus className="w-3.5 h-3.5" />
          Add Life Event
        </button>
      )}
    </div>
  );
}
