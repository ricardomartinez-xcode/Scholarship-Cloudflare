export function can(currentCapabilities: Iterable<string>, required: Iterable<string>) {
  const current = new Set(currentCapabilities);
  for (const capability of required) {
    if (current.has(capability)) return true;
  }
  return false;
}
