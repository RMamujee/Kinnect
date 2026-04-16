'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, CheckCircle2, TreePine } from 'lucide-react';
import type { OnboardingData, OnboardingPersonInput } from '@/lib/types';
import { useGenealogyStore } from '@/store/genealogyStore';
import { SelfStep } from './steps/SelfStep';
import { ParentsStep } from './steps/ParentsStep';
import { SiblingsChildrenStep } from './steps/SiblingsChildrenStep';
import { cn } from '@/lib/utils';

const STEPS = [
  { id: 'self',    label: 'Yourself',         icon: '👤' },
  { id: 'parents', label: 'Parents & Grandparents', icon: '👨‍👩‍👦' },
  { id: 'family',  label: 'Spouse & Siblings', icon: '👪' },
  { id: 'review',  label: 'Review',            icon: '✅' },
];

const defaultSelf: OnboardingPersonInput = {
  given: '', surname: '', gender: 'unknown', isLiving: true,
};

export function OnboardingForm() {
  const router = useRouter();
  const completeOnboarding = useGenealogyStore(s => s.completeOnboarding);

  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingData>({
    self: defaultSelf,
    siblings: [],
    children: [],
  });

  const canProceed = step === 0 ? (data.self.given.trim().length > 0 && data.self.surname.trim().length > 0) : true;

  function handleSubmit() {
    completeOnboarding(data);
    router.push('/tree');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-ancestry-cream via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TreePine className="w-8 h-8 text-primary-600" />
            <h1 className="text-3xl font-serif font-bold text-gray-900">Kinnect</h1>
          </div>
          <p className="text-gray-500 text-sm">Build your verified family tree, one generation at a time.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center mb-8 gap-0">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                  i === step
                    ? 'bg-primary-600 text-white shadow-md'
                    : i < step
                    ? 'bg-green-100 text-green-700 cursor-pointer hover:bg-green-200'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight className="w-4 h-4 text-gray-300 mx-1" />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-8 animate-fade-in">
          {step === 0 && (
            <SelfStep value={data.self} onChange={v => setData(d => ({ ...d, self: v }))} />
          )}

          {step === 1 && (
            <ParentsStep
              father={data.father}
              mother={data.mother}
              paternalGrandfather={data.paternalGrandfather}
              paternalGrandmother={data.paternalGrandmother}
              maternalGrandfather={data.maternalGrandfather}
              maternalGrandmother={data.maternalGrandmother}
              onChangeFather={v => setData(d => ({ ...d, father: v }))}
              onChangeMother={v => setData(d => ({ ...d, mother: v }))}
              onChangePaternalGF={v => setData(d => ({ ...d, paternalGrandfather: v }))}
              onChangePaternalGM={v => setData(d => ({ ...d, paternalGrandmother: v }))}
              onChangeMaternalGF={v => setData(d => ({ ...d, maternalGrandfather: v }))}
              onChangeMaternalGM={v => setData(d => ({ ...d, maternalGrandmother: v }))}
            />
          )}

          {step === 2 && (
            <SiblingsChildrenStep
              siblings={data.siblings}
              children={data.children}
              spouse={data.spouse}
              onChangeSiblings={v => setData(d => ({ ...d, siblings: v }))}
              onChangeChildren={v => setData(d => ({ ...d, children: v }))}
              onChangeSpouse={v => setData(d => ({ ...d, spouse: v }))}
            />
          )}

          {step === 3 && (
            <ReviewStep data={data} />
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Build My Tree
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ data }: { data: OnboardingData }) {
  const personCount = [
    data.self,
    data.father,
    data.mother,
    data.paternalGrandfather,
    data.paternalGrandmother,
    data.maternalGrandfather,
    data.maternalGrandmother,
    data.spouse,
    ...data.siblings,
    ...data.children,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Ready to build your tree</h2>
        <p className="mt-1 text-sm text-gray-500">
          We'll create your initial tree with the information you've provided, then automatically search
          public records to expand it.
        </p>
      </div>
      <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 space-y-3">
        <SummaryRow label="Your name" value={`${data.self.given} ${data.self.surname}`} />
        {data.self.birthYear && <SummaryRow label="Birth year" value={String(data.self.birthYear)} />}
        <SummaryRow label="People added" value={String(personCount)} />
        <SummaryRow label="Generations" value={data.paternalGrandfather || data.maternalGrandfather ? '3' : data.father || data.mother ? '2' : '1'} />
      </div>
      <div className="rounded-xl bg-green-50 border border-green-100 p-4">
        <p className="text-sm text-green-700 font-medium">✓ After creating your tree, we'll automatically search:</p>
        <ul className="mt-2 text-xs text-green-600 space-y-1 list-disc list-inside">
          <li>FamilySearch — world's largest free genealogy database</li>
          <li>WikiTree — open collaborative family tree</li>
          <li>Find A Grave — millions of grave memorials</li>
          <li>US Census records (1790–1940)</li>
        </ul>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
