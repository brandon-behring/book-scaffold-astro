/**
 * assert-prop — shared fail-loud validator for closed-union component props
 * (#109 / the v4.15.0 parseProps sweep).
 *
 * Astro has no runtime prop validation, so a closed-union prop given an
 * out-of-range value silently produces a broken render — an empty StatusBadge
 * label, a `poc-layout-<bogus>` class that matches no CSS, NaN difficulty
 * markers. This is the same silent-degradation class as the #121 Theorem bug.
 * `assertEnumProp` converts it into a loud, actionable build-time throw.
 */

/**
 * Return `value` when it's one of `allowed`; otherwise throw an actionable
 * error naming the component, prop, the offending value, and the legal set.
 * Never returns a fallback — a closed union with no valid value is an authoring
 * error that should stop the build, not render something wrong.
 */
export function assertEnumProp<T extends string>(
  value: unknown,
  allowed: readonly T[],
  ctx: { component: string; prop: string },
): T {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  const got = value === undefined ? 'nothing' : JSON.stringify(value);
  throw new Error(
    `<${ctx.component}>: ${ctx.prop}=${got} is not one of ${allowed.join(', ')}.`,
  );
}
