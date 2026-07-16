export function ok<T>(data: T): { ok: true; [key: string]: any } {
  if (typeof data === "object" && data !== null) {
    return { ok: true, ...(data as any) };
  }
  return { ok: true, data };
}

export function err(msg: string): { ok: false; error: string } {
  return { ok: false, error: msg };
}

export async function wrap<T>(fn: () => Promise<T>, transform?: (t: T) => any): Promise<any> {
  try {
    const result = await fn();
    return ok(transform ? transform(result) : result);
  } catch (e) {
    return err(String(e));
  }
}
