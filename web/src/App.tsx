import { useCallback, useEffect, useMemo, useState } from "react";
import catalogJson from "@shared/element_catalog.json";
import { parseElementCatalog } from "./lib/catalog";
import type { ElementCatalogFile, RandomElementDefinition } from "./lib/types";
import { eligibleElements, generateFromSelection, GeneratorError } from "./lib/generator";
import { youtubeResultsUrl } from "./lib/youtube";

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

  function toggleCategory(id: string) {
    setSelectedCategories((prevCats) => {
      const nextCats = new Set(prevCats);
      if (nextCats.has(id)) nextCats.delete(id);
      else nextCats.add(id);
      const allowed = new Set(
        catalogState.ok
          ? catalogState.catalog.elements.filter((e) => nextCats.has(e.categoryId)).map((e) => e.id)
          : [],
      );
      setSelectedPatterns((prevPat) => {
        const nextPat = new Set<string>();
        for (const pid of prevPat) {
          if (allowed.has(pid)) nextPat.add(pid);
        }
        return nextPat;
      });
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

  function clearVisiblePatterns() {
    setSelectedPatterns((prev) => {
      const next = new Set(prev);
      for (const id of visiblePatternIds) next.delete(id);
      return next;
    });
  }

  const allVisibleSelected =
    visiblePatternIds.size > 0 && [...visiblePatternIds].every((id) => selectedPatterns.has(id));
  const anyVisibleSelected = [...visiblePatternIds].some((id) => selectedPatterns.has(id));

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
      ? "Select categories to list patterns. Leave all patterns unchecked to roll across every pattern in those categories."
      : selectedPatterns.size === 0
        ? `Rolling among all ${visiblePatterns.length} pattern(s) in the selected categories.`
        : `Rolling only among ${selectedPatterns.size} selected pattern(s).`;

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">YouTube Rabbit Hunt</h1>
        <p className="subtitle">
          Patterns live in one JSON file per release. Pick categories and optional pattern filters — the search
          term updates as you go. Use Re-roll for another random pick from the same selection.
        </p>
      </header>

      {!catalogState.ok && (
        <p className="banner error" role="alert">
          {catalogState.error}
        </p>
      )}

      <section className="panel" aria-labelledby="categories-heading">
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
          <ul className="pattern-list">
            {catalogState.catalog.categories.map((cat) => {
              const checked = selectedCategories.has(cat.id);
              return (
                <li key={cat.id}>
                  <label className={`pattern-row ${checked ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={checked}
                      onChange={() => toggleCategory(cat.id)}
                    />
                    <span className="pattern-body">
                      <span className="pattern-title">{cat.title}</span>
                      <span className="pattern-id">{cat.id}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="patterns-heading">
        <div className="panel-head">
          <div className="panel-head-main">
            <h2 id="patterns-heading" className="panel-title">
              Patterns
            </h2>
            {selectedCategories.size > 0 && visiblePatterns.length > 0 ? (
              <div className="panel-inline-actions" role="group" aria-label="Select patterns in view">
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
                  onClick={clearVisiblePatterns}
                  disabled={!anyVisibleSelected}
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
          {catalogState.ok ? (
            <span className="meta">
              v{catalogState.catalog.version} · {catalogState.catalog.elements.length} total
            </span>
          ) : null}
        </div>
        <p className="panel-hint">{patternHint}</p>
        {!hasCatalog ? (
          <p className="empty">—</p>
        ) : selectedCategories.size === 0 ? (
          <p className="empty">Choose at least one category to see patterns.</p>
        ) : (
          <ul className="pattern-list">
            {visiblePatterns.map((el) => {
              const checked = selectedPatterns.has(el.id);
              return (
                <li key={el.id}>
                  <label className={`pattern-row ${checked ? "is-selected" : ""}`}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={checked}
                      onChange={() => togglePattern(el.id)}
                    />
                    <span className="pattern-body">
                      <span className="pattern-title">{el.title}</span>
                      <span className="pattern-id">
                        {el.id} · {el.categoryId}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {lastTerm && (
        <section className="result" aria-live="polite">
          {lastTitle && <p className="result-label">{lastTitle}</p>}
          <p className="result-term" tabIndex={0}>
            {lastTerm}
          </p>
        </section>
      )}

      {error && (
        <p className="banner error" role="status">
          {error}
        </p>
      )}

      <div className="actions">
        <button
          type="button"
          className="btn primary"
          disabled={!hasCatalog || selectedCategories.size === 0 || rollPoolSize === 0}
          onClick={performRoll}
          title="Pick another random term from your current categories and patterns"
        >
          Re-roll
        </button>
        <button type="button" className="btn" disabled={!lastTerm} onClick={copyTerm}>
          {copied ? "Copied" : "Copy term"}
        </button>
        <button type="button" className="btn" disabled={!lastTerm} onClick={openYouTube}>
          Open YouTube
        </button>
      </div>
    </div>
  );
}
