import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";

expect.extend(jestDomMatchers);

afterEach(() => cleanup());

class ResizeObserverMock { observe(): void {} unobserve(): void {} disconnect(): void {} }
Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock });
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", { value: () => false });
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", { value: () => undefined });
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", { value: () => undefined });
Object.defineProperty(Element.prototype, "scrollIntoView", { value: () => undefined });
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => ({ measureText: () => ({ width: 10 }) }) });
