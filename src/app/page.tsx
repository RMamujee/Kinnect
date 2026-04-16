'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Shield, Globe, ArrowRight, Users, FlaskConical } from 'lucide-react';
import { useGenealogyStore } from '@/store/genealogyStore';
import { useHydration } from '@/store/useHydration';
import { LoadingScreen } from '@/components/UI/LoadingScreen';
import { seedDemoData } from '@/lib/seedData';

export default function HomePage() {
  const router = useRouter();
  const hydrated = useHydration();
  const onboardingComplete = useGenealogyStore(s => s.onboardingComplete);

  useEffect(() => {
    if (!hydrated) return;
    if (onboardingComplete) {
      router.replace('/tree');
    }
  }, [hydrated, onboardingComplete, router]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-ancestry-cream via-white to-primary-50">
      {/* Hero */}
      <div className="max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="flex items-center justify-center mb-6">
          <Image src="/logo.png" alt="Kinnect" width={200} height={200} priority className="rounded-3xl" />
        </div>

        <h2 className="text-2xl md:text-3xl font-serif text-gray-800 mb-4 leading-tight">
          Build a verified family tree that<br />
          <span className="text-primary-600">grows itself.</span>
        </h2>

        <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-10">
          Enter what you know about yourself and your immediate family. We'll automatically search
          public records and expand your tree following the Genealogical Proof Standard.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => router.push('/onboarding')}
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-base font-semibold px-8 py-3.5 rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            Start Building My Tree
            <ArrowRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => { seedDemoData(); router.push('/tree'); }}
            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 text-base font-semibold px-8 py-3.5 rounded-2xl shadow-md hover:shadow-lg border border-gray-200 transition-all"
          >
            <FlaskConical className="w-5 h-5 text-primary-600" />
            Try Demo
          </button>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={<Users className="w-5 h-5 text-primary-600" />}
            title="Smart Onboarding"
            desc="Enter yourself + immediate family. We build the initial tree instantly."
          />
          <FeatureCard
            icon={<Search className="w-5 h-5 text-green-600" />}
            title="Public Records Search"
            desc="Auto-searches FamilySearch, WikiTree, Census records, and more."
          />
          <FeatureCard
            icon={<Shield className="w-5 h-5 text-blue-600" />}
            title="GPS Compliance"
            desc="Every fact tracked to source citations per the Genealogical Proof Standard."
          />
          <FeatureCard
            icon={<Globe className="w-5 h-5 text-purple-600" />}
            title="Interactive Tree"
            desc="Drag, zoom, and explore your family across multiple generations."
          />
        </div>
      </div>

      {/* GPS explanation */}
      <div className="bg-white border-t border-gray-100 py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-3">
            What is the Genealogical Proof Standard?
          </h3>
          <p className="text-gray-500 text-sm leading-relaxed mb-6">
            The GPS is a 5-element framework used by professional genealogists to ensure conclusions
            about family relationships are accurate and defensible.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-left">
            {[
              { n: '1', t: 'Exhaustive Search', d: 'All reasonably available sources consulted' },
              { n: '2', t: 'Complete Citations', d: 'Every fact backed by a full citation' },
              { n: '3', t: 'Source Analysis', d: 'Each source evaluated for reliability' },
              { n: '4', t: 'Conflict Resolution', d: 'Conflicting evidence addressed' },
              { n: '5', t: 'Written Conclusion', d: 'Reasoned argument documented' },
            ].map(step => (
              <div key={step.n} className="flex flex-col gap-1 p-3 rounded-xl bg-primary-50 border border-primary-100">
                <div className="w-6 h-6 bg-primary-600 text-white text-xs font-bold rounded-full flex items-center justify-center">{step.n}</div>
                <div className="text-xs font-semibold text-gray-800">{step.t}</div>
                <div className="text-xs text-gray-500">{step.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mb-3">{icon}</div>
      <div className="text-sm font-semibold text-gray-900 mb-1">{title}</div>
      <div className="text-xs text-gray-500 leading-relaxed">{desc}</div>
    </div>
  );
}
