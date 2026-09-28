interface DataFastFn {
  (...args: unknown[]): void;
  q?: unknown[][];
}

interface Window {
  datafast?: DataFastFn;
}
