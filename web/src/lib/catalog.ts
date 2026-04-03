import type { ElementCatalogFile, ElementCategory, RandomElementDefinition } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isCategory(raw: unknown): raw is ElementCategory {
  if (!isRecord(raw)) return false;
  return typeof raw.id === "string" && typeof raw.title === "string";
}

function isSegment(raw: unknown): boolean {
  if (!isRecord(raw)) return false;
  if (raw.kind === "literal") {
    return typeof raw.text === "string";
  }
  if (raw.kind === "digits") {
    return (
      typeof raw.count === "number" &&
      typeof raw.min === "number" &&
      typeof raw.max === "number"
    );
  }
  if (raw.kind === "date_ymd") {
    return typeof raw.yearMin === "number" && typeof raw.yearMax === "number";
  }
  return false;
}

function isDefinition(raw: unknown, validCategoryIds: ReadonlySet<string>): raw is RandomElementDefinition {
  if (!isRecord(raw)) return false;
  if (typeof raw.id !== "string" || typeof raw.title !== "string") return false;
  if (typeof raw.categoryId !== "string" || !validCategoryIds.has(raw.categoryId)) return false;
  if (!Array.isArray(raw.segments) || raw.segments.length === 0) return false;
  return raw.segments.every(isSegment);
}

export function parseElementCatalog(data: unknown): ElementCatalogFile {
  if (!isRecord(data)) throw new Error("Catalog must be an object.");
  if (typeof data.version !== "number") throw new Error("Catalog missing numeric version.");
  if (!Array.isArray(data.categories) || data.categories.length === 0) {
    throw new Error('Catalog must include a non-empty "categories" array.');
  }
  if (!data.categories.every(isCategory)) {
    throw new Error("Catalog has invalid category entries (need id + title strings).");
  }

  const categories = data.categories as ElementCategory[];
  const categoryIds = new Set(categories.map((c) => c.id));
  if (categoryIds.size !== categories.length) {
    throw new Error("Catalog category ids must be unique.");
  }

  if (!Array.isArray(data.elements)) throw new Error("Catalog missing elements array.");
  if (!data.elements.every((el) => isDefinition(el, categoryIds))) {
    throw new Error(
      'Catalog has invalid elements: each needs id, categoryId (existing category), title, and segments.',
    );
  }

  return data as unknown as ElementCatalogFile;
}
