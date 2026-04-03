import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import catalogJson from "@shared/element_catalog.json";
import { parseElementCatalog } from "./lib/catalog";
import type { ElementCatalogFile, RandomElementDefinition } from "./lib/types";
import { eligibleElements, generateFromSelection, GeneratorError } from "./lib/generator";
import { youtubeResultsUrl } from "./lib/youtube";

function DiceIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <circle cx="9" cy="9" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

type CatalogState =
  | { ok: true; catalog: ElementCatalogFile }
  | { ok: false; error: string };

export default function App() {
  const catalogState = useMemo((): CatalogState => {
    try {
      const parsed = parseElementCatalog(catalogJson);
      return { ok: true, catalog: parsed };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Invalid catalog.",
      };
    }
  }, []);

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => new Set());
  const [selectedPatterns, setSelectedPatterns] = useState<Set<string>>(() => new Set());
  const [lastTitle, setLastTitle] = useState<string | null>(null);
  const [lastTerm, setLastTerm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);

  const hasCatalog = catalogState.ok && catalogState.catalog.elements.length > 0;

  const visiblePatternIds = useMemo(() => {
    if (!catalogState.ok) return new Set<string>();
    const ids = new Set<string>();
    for (const el of catalogState.catalog.elements) {
      if (selectedCategories.has(el.categoryId)) ids.add(el.id);
    }
    return ids;
  }, [catalogState, selectedCategories]);

  const visiblePatterns: RandomElementDefinition[] = useMemo(() => {
    if (!catalogState.ok) return [];
    return catalogState.catalog.elements.filter((e) => visiblePatternIds.has(e.id));
  }, [catalogState, visiblePatternIds]);

  const rollPoolSize = useMemo(() => {
    if (!catalogState.ok || selectedCategories.size === 0) return 0;
    return eligibleElements(catalogState.catalog, selectedCategories, selectedPatterns).length;
  }, [catalogState, selectedCategories, selectedPatterns]);

  /** Whenever categories change, include every pattern from those categories (default: all on). */
  useLayoutEffect(() => {
    if (!catalogState.ok || selectedCategories.size === 0) {
      setSelectedPatterns(new Set());
      return;
    }
    setSelectedPatterns(
      new Set(
        catalogState.catalog.elements
          .filter((e) => selectedCategories.has(e.categoryId))
          .map((e) => e.id),
      ),
    );
  }, [catalogState, selectedCategories]);

  function toggleCategory(id: string) {
    setSelectedCategories((prevCats) => {
      const nextCats = new Set(prevCats);
      if (nextCats.has(id)) nextCats.delete(id);
      else nextCats.add(id);
      return nextCats;
    });
  }

  function togglePattern(id: string) {
    setSelectedPatterns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisiblePatterns() {
    setSelectedPatterns((prev) => new Set([...prev, ...visiblePatternIds]));
  }

  function resetPatternsToDefaults() {
    if (!catalogState.ok || selectedCategories.size === 0) return;
    setSelectedPatterns(
      new Set(
        catalogState.catalog.elements
          .filter((e) => selectedCategories.has(e.categoryId))
          .map((e) => e.id),
      ),
    );
  }

  const allVisibleSelected =
    visiblePatternIds.size > 0 && [...visiblePatternIds].every((id) => selectedPatterns.has(id));

  const performRoll = useCallback(() => {
    setCopied(false);
    if (!catalogState.ok) {
      setLastTerm(null);
      setLastTitle(null);
      setError(catalogState.error);
      return;
    }
    if (!catalogState.catalog.elements.length) {
      setLastTerm(null);
      setLastTitle(null);
      setError("No patterns loaded.");
      return;
    }
    if (selectedCategories.size === 0) {
      setLastTerm(null);
      setLastTitle(null);
      setError(null);
      return;
    }
    try {
      const { definition, term } = generateFromSelection(
        catalogState.catalog,
        selectedCategories,
        selectedPatterns,
      );
      setLastTitle(definition.title);
      setLastTerm(term);
      setError(null);
    } catch (e) {
      setLastTerm(null);
      setLastTitle(null);
      if (e instanceof GeneratorError) setError(e.message);
      else setError("Could not generate a search term.");
    }
  }, [catalogState, selectedCategories, selectedPatterns]);

  useEffect(() => {
    performRoll();
  }, [performRoll]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (categoryDropdownRef.current?.contains(e.target as Node)) return;
      setCategoryMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [categoryMenuOpen]);

  useEffect(() => {
    if (!categoryMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCategoryMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [categoryMenuOpen]);

  const categoryTriggerLabel = useMemo(() => {
    if (!catalogState.ok) return "Categories";
    if (selectedCategories.size === 0) return "Choose categories…";
    const labels = catalogState.catalog.categories
      .filter((c) => selectedCategories.has(c.id))
      .map((c) => c.title);
    if (labels.length <= 2) return labels.join(" · ");
    return `${labels.length} categories selected`;
  }, [catalogState, selectedCategories]);

  async function copyTerm() {
    if (!lastTerm) return;
    try {
      await navigator.clipboard.writeText(lastTerm);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Copy failed — your browser may block clipboard access.");
    }
  }

  function openYouTube() {
    if (!lastTerm) return;
    window.open(youtubeResultsUrl(lastTerm), "_blank", "noopener,noreferrer");
  }

  const patternHint =
    selectedCategories.size === 0
      ? "Choose categories first. Every matching pattern is included until you exclude some below."
      : allVisibleSelected
        ? `All ${visiblePatterns.length} pattern(s) in your categories are active. Tap a row to exclude it.`
        : `${selectedPatterns.size} of ${visiblePatterns.length} pattern(s) active.`;

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">YouTube Rabbit Hunt</h1>
        <p className="subtitle">
          Patterns live in one JSON file per release. Pick categories and optional pattern filters — the search
          term updates as you go. Use the dice button for another random pick from the same selection.
        </p>
      </header>

      {!catalogState.ok && (
        <p className="banner error" role="alert">
          {catalogState.error}
        </p>
      )}

      <section className="panel panel--overflow-visible" aria-labelledby="categories-heading">
        <div className="panel-head">
          <h2 id="categories-heading" className="panel-title">
            Categories
          </h2>
          {catalogState.ok ? (
            <span className="meta">{catalogState.catalog.categories.length} groups</span>
          ) : null}
        </div>
        {!hasCatalog ? (
          <p className="empty">{catalogState.ok ? "No data." : "Fix the catalog JSON to continue."}</p>
        ) : (
          <div className="dropdown" ref={categoryDropdownRef}>
            <button
              type="button"
              className="dropdown-trigger"
              aria-expanded={categoryMenuOpen}
              aria-haspopup="dialog"
              aria-controls="category-menu"
              id="category-trigger"
              onClick={() => setCategoryMenuOpen((o) => !o)}
            >
              <span className="dropdown-trigger-text">{categoryTriggerLabel}</span>
              <span className="dropdown-chevron" aria-hidden>
                {categoryMenuOpen ? "▴" : "▾"}
              </span>
            </button>
            {categoryMenuOpen ? (
              <div
                className="dropdown-panel"
                id="category-menu"
                role="group"
                aria-labelledby="category-trigger"
              >
                <p className="dropdown-hint">Tap to toggle. Selections combine (OR).</p>
                <div className="toggle-grid">
                  {catalogState.catalog.categories.map((cat) => {
                    const on = selectedCategories.has(cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`toggle-pill ${on ? "is-selected" : ""}`}
                        aria-pressed={on}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        <span className="toggle-pill-title">{cat.title}</span>
                        <span className="toggle-pill-id">{cat.id}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {(hasCatalog && selectedCategories.size > 0 && rollPoolSize > 0) || lastTerm ? (
        <section
          className={`result result-with-reroll${lastTerm ? "" : " result-with-reroll--compact"}`}
          aria-live="polite"
        >
          <div className="result-body">
            {lastTitle ? <p className="result-label">{lastTitle}</p> : null}
            {lastTerm ? (
              <p className="result-term" tabIndex={0}>
                {lastTerm}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="btn primary btn-roll-stack result-reroll"
            disabled={!hasCatalog || selectedCategories.size === 0 || rollPoolSize === 0}
            onClick={performRoll}
            aria-label="Roll — pick another random search term"
            title="Pick another random term from your current categories and patterns"
          >
            <DiceIcon />
            <span className="btn-roll-label">roll</span>
          </button>
        </section>
      ) : null}

      <div className="actions">
        <button type="button" className="btn" disabled={!lastTerm} onClick={copyTerm}>
          {copied ? "Copied" : "Copy term"}
        </button>
        <button type="button" className="btn" disabled={!lastTerm} onClick={openYouTube}>
          Open YouTube
        </button>
      </div>

      <section className="panel" aria-labelledby="patterns-heading">
        <div className="panel-head patterns-panel-head">
          <div className="patterns-panel-head-row">
            <button
              type="button"
              className="patterns-collapse-toggle"
              aria-expanded={patternsOpen}
              aria-controls="patterns-panel-content"
              disabled={!hasCatalog}
              onClick={() => setPatternsOpen((o) => !o)}
            >
              <span className="patterns-chevron" aria-hidden>
                {patternsOpen ? "▾" : "▸"}
              </span>
              <span id="patterns-heading" className="panel-title">
                Patterns
              </span>
            </button>
            {selectedCategories.size > 0 && visiblePatterns.length > 0 ? (
              <div className="panel-inline-actions" role="group" aria-label="Pattern selection shortcuts">
                <button
                  type="button"
                  className="text-btn"
                  onClick={selectAllVisiblePatterns}
                  disabled={allVisibleSelected}
                >
                  Select all
                </button>
                <span className="panel-inline-sep" aria-hidden="true" />
                <button
                  type="button"
                  className="text-btn"
                  onClick={resetPatternsToDefaults}
                  disabled={allVisibleSelected}
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>
          {catalogState.ok ? (
            <span className="meta">
              v{catalogState.catalog.version} · {catalogState.catalog.elements.length} total
              {selectedCategories.size > 0 && visiblePatterns.length > 0
                ? ` · ${visiblePatterns.length} in scope`
                : ""}
            </span>
          ) : null}
        </div>
        {patternsOpen ? (
          <div id="patterns-panel-content">
            <p className="panel-hint">{patternHint}</p>
            {!hasCatalog ? (
              <p className="empty">—</p>
            ) : selectedCategories.size === 0 ? (
              <p className="empty">Choose at least one category to list patterns.</p>
            ) : (
              <ul className="pattern-list">
                {visiblePatterns.map((el) => {
                  const on = selectedPatterns.has(el.id);
                  return (
                    <li key={el.id}>
                      <button
                        type="button"
                        className={`toggle-row ${on ? "is-selected" : ""}`}
                        aria-pressed={on}
                        onClick={() => togglePattern(el.id)}
                      >
                        <span className="pattern-body">
                          <span className="pattern-title">{el.title}</span>
                          <span className="pattern-id">
                            {el.id} · {el.categoryId}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      {error && (
        <p className="banner error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
