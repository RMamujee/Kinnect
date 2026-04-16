'use client';

import { TreePine } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-ancestry-cream flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center animate-pulse-slow shadow-lg">
          <TreePine className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Loading your tree…</p>
      </div>
    </div>
  );
}
