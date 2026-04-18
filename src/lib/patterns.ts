/**
 * src/lib/patterns.ts — helpers for the convergence dashboard.
 *
 * Joins the patterns collection (registry of agentic-coding patterns)
 * with the changelog collection (per-tool version timelines) to answer
 * the two questions the dashboard surfaces:
 *
 *   1. For a given pattern, which tools adopted it and when?
 *   2. What is the set of tracked patterns, in a stable display order?
 *
 * Neither file format stores the join directly; these helpers compute
 * it lazily at build time so new tool/version rows require no code
 * changes.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import {
  toolSlugs,
  patternCategories,
  changeKinds,
} from '../content.config';

export type PatternEntry = CollectionEntry<'patterns'>;
export type ToolSlug = (typeof toolSlugs)[number];
export type PatternCategory = (typeof patternCategories)[number];
export type ChangeKind = (typeof changeKinds)[number];

export interface TimelineEntry {
  tool: ToolSlug;
  version: string;
  date: Date;
  kind: ChangeKind;
  note: string;
  sourceKey?: string;
}

/**
 * Per-pattern timeline: every (tool, version, change) triple where
 * change.pattern === slug, sorted by date ascending. A pattern that no
 * tool has adopted yet returns an empty array.
 */
export async function getPatternTimeline(slug: string): Promise<TimelineEntry[]> {
  const tools = await getCollection('changelog');
  const out: TimelineEntry[] = [];
  for (const entry of tools) {
    const tool = entry.data.tool;
    for (const v of entry.data.versions) {
      for (const change of v.changes) {
        if (change.pattern !== slug) continue;
        out.push({
          tool,
          version: v.version,
          date: v.date,
          kind: change.kind,
          note: change.note,
          sourceKey: change.source_key,
        });
      }
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out;
}

/**
 * All patterns in stable display order: converged patterns first (by
 * convergence_date ascending — oldest convergence first), then
 * unconverged patterns (by slug). Within each bucket, preserves
 * manifest order.
 */
export async function getAllPatterns(): Promise<PatternEntry[]> {
  const all = await getCollection('patterns');
  return all.sort((a, b) => {
    const aDate = a.data.convergence_date?.getTime();
    const bDate = b.data.convergence_date?.getTime();
    if (aDate != null && bDate != null) return aDate - bDate;
    if (aDate != null) return -1;
    if (bDate != null) return 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Patterns grouped by category; categories that have no patterns are
 * still emitted with an empty array so the dashboard can render
 * honest "no patterns yet" placeholders without checking undefined.
 */
export async function getPatternsByCategory(): Promise<
  Record<PatternCategory, PatternEntry[]>
> {
  const all = await getAllPatterns();
  const grouped = Object.fromEntries(
    patternCategories.map((c) => [c, [] as PatternEntry[]]),
  ) as Record<PatternCategory, PatternEntry[]>;
  for (const p of all) {
    const cat = p.data.category ?? 'other';
    grouped[cat].push(p);
  }
  return grouped;
}

/** Human-readable labels per category. */
export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  safety: 'Safety',
  scale: 'Scale',
  context: 'Context',
  interaction: 'Interaction',
  extension: 'Extension',
  other: 'Other',
};

/**
 * Which tools have adopted a given pattern (deduplicated). Helpful
 * for computing "adopted by N of 3 tools" summary counts.
 */
export function toolsInTimeline(timeline: TimelineEntry[]): ToolSlug[] {
  const seen = new Set<ToolSlug>();
  for (const e of timeline) seen.add(e.tool);
  return Array.from(seen);
}

/** Fixed display order for tool rows on the timeline. 'cross-tool' is
 * excluded because a pattern is something tools adopt individually. */
export const TIMELINE_TOOL_ORDER: ToolSlug[] = [
  'claude-code',
  'gemini-cli',
  'codex-cli',
];
