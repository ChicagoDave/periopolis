/**
 * @file How much slower the machine running the tests is than the one the budgets were pinned on. The wall-clock
 * budgets in these suites (a founding under two seconds, seventy years under fifteen) are a regression check pinned
 * on the developer's machine; the publish workflow's runner (ADR-0011) is about three times slower and sets `CI`, so
 * there the budgets are read four times wider and the same regression still trips them. No DOM, no Node types: the
 * environment is read off the global object, which is absent in a browser and leaves the budget as pinned.
 * The budgets are measured in the test process's own CPU time, not the wall clock, so another process on the machine
 * (a build, a browser, an agent) cannot trip them; the wall clock is the fallback where CPU time is not offered.
 * Public interface: slower, cpuMs.
 * Owner context: Run (tests).
 */

/** Milliseconds of CPU this process has used (user and system), or the wall clock where that is not offered. */
export function cpuMs(): number {
  const proc = (globalThis as { process?: { cpuUsage?: () => { user: number; system: number } } }).process;
  const usage = proc?.cpuUsage?.();
  return usage ? (usage.user + usage.system) / 1000 : Date.now();
}

/** The factor a timing budget is widened by: 4 on a runner that sets `CI`, 1 everywhere else. */
export function slower(): number {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.CI ? 4 : 1;
}
