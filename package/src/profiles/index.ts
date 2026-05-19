/**
 * Profile registry — single source of truth for the BOOK_PROFILE enum.
 *
 * Each profile is a self-contained module that declares its schema + routes
 * + styles via defineProfile(). The PROFILES object below is the only place
 * the toolkit looks up profile config; bookScaffoldIntegration consumes
 * PROFILES[profile] to drive injectRoute / injectScript calls.
 *
 * To add a new profile: create src/profiles/<name>.ts, then add two lines
 * here (one to PROFILES, one to ChapterFor). The discriminated union of
 * BookProfile = keyof typeof PROFILES updates automatically.
 */
import { academicProfile, type AcademicChapter } from './academic.js';
import { toolsProfile, type ToolsChapter } from './tools.js';
import { minimalProfile, type MinimalChapter } from './minimal.js';
import { courseNotesProfile, type CourseNotesChapter } from './course-notes.js';

export const PROFILES = {
  academic: academicProfile,
  tools: toolsProfile,
  minimal: minimalProfile,
  'course-notes': courseNotesProfile,
} as const;

export type BookProfile = keyof typeof PROFILES;

export const BOOK_PROFILES = Object.keys(PROFILES) as readonly BookProfile[];

/**
 * Generic chapter-shape lookup. Consumers writing helpers parametrized over
 * a profile can use this for narrowed typing:
 *
 *   function summarize<P extends BookProfile>(profile: P, chapter: ChapterFor<P>) {
 *     // chapter is narrowed to AcademicChapter / ToolsChapter / etc.
 *   }
 */
export type ChapterFor<P extends BookProfile> =
  P extends 'academic' ? AcademicChapter :
  P extends 'tools' ? ToolsChapter :
  P extends 'minimal' ? MinimalChapter :
  P extends 'course-notes' ? CourseNotesChapter :
  never;

// Re-export the inferred chapter types for consumer ergonomics.
export type { AcademicChapter, ToolsChapter, MinimalChapter, CourseNotesChapter };
