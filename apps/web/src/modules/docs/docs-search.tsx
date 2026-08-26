"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { useRouter } from "next/navigation";

import { Input } from "@agentforge/ui";

import { PRODUCT_DOCS_SECTIONS } from "./content";
import { docsPageHref } from "./routing";
import { searchDocs, type DocsSearchHit } from "./search";

function useSearchModifierLabel(): string {
  const [label, setLabel] = useState("Ctrl K");

  useEffect(() => {
    const platform = navigator.platform || navigator.userAgent;
    setLabel(/mac/i.test(platform) ? "⌘K" : "Ctrl K");
  }, []);

  return label;
}

function hitKey(hit: DocsSearchHit): string {
  return `${hit.slug}#${hit.headingId ?? ""}`;
}

function suggestionHits(): readonly DocsSearchHit[] {
  return PRODUCT_DOCS_SECTIONS.map((section) => ({
    slug: section.id,
    pageTitle: section.title,
    headingId: null,
    headingTitle: null,
    score: 0,
  }));
}

export function DocsSearch({ basePath }: { basePath: string }): ReactElement {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const listId = useId();
  const modifier = useSearchModifierLabel();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const results = useMemo(() => {
    const trimmed = query.trim();
    return trimmed.length === 0 ? suggestionHits() : searchDocs(query);
  }, [query]);

  const close = useCallback(() => {
    dialogRef.current?.close();
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const openPalette = useCallback(() => {
    dialogRef.current?.showModal();
    setOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") {
        return;
      }
      event.preventDefault();
      if (dialogRef.current?.open) {
        close();
      } else {
        openPalette();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [close, openPalette]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, results.length]);

  function navigateTo(hit: DocsSearchHit): void {
    const href = docsPageHref(basePath, hit.slug, hit.headingId ?? undefined);
    close();
    router.push(href);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[selectedIndex];
      if (hit) {
        navigateTo(hit);
      }
    }
  }

  const selectedHit = results[selectedIndex];

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-10 items-center gap-3 rounded-md border px-3 text-base transition-colors"
        aria-label="Search docs"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>Search</span>
        <kbd className="border-border bg-muted text-muted-foreground hidden rounded-sm border px-1.5 py-0.5 font-mono text-sm sm:inline">
          {modifier}
        </kbd>
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => {
          setOpen(false);
          setQuery("");
          setSelectedIndex(0);
        }}
        className="border-border bg-surface text-foreground fixed left-1/2 top-[18%] z-50 w-[min(100%-2rem,36rem)] -translate-x-1/2 rounded-lg border p-0 shadow-lg backdrop:bg-black/45 open:flex open:flex-col"
      >
        <div className="border-border flex flex-col border-b px-3 py-3">
          <p id={titleId} className="sr-only">
            Search docs
          </p>
          <Input
            ref={inputRef}
            type="search"
            name="docs-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages and headings…"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-controls={listId}
            aria-activedescendant={selectedHit ? `${listId}-${hitKey(selectedHit)}` : undefined}
            className="h-11 text-base"
          />
        </div>
        <ul
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="max-h-[min(24rem,50dvh)] overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <li className="text-muted-foreground px-4 py-3 text-base">No matching pages.</li>
          ) : (
            results.map((hit, index) => {
              const active = index === selectedIndex;
              const key = hitKey(hit);
              return (
                <li key={key} role="presentation">
                  <button
                    type="button"
                    id={`${listId}-${key}`}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => {
                      setSelectedIndex(index);
                    }}
                    onClick={() => {
                      navigateTo(hit);
                    }}
                    className={
                      active
                        ? "bg-muted text-foreground relative flex w-full items-start gap-3 px-4 py-2.5 text-left before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-accent"
                        : "text-foreground relative flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-transparent hover:before:bg-accent"
                    }
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-base font-medium">{hit.pageTitle}</span>
                      {hit.headingTitle ? (
                        <span className="text-muted-foreground text-sm">{hit.headingTitle}</span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Page</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </dialog>
    </>
  );
}
