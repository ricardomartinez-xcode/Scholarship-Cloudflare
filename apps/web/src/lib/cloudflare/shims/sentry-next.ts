export type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

type Scope = {
  setContext: () => void;
  setTag: () => void;
  setUser: () => void;
};

const noop = () => {};

const scope: Scope = {
  setContext: noop,
  setTag: noop,
  setUser: noop,
};

export function init() {}

export function addBreadcrumb() {}

export function captureException() {}

export function captureMessage() {}

export function withScope(callback: (scope: Scope) => void) {
  callback(scope);
}
