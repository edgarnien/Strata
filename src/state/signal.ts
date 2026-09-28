export interface Signal<T> {
  get(): T;
  set(value: T): void;
  update(fn: (value: T) => T): void;
  subscribe(fn: (value: T) => void): () => void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  const set = (next: T) => {
    if (Object.is(next, value)) return;
    value = next;
    for (const fn of [...subscribers]) fn(value);
  };
  return {
    get: () => value,
    set,
    update: (fn) => set(fn(value)),
    subscribe(fn) {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
  };
}

/** Runs `fn` now and whenever one of `deps` changes. Returns a stop function. */
export function effect(deps: readonly Signal<unknown>[], fn: () => void): () => void {
  fn();
  const stops = deps.map((d) => d.subscribe(() => fn()));
  return () => stops.forEach((stop) => stop());
}
