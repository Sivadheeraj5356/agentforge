---
name: landing-page
description: Build and revise the AgentForge public landing page and marketing chrome. Use when changing `/`, `/docs` marketing layout, SiteChrome, hero copy, Framer Motion on marketing pages, or conversion structure.
---

# AgentForge landing page

Official site voice. Nav label is **Docs**, never “Documentation”.

## Design system (do not invent a new brand)

Use existing tokens in `@agentforge/ui` globals: Source Serif 4 headlines, IBM Plex Sans body, IBM Plex Mono instrument labels, teal accent, warm near-black / paper. No purple SaaS, no acid-green cyber default, no cream+terracotta template, no broadsheet 01/02/03 decoration unless the content is a real sequence.

Signature: the experience-pack instrument (real catalog pack, stage **weights**, not invented scores).

## Conversion structure

Single goal: create an account or open the workspace ([Unbounce](https://unbounce.com/landing-page-examples/best-landing-page-examples/)).

Above the fold: continuous Three.js flow field, centered benefit headline, one subhead, two CTAs. Then a long sell page — not a hero-only site, not an internals FAQ:

1. Honest proof strip (hidden verifiers, staged reward, trusted control plane)
2. What AgentForge provides (scannable offering grid)
3. Problem (split layout)
4. Packs / environments (PackAnatomy + both shipped families)
5. How a run works (Enqueue → Evaluate → Record)
6. Why the score holds up
7. Who it’s for (labs / agent teams)
8. Final CTA

Wordmark in the marketing header is larger (`text-lg` / `sm:text-xl`), still IBM Plex Mono, tracking-tight.

Structure quality may follow long eval/RL lab landings (Snorkel, Scale RL Environments, Mercor Evals, Prime Intellect Lab, Terminal-Bench) — do not copy Snorkel UI (no lavender, octopus, or identical 3-panel navy cards).

Do **not** put internal FAQ on the landing (Docs public?, does the website grade?, live Slack?). That belongs in Docs.

## Motion

Three.js (`HeroFlow`) and `motion/react` **only on `/`**. Docs stay still. Honor `prefers-reduced-motion` (static frame, no RAF). Pause the flow when the hero is offscreen. Animate compositor-friendly properties in Motion (transform/opacity).

Theme: Light / Dark / System on marketing chrome. Flow colors read `--agentforge-accent` so both themes stay on-brand (teal on paper / near-black — not Snorkel lavender).

## Copy

Specific, second person, sentence case (matches the app: “Sign in”, “Create account”). No slop: reimagine, empower, seamless, unlock, next-gen, revolutionize, cutting-edge.

Do **not** invent customers, logos, ratings, or scores. Proof is shipped packs, staged weights summing to 1, labeled simulated backends, and the control/execution split.

## Motion

`motion/react` (`motion` package) only on marketing client islands. Honor `prefers-reduced-motion`. Animate transform and opacity only. One orchestrated moment (pack scan + weight bars) beats scattered effects.

## Hydration

`suppressHydrationWarning` on `<html>` and `<body>`. Do not “fix” `booster_root` / other extension-injected nodes by rewriting the tree. Marketing chrome must render the same on server and client (no `Date.now()`, no `window` during render).
