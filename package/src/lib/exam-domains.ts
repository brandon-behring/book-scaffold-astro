/**
 * exam-domains — validate a question's `domain` against the consumer's closed
 * `examDomains` taxonomy (Tier 3, #112).
 *
 * Exam domains are PER-BOOK (Cisco security domains ≠ CompTIA objectives ≠ a
 * math syllabus's topics), so they can't be a hardcoded `z.enum` in the schema.
 * The consumer declares them once — `defineBookConfig({ examDomains: [...] })`,
 * threaded through the `virtual:book-scaffold/book-config` module — and a
 * question whose `domain` is not in that list THROWS at build rather than
 * silently mis-weighting a blueprint or dropping a row from the objective-map.
 *
 * Membership can't be a Zod invariant: `questionSchema` is constructed at
 * package-load time, outside any consumer context, so it can't see
 * `examDomains` (the same constraint that put `siblingBooks` validation in
 * lib/book-link.ts rather than the schema). So Zod checks `domain` is a
 * non-empty string; THIS runs at the route/build layer where the resolved
 * config is available. Mirrors `resolveBookHref` (lib/book-link.ts).
 */
export function assertKnownDomain(
  examDomains: readonly string[] | null | undefined,
  domain: string,
  ctx: { id: string },
): string {
  if (!examDomains || !examDomains.includes(domain)) {
    const known = examDomains ?? [];
    throw new Error(
      `question "${ctx.id}": unknown exam domain "${domain}". Register it in ` +
        `defineBookConfig({ examDomains: [${JSON.stringify(domain)}, …] })` +
        (known.length
          ? ` (known: ${known.join(', ')})`
          : ' (no examDomains configured)') +
        '.',
    );
  }
  return domain;
}
