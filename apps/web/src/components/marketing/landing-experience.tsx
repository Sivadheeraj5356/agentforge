"use client";

import type { ReactElement, ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { PackAnatomy, PackCatalog } from "@/components/marketing/pack-anatomy";
import { Reveal, motion, useReducedMotion } from "@/components/marketing/motion";
import { MarketingCtaLink } from "@/components/marketing/site-chrome";
import {
  LANDING_AUDIENCE,
  LANDING_AUDIENCE_EYEBROW,
  LANDING_AUDIENCE_HEADING,
  LANDING_AUDIENCE_LEAD,
  LANDING_BADGE,
  LANDING_BENEFITS,
  LANDING_BENEFITS_EYEBROW,
  LANDING_BENEFITS_HEADING,
  LANDING_FINAL_HEADING,
  LANDING_FINAL_LEAD,
  LANDING_HEADLINE,
  LANDING_PACK_EYEBROW,
  LANDING_PACK_HEADING,
  LANDING_PACK_LEAD,
  LANDING_PROBLEM,
  LANDING_PROOF,
  LANDING_PROVIDE,
  LANDING_PROVIDE_EYEBROW,
  LANDING_PROVIDE_HEADING,
  LANDING_PROVIDE_LEAD,
  LANDING_RUN_EYEBROW,
  LANDING_RUN_HEADING,
  LANDING_RUN_PATH,
  LANDING_SUBHEAD,
} from "@/modules/marketing/copy";

const HeroFlow = dynamic(
  () => import("@/components/marketing/hero-flow").then((mod) => mod.HeroFlow),
  { ssr: false },
);

function Eyebrow({ children }: { children: ReactNode }): ReactElement {
  return (
    <p className="text-accent font-mono text-[11px] uppercase tracking-[0.16em]">{children}</p>
  );
}

function CtaPair({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}): ReactElement {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <motion.div
        whileHover={reduce ? undefined : { y: -1 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
      >
        <MarketingCtaLink href={primaryHref} size="lg">
          {primaryLabel}
        </MarketingCtaLink>
      </motion.div>
      <motion.div
        whileHover={reduce ? undefined : { y: -1 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
      >
        <MarketingCtaLink href="/docs" variant="outline" size="lg">
          Read the docs
        </MarketingCtaLink>
      </motion.div>
    </div>
  );
}

export function LandingExperience({
  primaryHref,
  primaryLabel,
}: {
  primaryHref: string;
  primaryLabel: string;
}): ReactElement {
  const reduce = useReducedMotion();

  return (
    <div>
      <section className="relative isolate flex min-h-[min(92dvh,54rem)] items-center overflow-hidden">
        <HeroFlow />
        <div
          aria-hidden="true"
          className="from-background/55 via-background/20 to-background bg-linear-to-b pointer-events-none absolute inset-0"
        />
        <div className="px-(--spacing-page) relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-24 text-center">
          <p className="border-border bg-surface/80 text-muted-foreground rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] backdrop-blur-sm">
            {LANDING_BADGE}
          </p>
          <h1 className="text-balance font-serif text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.12]">
            {LANDING_HEADLINE}
          </h1>
          <p className="text-muted-foreground max-w-xl text-pretty text-base leading-relaxed">
            {LANDING_SUBHEAD}
          </p>
          <CtaPair primaryHref={primaryHref} primaryLabel={primaryLabel} />
        </div>
      </section>

      <section className="border-border border-y" aria-label="Product facts">
        <ul className="px-(--spacing-page) sm:divide-border mx-auto grid w-full max-w-6xl gap-8 py-12 sm:grid-cols-3 sm:gap-0 sm:divide-x">
          {LANDING_PROOF.map((item) => (
            <li
              key={item.label}
              className="flex flex-col gap-1 text-center sm:px-8 sm:text-left first:sm:pl-0 last:sm:pr-0"
            >
              <p className="text-sm font-medium tracking-tight">{item.label}</p>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-border border-b" aria-labelledby="provide-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-col gap-12 py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>{LANDING_PROVIDE_EYEBROW}</Eyebrow>
            <h2
              id="provide-heading"
              className="mt-4 text-balance font-serif text-3xl tracking-tight sm:text-4xl"
            >
              {LANDING_PROVIDE_HEADING}
            </h2>
            <p className="text-muted-foreground mt-4 text-pretty text-base leading-relaxed">
              {LANDING_PROVIDE_LEAD}
            </p>
          </Reveal>
          <ul className="border-border grid overflow-hidden rounded-lg border sm:grid-cols-2 lg:grid-cols-3">
            {LANDING_PROVIDE.map((item, index) => (
              <li
                key={item.title}
                className="border-border lg:nth-[3n]:border-r-0 sm:nth-[n+5]:border-b-0 lg:nth-[n+4]:border-b-0 flex flex-col gap-2 border-b p-8 sm:odd:border-r lg:border-r"
              >
                <Reveal delay={reduce ? 0 : 0.04 * index} className="flex flex-col gap-2">
                  <h3 className="font-serif text-lg tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-border border-b" aria-labelledby="problem-heading">
        <div className="px-(--spacing-page) mx-auto grid w-full max-w-6xl gap-10 py-24 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          <Reveal>
            <h2
              id="problem-heading"
              className="text-balance font-serif text-3xl tracking-tight sm:text-4xl"
            >
              {LANDING_PROBLEM.title}
            </h2>
          </Reveal>
          <Reveal delay={0.08} className="flex items-center">
            <p className="text-muted-foreground max-w-xl text-pretty text-base leading-relaxed lg:text-lg">
              {LANDING_PROBLEM.body}
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-border border-b" aria-labelledby="pack-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-col gap-14 py-24">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)]">
            <Reveal className="flex flex-col gap-4">
              <Eyebrow>{LANDING_PACK_EYEBROW}</Eyebrow>
              <h2
                id="pack-heading"
                className="text-balance font-serif text-3xl tracking-tight sm:text-4xl"
              >
                {LANDING_PACK_HEADING}
              </h2>
              <p className="text-muted-foreground max-w-xl text-pretty text-base leading-relaxed">
                {LANDING_PACK_LEAD}
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <PackAnatomy />
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <PackCatalog />
          </Reveal>
        </div>
      </section>

      <section className="border-border border-b" aria-labelledby="run-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-col gap-12 py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>{LANDING_RUN_EYEBROW}</Eyebrow>
            <h2 id="run-heading" className="mt-4 font-serif text-3xl tracking-tight">
              {LANDING_RUN_HEADING}
            </h2>
          </Reveal>
          <ol className="border-border sm:divide-border grid overflow-hidden rounded-lg border sm:grid-cols-3 sm:divide-x">
            {LANDING_RUN_PATH.map((step, index) => (
              <li
                key={step.label}
                className="border-border border-b p-8 last:border-b-0 sm:border-b-0"
              >
                <Reveal delay={0.06 * index} className="flex flex-col gap-3">
                  <p className="text-muted-foreground font-mono text-[11px] tabular-nums tracking-[0.14em]">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em]">{step.label}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{step.detail}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-border border-b" aria-labelledby="benefits-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-col gap-12 py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>{LANDING_BENEFITS_EYEBROW}</Eyebrow>
            <h2 id="benefits-heading" className="mt-4 font-serif text-3xl tracking-tight">
              {LANDING_BENEFITS_HEADING}
            </h2>
          </Reveal>
          <ul className="divide-border border-border divide-y border-y">
            {LANDING_BENEFITS.map((item, index) => (
              <li key={item.title}>
                <Reveal
                  delay={0.06 * index}
                  className="grid gap-3 py-10 md:grid-cols-[minmax(12rem,20rem)_minmax(0,1fr)] md:gap-16"
                >
                  <h3 className="font-serif text-xl tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed">{item.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-border border-b" aria-labelledby="audience-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-6xl flex-col gap-12 py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>{LANDING_AUDIENCE_EYEBROW}</Eyebrow>
            <h2
              id="audience-heading"
              className="mt-4 text-balance font-serif text-3xl tracking-tight sm:text-4xl"
            >
              {LANDING_AUDIENCE_HEADING}
            </h2>
            <p className="text-muted-foreground mt-4 text-pretty text-base leading-relaxed">
              {LANDING_AUDIENCE_LEAD}
            </p>
          </Reveal>
          <ul className="border-border md:divide-border grid gap-10 border-t pt-12 md:grid-cols-2 md:gap-0 md:divide-x">
            {LANDING_AUDIENCE.map((item, index) => (
              <li key={item.title} className="md:px-12 md:first:pl-0 md:last:pr-0">
                <Reveal delay={0.06 * index} className="flex flex-col gap-3">
                  <h3 className="font-serif text-2xl tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground text-base leading-relaxed">{item.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="final-cta-heading">
        <div className="px-(--spacing-page) mx-auto flex w-full max-w-3xl flex-col items-center gap-6 py-24 text-center">
          <Reveal>
            <h2
              id="final-cta-heading"
              className="text-balance font-serif text-3xl tracking-tight sm:text-4xl"
            >
              {LANDING_FINAL_HEADING}
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              {LANDING_FINAL_LEAD}
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="flex flex-col items-center gap-3">
              <CtaPair primaryHref={primaryHref} primaryLabel={primaryLabel} />
              <p className="text-muted-foreground text-sm">
                Prefer to read first?{" "}
                <Link href="/docs" className="text-foreground underline-offset-4 hover:underline">
                  Open Docs
                </Link>
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
