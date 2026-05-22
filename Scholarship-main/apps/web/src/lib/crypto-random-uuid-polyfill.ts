const cryptoObject = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;

if (cryptoObject && typeof cryptoObject.randomUUID !== "function") {
  Object.defineProperty(cryptoObject, "randomUUID", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: () => `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  });
}