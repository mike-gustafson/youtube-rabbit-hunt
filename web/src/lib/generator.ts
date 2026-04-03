import { randomDateYmd } from "./dateYmd";
import type { ElementCatalogFile, RandomElementDefinition } from "./types";

function randomIntInclusive(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class GeneratorError extends Error {
  constructor(
    message: string,
    readonly definition?: RandomElementDefinition,
  ) {
    super(message);
    this.name = "GeneratorError";
  }
}

export function generateTerm(definition: RandomElementDefinition): string {
  const parts: string[] = [];

  for (const segment of definition.segments) {
    if (segment.kind === "literal") {
      const text = segment.text;
      if (text === undefined) throw new GeneratorError(`Invalid pattern: ${definition.title}`, definition);
      parts.push(text);
      continue;
    }

    if (segment.kind === "date_ymd") {
      const y0 = segment.yearMin;
      const y1 = segment.yearMax;
      if (y0 === undefined || y1 === undefined || y0 > y1) {
        throw new GeneratorError(`Invalid pattern: ${definition.title}`, definition);
      }
      parts.push(randomDateYmd(y0, y1));
      continue;
    }

    const count = segment.count;
    const min = segment.min;
    const max = segment.max;
    if (
      count === undefined ||
      count <= 0 ||
      min === undefined ||
      max === undefined ||
      min > max
    ) {
      throw new GeneratorError(`Invalid pattern: ${definition.title}`, definition);
    }

    const value = randomIntInclusive(min, max);
    const pad = segment.padZeros ?? false;
    parts.push(pad ? String(value).padStart(count, "0") : String(value));
  }

  return parts.join("");
}

/**
 * Patterns in any of `selectedCategoryIds`, optionally narrowed to `selectedPatternIds`.
 * If `selectedPatternIds` is empty, every pattern in those categories is eligible.
 */
export function eligibleElements(
  catalog: ElementCatalogFile,
  selectedCategoryIds: ReadonlySet<string>,
  selectedPatternIds: ReadonlySet<string>,
): RandomElementDefinition[] {
  const inCategory = catalog.elements.filter((e) => selectedCategoryIds.has(e.categoryId));
  if (selectedPatternIds.size === 0) return inCategory;
  return inCategory.filter((e) => selectedPatternIds.has(e.id));
}

export function generateFromSelection(
  catalog: ElementCatalogFile,
  selectedCategoryIds: ReadonlySet<string>,
  selectedPatternIds: ReadonlySet<string>,
): { definition: RandomElementDefinition; term: string } {
  if (selectedCategoryIds.size === 0) {
    throw new GeneratorError("Select at least one category.");
  }
  const pool = eligibleElements(catalog, selectedCategoryIds, selectedPatternIds);
  if (pool.length === 0) {
    throw new GeneratorError("No patterns match your category and pattern filters.");
  }
  const definition = pool[randomIntInclusive(0, pool.length - 1)]!;
  const term = generateTerm(definition);
  return { definition, term };
}
