/** Run a transactional usage commit at most once for an existing owner/job pair. */
export async function commitSummaryUsageOnce(input: {
  findExisting: () => Promise<boolean>;
  commit: () => Promise<void>;
}): Promise<boolean> {
  if (await input.findExisting()) return false;
  await input.commit();
  return true;
}

/** Ancillary work after quota commit must never turn a saved summary into an API error. */
export async function runBestEffortSideEffect(task: () => Promise<unknown>): Promise<void> {
  try { await task(); } catch { /* Deliberately non-fatal after summary commit. */ }
}

/** Update a failed job in place, or create its first terminal metadata row. */
export async function upsertSummaryJobCompleted(input: {
  updateIncomplete: () => Promise<number>;
  create: () => Promise<void>;
}): Promise<void> {
  if (await input.updateIncomplete()) return;
  try {
    await input.create();
  } catch {
    // A concurrent failure writer may have won the insert race; complete that
    // same row, but never overwrite an already-completed row.
    await input.updateIncomplete();
  }
}
