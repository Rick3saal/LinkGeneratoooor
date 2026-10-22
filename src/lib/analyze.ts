import { buildAaLink, type BuiltLink } from './aaLink';
import { passengerChecks, segmentChecks } from './checks';
import { planSlices, type SlicePlan } from './slices';
import type { AirportLookup, BuildOptions, Issue, IssueLevel, Segment } from './types';

export interface AnalysisContext {
  lookup: AirportLookup;
  thresholdHours: number;
  now?: Date;
  /** Issues produced by the text parser (document level). */
  parseIssues?: Issue[];
}

export interface Analysis {
  plan: SlicePlan;
  link: BuiltLink;
  issues: Issue[];
  counts: Record<IssueLevel, number>;
  canBuild: boolean;
}

const LEVEL_ORDER: Record<IssueLevel, number> = { error: 0, warning: 1, info: 2 };

/**
 * One pass over the itinerary: absolute times → slices → validation → link.
 * The UI only ever needs this object.
 */
export function analyze(
  segments: Segment[],
  options: BuildOptions,
  ctx: AnalysisContext,
): Analysis {
  const plan = planSlices(segments, {
    lookup: ctx.lookup,
    thresholdHours: ctx.thresholdHours,
  });
  const link = buildAaLink({ items: plan.items, slices: plan.slices, options });
  const checks = [
    ...segmentChecks(segments, ctx.now ?? new Date()),
    ...passengerChecks(options.passengers),
  ];

  const seen = new Set<string>();
  const issues: Issue[] = [];
  for (const issue of [
    ...(ctx.parseIssues ?? []),
    ...checks,
    ...plan.issues,
    ...link.errors,
  ]) {
    // Segment-level issues are deduped by code (the parser, the checks and the
    // builder all report the same missing field in their own words). Document
    // level issues keep their text so several skipped lines all show up.
    const key = issue.segmentId
      ? `${issue.code}|${issue.segmentId}`
      : `${issue.code}|${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push(issue);
  }
  issues.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const counts: Record<IssueLevel, number> = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) counts[issue.level] += 1;

  return {
    plan,
    link,
    issues,
    counts,
    canBuild: link.ok && segments.length > 0,
  };
}
