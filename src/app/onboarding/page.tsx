'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGenealogyStore } from '@/store/genealogyStore';
import { useHydration } from '@/store/useHydration';
import { LoadingScreen } from '@/components/UI/LoadingScreen';
import { OnboardingForm } from '@/components/Onboarding/OnboardingForm';

export default function OnboardingPage() {
  const router = useRouter();
  const hydrated = useHydration();
  const onboardingComplete = useGenealogyStore(s => s.onboardingComplete);

  useEffect(() => {
    if (hydrated && onboardingComplete) {
      router.replace('/tree');
    }
  }, [hydrated, onboardingComplete, router]);

  if (!hydrated) return <LoadingScreen />;
  if (onboardingComplete) return <LoadingScreen />; // redirect in flight

  return <OnboardingForm />;
}
