'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TreePine, Users, Plus, Download, Upload, Menu, X } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { FamilyTreeView } from '@/components/FamilyTree/FamilyTreeView';
import { PersonDetailPanel } from '@/components/PersonDetail/PersonDetailPanel';
import { AutoBuildBanner } from '@/components/FamilyTree/AutoBuildBanner';
import { cn, getPreferredName, formatLifespan } from '@/lib/utils';

export default function TreePage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchRecordsPersonId, setSearchRecordsPersonId] = useState<string | null>(null);

  const {
    persons,
    selectedPersonId,
    setSelectedPerson,
    rootPersonId,
    onboardingComplete,
  } = useGenealogyStore(s => ({
    persons: s.persons,
    selectedPersonId: s.selectedPersonId,
    setSelectedPerson: s.setSelectedPerson,
    rootPersonId: s.rootPersonId,
    onboardingComplete: s.onboardingComplete,
  }));

  const handleSearchRecords = useCallback((personId: string) => {
    setSelectedPerson(personId);
    setSearchRecordsPersonId(personId);
  }, [setSelectedPerson]);

  if (!onboardingComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ancestry-cream">
        <div className="text-center">
          <TreePine className="w-12 h-12 text-primary-600 mx-auto mb-4" />
          <h2 className="text-xl font-serif font-bold text-gray-900 mb-2">No family tree yet</h2>
          <p className="text-gray-500 text-sm mb-6">Complete the onboarding to build your tree.</p>
          <button
            onClick={() => router.push('/onboarding')}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
          >
            Get Started
          </button>
        </div>
      </div>
    );
  }

  const personCount = Object.keys(persons).length;

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top nav */}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 z-20 flex-shrink-0">
        <div className="flex items-center gap-2">
          <TreePine className="w-5 h-5 text-primary-600" />
          <span className="font-serif font-bold text-gray-900 text-sm">AncestryProject</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Users className="w-3.5 h-3.5" />
          <span>{personCount} person{personCount !== 1 ? 's' : ''}</span>
        </div>

        <button
          className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
          onClick={() => router.push('/onboarding')}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Person
        </button>

        <button
          onClick={() => setSidebarOpen(s => !s)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          title="Toggle sidebar"
        >
          {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — person list */}
        {sidebarOpen && (
          <aside className="w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden flex-shrink-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Family Members</h3>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {Object.values(persons).map(person => (
                <button
                  key={person.id}
                  onClick={() => setSelectedPerson(person.id)}
                  className={cn(
                    'w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50',
                    selectedPersonId === person.id && 'bg-primary-50 border-l-2 border-l-primary-500'
                  )}
                >
                  <div className="text-xs font-semibold text-gray-900 truncate">
                    {getPreferredName(person)}
                  </div>
                  <div className="text-xs text-gray-400">
                    {formatLifespan(person.birthYear, person.deathYear, person.isLiving)}
                  </div>
                  {person.id === rootPersonId && (
                    <span className="text-xs text-primary-600 font-medium">Root</span>
                  )}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Tree canvas */}
        <div className="flex-1 relative overflow-hidden">
          <FamilyTreeView onSearchRecords={handleSearchRecords} />
          <AutoBuildBanner />
        </div>

        {/* Right panel — person detail */}
        {selectedPersonId && (
          <PersonDetailPanel
            personId={selectedPersonId}
            onClose={() => setSelectedPerson(null)}
          />
        )}
      </div>
    </div>
  );
}
