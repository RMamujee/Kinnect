'use client';

import { CheckCircle2, Circle, AlertTriangle, Info } from 'lucide-react';
import type { GPSStatus } from '@/lib/types';
import { GPS_ELEMENTS, RECOMMENDED_SOURCES, gpsScore, gpsScoreLabel } from '@/lib/gps';
import { cn } from '@/lib/utils';

interface Props {
  status: GPSStatus;
  onUpdate: (updates: Partial<GPSStatus>) => void;
}

export function GPSPanel({ status, onUpdate }: Props) {
  const score = gpsScore(status);
  const label = gpsScoreLabel(score);

  const scoreColor =
    score >= 80 ? 'text-green-600'
    : score >= 60 ? 'text-blue-600'
    : score >= 40 ? 'text-yellow-600'
    : 'text-red-500';

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200">
        <div className="text-center">
          <div className={cn('text-3xl font-bold', scoreColor)}>{score}%</div>
          <div className="text-xs text-gray-500 mt-0.5">GPS Score</div>
        </div>
        <div>
          <div className="font-semibold text-gray-800">{label}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Genealogical Proof Standard compliance
          </div>
          <div className="mt-2 h-2 w-48 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-blue-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-400')}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>
      </div>

      {/* The 5 GPS elements */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">5 GPS Elements</h4>
        {GPS_ELEMENTS.map(el => {
          const checked =
            el.id === 'search' ? status.searchCompleted :
            el.id === 'citations' ? (status.allFactsCited && status.citationCount > 0) :
            el.id === 'analysis' ? status.sourcesAnalyzed :
            el.id === 'conflicts' ? (status.conflictsResolved && status.unresolvedConflicts === 0) :
            status.conclusionWritten;

          return (
            <div key={el.id} className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-colors',
              checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            )}>
              {checked
                ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                : <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800">{el.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{el.description}</div>

                {/* Inline controls for each element */}
                {el.id === 'search' && !status.searchCompleted && (
                  <button
                    onClick={() => onUpdate({ searchCompleted: true })}
                    className="mt-2 text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Mark search as complete
                  </button>
                )}
                {el.id === 'conflicts' && status.unresolvedConflicts > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
                    <AlertTriangle className="w-3 h-3" />
                    {status.unresolvedConflicts} unresolved conflict(s)
                  </div>
                )}
                {el.id === 'conclusion' && !status.conclusionWritten && (
                  <textarea
                    placeholder="Write your reasoned conclusion here (min. 50 characters)…"
                    className="mt-2 w-full text-xs border border-gray-200 rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary-400"
                    rows={3}
                    defaultValue={status.conclusionText ?? ''}
                    onBlur={e => onUpdate({ conclusionText: e.target.value, conclusionWritten: e.target.value.length >= 50 })}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Recommended sources */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommended Sources</h4>
        <div className="space-y-1.5">
          {RECOMMENDED_SOURCES.slice(0, 5).map(s => (
            <a
              key={s.type}
              href={s.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-2 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
            >
              <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700">{s.type}</span>
              <span className="text-xs text-gray-400 group-hover:text-primary-500 truncate ml-2">{s.description.split(';')[0]}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
