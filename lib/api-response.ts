export function ok<T>(data: T, status = 200): Response {
  return Response.json({ ok: true, data }, { status });
}

export function err(
  message: string,
  status = 400,
  extra?: Record<string, unknown>
): Response {
  return Response.json({ ok: false, error: message, ...(extra ?? {}) }, { status });
}
