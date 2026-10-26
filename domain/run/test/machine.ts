/**
 * @file How much slower the machine running the tests is than the one the budgets were pinned on. The wall-clock
 * budgets in these suites (a founding under two seconds, seventy years under fifteen) are a regression check pinned
 * on the developer's machine; the publish workflow's runner (ADR-0011) is about three times slower and sets `CI`, so
 * there the budgets are read four times wider and the same regression still trips them. No DOM, no Node types: the
 * environment is read off the global object, which is absent in a browser and leaves the budget as pinned.
 * Public interface: slower.
 * Owner context: Run (tests).
 */

/** The factor a timing budget is widened by: 4 on a runner that sets `CI`, 1 everywhere else. */
export function slower(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.CI ? 4 : 1;
}
