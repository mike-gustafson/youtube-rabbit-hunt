export type PatternSegmentKind = "literal" | "digits" | "date_ymd";

export interface PatternSegment {
  kind: PatternSegmentKind;
  text?: string;
  count?: number;
  min?: number;
  max?: number;
  padZeros?: boolean;
  /** When `kind === "date_ymd"`: inclusive Gregorian year bounds; emits random valid YYYYMMDD. */
  yearMin?: number;
  yearMax?: number;
}

/** Declares a bucket users can pick for random rolls (e.g. webcams, body cameras). */
export interface ElementCategory {
  id: string;
  title: string;
}

export interface RandomElementDefinition {
  id: string;
  /** References `ElementCategory.id` from the same file. */
  categoryId: string;
  title: string;
  segments: PatternSegment[];
}

/**
 * Single source of truth: ship updates by editing this JSON (hundreds of `elements` is fine).
 * - `categories`: group labels shown in the UI.
 * - `elements`: each pattern belongs to exactly one category via `categoryId`.
 */
export interface ElementCatalogFile {
  version: number;
  categories: ElementCategory[];
  elements: RandomElementDefinition[];
}
