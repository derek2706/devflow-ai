import { prisma } from "../../lib/prisma";
import repository from "./health.repository";

const MAX_PROBE_TIME_MS = 5_000;

export function createReadinessProbe(
  probe: () => PromiseLike<unknown>,
  timeoutMs = MAX_PROBE_TIME_MS,
) {
  const deadline = Math.min(MAX_PROBE_TIME_MS, Math.max(1, timeoutMs));
  let active: Promise<boolean> | undefined;

  return function checkReadiness(): Promise<boolean> {
    if (active) return active;

    let timer: ReturnType<typeof setTimeout>;
    // Handle synchronous failures and late rejections without disclosing DB details.
    const query = Promise.resolve()
      .then(probe)
      .then(
        () => true,
        () => false,
      );
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), deadline);
    });
    const current = Promise.race([query, timeout]).finally(() =>
      clearTimeout(timer),
    );
    active = current;

    // Prisma cannot cancel a query. Keep one outstanding probe, even after the
    // response deadline, so repeated health checks cannot accumulate DB queries.
    void query.then(() => {
      if (active === current) active = undefined;
    });
    return current;
  };
}

export const checkDatabaseReadiness = createReadinessProbe(() =>
  repository.probeDatabase(prisma),
);
