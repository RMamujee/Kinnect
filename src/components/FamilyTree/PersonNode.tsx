'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { User, Search, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import type { Person } from '@/lib/types';
import { getPreferredName, formatLifespan, cn } from '@/lib/utils';

export interface PersonNodeData {
  person: Person;
  isRoot: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onSearchRecords: (id: string) => void;
}

function PersonNodeComponent({ data }: NodeProps<PersonNodeData>) {
  const { person, isRoot, isSelected, onSelect, onSearchRecords } = data;
  const name = getPreferredName(person);
  const lifespan = formatLifespan(person.birthYear, person.deathYear, person.isLiving);
  const confidence = person.gpsStatus.overallConfidence;

  const genderColor =
    person.gender === 'male'
      ? 'border-blue-300 bg-blue-50'
      : person.gender === 'female'
      ? 'border-pink-300 bg-pink-50'
      : 'border-gray-300 bg-gray-50';

  const confidenceBadge =
    confidence === 'proven' ? { icon: <CheckCircle2 className="w-3 h-3" />, color: 'text-green-500', label: 'Verified' } :
    confidence === 'probable' ? { icon: <Shield className="w-3 h-3" />, color: 'text-blue-400', label: 'Sourced' } :
    confidence === 'possible' ? { icon: <Shield className="w-3 h-3" />, color: 'text-yellow-500', label: 'Partial' } :
    { icon: <AlertCircle className="w-3 h-3" />, color: 'text-gray-400', label: 'Unverified' };

  return (
    <>
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-2 !h-2" />

      <div
        onClick={() => onSelect(person.id)}
        className={cn(
          'w-44 rounded-xl border-2 p-3 cursor-pointer transition-all select-none',
          genderColor,
          isSelected && 'ring-2 ring-primary-500 ring-offset-2',
          isRoot && 'shadow-lg',
          'hover:shadow-md'
        )}
      >
        {/* Avatar */}
        <div className="flex items-start gap-2">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
            person.gender === 'male' ? 'bg-blue-200' : person.gender === 'female' ? 'bg-pink-200' : 'bg-gray-200'
          )}>
            {person.profileImageUrl ? (
              <img src={person.profileImageUrl} alt={name} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-gray-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate leading-tight">{name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{lifespan}</p>
            {person.birthPlace && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{person.birthPlace}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
          <div className={cn('flex items-center gap-1', confidenceBadge.color)}>
            {confidenceBadge.icon}
            <span className="text-xs font-medium">{confidenceBadge.label}</span>
          </div>

          {isRoot && (
            <span className="text-xs bg-primary-600 text-white px-1.5 py-0.5 rounded-full font-medium">You</span>
          )}

          <button
            onClick={e => { e.stopPropagation(); onSearchRecords(person.id); }}
            className="text-gray-400 hover:text-primary-600 transition-colors"
            title="Search public records"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>

        {(person.autoPopulated || person.wikiTreeId) && (
          <div className="mt-1 text-xs text-center text-primary-600 font-medium bg-primary-50 rounded-md py-0.5">
            {person.wikiTreeId ? `WT: ${person.wikiTreeId}` : 'Auto-found'}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-400 !w-2 !h-2" />
    </>
  );
}

export const PersonNode = memo(PersonNodeComponent);
