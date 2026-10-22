import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '../lib/cn';
import type { Issue, IssueLevel, Segment } from '../lib/types';
import { Card, CardHead } from './ui';

const ICONS = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

const COLORS: Record<IssueLevel, string> = {
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-sky-400',
};

const RING: Record<IssueLevel, string> = {
  error: 'border-red-500/20 bg-red-500/[0.04]',
  warning: 'border-amber-500/20 bg-amber-500/[0.04]',
  info: 'border-line bg-panel-2/40',
};

export function ChecksPanel({
  issues,
  segments,
}: {
  issues: Issue[];
  segments: Segment[];
}) {
  const indexOf = (id?: string) =>
    id ? segments.findIndex((s) => s.id === id) : -1;

  return (
    <Card>
      <CardHead
        title="Checks"
        icon={<CircleCheck className="h-3.5 w-3.5" />}
        subtitle="Everything the link needs, plus what AA will quietly ignore."
        right={
          issues.length > 0 ? (
            <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-muted">
              {issues.length}
            </span>
          ) : null
        }
      />
      <div className="space-y-1.5 p-3">
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2.5">
            <CircleCheck className="h-4 w-4 text-emerald-400" />
            <div>
              <p className="text-[12px] font-medium text-emerald-200">All checks passed</p>
              <p className="text-[10.5px] text-emerald-200/60">
                Every airport resolved, every class present, the timing adds up.
              </p>
            </div>
          </div>
        ) : (
          issues.map((issue, i) => {
            const Icon = ICONS[issue.level];
            const segIndex = indexOf(issue.segmentId);
            return (
              <div
                key={`${issue.code}-${issue.segmentId ?? 'doc'}-${i}`}
                className={cn('flex items-start gap-2 rounded-lg border px-2.5 py-2', RING[issue.level])}
              >
                <Icon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', COLORS[issue.level])} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-snug text-ink/90">{issue.message}</p>
                  {issue.detail && (
                    <p className="mt-0.5 text-[10.5px] leading-snug text-faint">{issue.detail}</p>
                  )}
                </div>
                {segIndex >= 0 && (
                  <span className="mt-0.5 shrink-0 rounded border border-line-2 bg-panel-3 px-1.5 py-[1px] font-mono text-[9.5px] text-faint">
                    seg {segIndex + 1}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
