/** Check the browser-facing request authority, not Next's internal bind address. */
export function isAllowedRequestOrigin(
  origin: string | null,
  requestUrl: string,
  host: string | null,
): boolean {
  // Preserve support for non-browser clients that do not send Origin.
  if (!origin) return true;
  try {
    const source = new URL(origin);
    const request = new URL(requestUrl);
    if (
      !["http:", "https:"].includes(source.protocol) ||
      source.origin !== origin
    )
      return false;
    let target = request.origin;
    if (host !== null) {
      // Host is the authority the browser actually requested. Do not accept
      // forwarded-host headers or treat all loopback addresses/ports as equal.
      if (!host || /[\s,/@\\?#]/.test(host)) return false;
      const authority = new URL(`${request.protocol}//${host}`);
      if (
        authority.username ||
        authority.password ||
        authority.pathname !== "/"
      )
        return false;
      target = authority.origin;
    }
    return source.origin === target;
  } catch {
    return false;
  }
}
