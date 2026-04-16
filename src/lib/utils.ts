import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { v4 as uuidv4 } from 'uuid';
import type { PartialDate, ConfidenceLevel, GPSStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return uuidv4();
}

export function formatPartialDate(date?: PartialDate): string {
  if (!date) return 'Unknown';
  if (date.displayText) return date.displayText;

  const parts: string[] = [];
  const qualifier = date.qualifier;

  if (qualifier === 'about') parts.push('abt.');
  else if (qualifier === 'before') parts.push('bef.');
  else if (qualifier === 'after') parts.push('aft.');
  else if (qualifier === 'calculated') parts.push('cal.');
  else if (qualifier === 'estimated') parts.push('est.');

  if (qualifier === 'between' && date.year && date.year2) {
    return `bet. ${date.year}–${date.year2}`;
  }

  if (date.day && date.month && date.year) {
    const d = new Date(date.year, date.month - 1, date.day);
    parts.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }));
  } else if (date.month && date.year) {
    const d = new Date(date.year, date.month - 1, 1);
    parts.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  } else if (date.year) {
    parts.push(String(date.year));
  }

  return parts.join(' ') || 'Unknown';
}

export function formatLifespan(birthYear?: number, deathYear?: number, isLiving?: boolean): string {
  if (isLiving) return birthYear ? `b. ${birthYear}` : 'Living';
  const birth = birthYear ? String(birthYear) : '?';
  const death = deathYear ? String(deathYear) : '?';
  return `${birth} – ${death}`;
}

export function getPreferredName(person: { names: Array<{ isPreferred: boolean; given: string; surname: string }> }): string {
  const preferred = person.names.find(n => n.isPreferred) ?? person.names[0];
  if (!preferred) return 'Unknown';
  return `${preferred.given} ${preferred.surname}`.trim();
}

export function confidenceColor(level: ConfidenceLevel): string {
  const map: Record<ConfidenceLevel, string> = {
    proven: 'text-green-600 bg-green-50 border-green-200',
    probable: 'text-blue-600 bg-blue-50 border-blue-200',
    possible: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    unverified: 'text-gray-500 bg-gray-50 border-gray-200',
    conflicting: 'text-red-600 bg-red-50 border-red-200',
  };
  return map[level];
}

export function confidenceLabel(level: ConfidenceLevel): string {
  const map: Record<ConfidenceLevel, string> = {
    proven: 'Proven',
    probable: 'Probable',
    possible: 'Possible',
    unverified: 'Unverified',
    conflicting: 'Conflicting',
  };
  return map[level];
}

export function gpsScore(status: GPSStatus): number {
  let score = 0;
  if (status.searchCompleted) score += 20;
  if (status.allFactsCited && status.citationCount > 0) score += 20;
  if (status.sourcesAnalyzed) score += 20;
  if (status.conflictsResolved && status.unresolvedConflicts === 0) score += 20;
  if (status.conclusionWritten) score += 20;
  return score;
}

export function gpsScoreLabel(score: number): string {
  if (score >= 80) return 'GPS Compliant';
  if (score >= 60) return 'Nearly GPS';
  if (score >= 40) return 'Partially Documented';
  if (score >= 20) return 'Minimally Documented';
  return 'Undocumented';
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseNameString(fullName: string): { given: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { given: '', surname: '' };
  if (parts.length === 1) return { given: parts[0], surname: '' };
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return { given, surname };
}
