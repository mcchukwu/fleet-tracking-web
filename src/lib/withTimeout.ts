export class TimeoutPromiseError extends Error {
  constructor(message = "The operation timed out") {
    super(message);
    this.name = "TimeoutPromiseError";
  }
}

/** Bounds a non-abortable promise (IndexedDB) so startup can continue. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TimeoutPromiseError(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}
