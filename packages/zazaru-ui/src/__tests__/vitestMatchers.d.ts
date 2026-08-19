import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// Vitest 4 owns Assertion in @vitest/expect. jest-dom currently augments the
// legacy vitest re-export, so imported `expect` instances miss the DOM matchers.
declare module "@vitest/expect" {
  interface Assertion<T = unknown> extends TestingLibraryMatchers<unknown, T> {}

  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<unknown, unknown> {}
}

export {};
