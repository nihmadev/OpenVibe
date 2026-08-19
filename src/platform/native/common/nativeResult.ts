// Small helpers for wrapping Tauri invocations into discriminated results.

export type Ok<T extends object> = { ok: true } & T;
export type Err = { ok: false; error: string };
export type Result<T extends object> = Ok<T> | Err;

export function ok<T extends object>(data: T): Ok<T> {
  return { ok: true, ...data };
}

export function err(msg: string): Err {
  return { ok: false, error: msg };
}

export async function wrap<T, R extends object>(fn: () => Promise<T>, transform: (t: T) => R): Promise<Result<R>> {
  try {
    const result = await fn();
    return ok(transform(result));
  } catch (e) {
    return err(String(e));
  }
}
