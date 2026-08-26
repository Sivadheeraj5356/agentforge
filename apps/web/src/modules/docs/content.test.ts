import { describe, expect, it } from "vitest";

import { docsDocumentTitle, docsSectionSlugs, getDocsSection, productDocsPlainText, PRODUCT_DOCS_SECTIONS } from "./content";
import { adjacentDocsPages, docsNavGroups, docsPageHref, isDocsSlug } from "./routing";
import { normalizeDocsQuery, searchDocs } from "./search";

describe("product documentation copy", () => {
  it("speaks as the official product, without competitor-clone framing", () => {
    const text = productDocsPlainText();
    expect(text).toMatch(/work environments/i);
    expect(text).toMatch(/RLVR/);
    expect(text).toMatch(/RL environments/);
    expect(text).toMatch(/rollouts/i);
    expect(text).toMatch(/hidden verifiers/i);
    expect(text).toMatch(/30%/);
    expect(text).toMatch(/design target/);
    expect(text).toMatch(/Checkout console clone/);
    expect(text).toMatch(/AgentForge Horizon/);
    expect(text).toMatch(/ledger-evolve/);
    expect(text).toMatch(/wave-inventory/);
    expect(text).toMatch(/Fable 5/);
    expect(text).not.toMatch(/Fable 5 scored/i);
    expect(text).not.toMatch(/we score \d+%/i);
    expect(text).not.toMatch(/terminal-bench\s*4/i);
    expect(text).not.toMatch(/not a .+clone/i);
  });

  it("covers the public docs outline as separate pages", () => {
    const ids = PRODUCT_DOCS_SECTIONS.map((section) => section.id);
    expect(ids).toEqual([
      "overview",
      "get-started",
      "provide",
      "benchmark",
      "environments",
      "rlvr",
      "long-horizon",
      "anti-cheating",
      "private-rl",
      "app-clone",
      "private-eval",
      "architecture",
    ]);
    expect(docsSectionSlugs()).toEqual(ids);
    expect(getDocsSection("get-started")?.title).toBe("Get started");
    expect(docsDocumentTitle(getDocsSection("overview")!)).toBe("Docs");
    expect(docsDocumentTitle(getDocsSection("rlvr")!)).toBe("RLVR · Docs");
  });
});

describe("docs routing", () => {
  it("maps overview to the docs index and other slugs to child paths", () => {
    expect(docsPageHref("/docs", "overview")).toBe("/docs");
    expect(docsPageHref("/docs", "benchmark")).toBe("/docs/benchmark");
    expect(isDocsSlug("benchmark")).toBe(true);
    expect(docsPageHref("/docs", "private-eval", "private-eval-protocol")).toBe(
      "/docs/private-eval#private-eval-protocol",
    );
    expect(docsPageHref("/app/acme/docs", "environments")).toBe("/app/acme/docs/environments");
    expect(isDocsSlug("app-clone")).toBe(true);
    expect(isDocsSlug("missing")).toBe(false);
  });

  it("groups nav and walks prev/next in catalog order", () => {
    const groups = docsNavGroups();
    expect(groups.map((group) => group.id)).toEqual([
      "get-started",
      "product",
      "packs",
      "architecture",
    ]);
    expect(adjacentDocsPages("overview").next?.id).toBe("get-started");
    expect(adjacentDocsPages("provide").next?.id).toBe("benchmark");
    expect(adjacentDocsPages("architecture").prev?.id).toBe("private-eval");
    expect(adjacentDocsPages("architecture").next).toBeUndefined();
  });
});

describe("docs search index", () => {
  it("finds pages and in-page headings", () => {
    const rlvr = searchDocs("RLVR");
    expect(rlvr[0]?.slug).toBe("rlvr");
    expect(rlvr[0]?.headingId).toBeNull();

    const protocol = searchDocs("stalled release train");
    expect(protocol.some((hit) => hit.slug === "private-eval")).toBe(true);

    const heading = searchDocs("staged reward");
    expect(heading.some((hit) => hit.slug === "rlvr" && hit.headingId === "rlvr-formula")).toBe(
      true,
    );
  });

  it("normalizes and bounds the query without treating it as a regex", () => {
    expect(normalizeDocsQuery("  RLVR   ")).toBe("RLVR");
    expect(normalizeDocsQuery("a".repeat(200)).length).toBe(120);
    expect(() => searchDocs(".*(")).not.toThrow();
    expect(searchDocs("   ")).toEqual([]);
  });

  it("indexes every docs page title", () => {
    for (const section of PRODUCT_DOCS_SECTIONS) {
      const hits = searchDocs(section.title);
      expect(hits.some((hit) => hit.slug === section.id)).toBe(true);
    }
  });
});
