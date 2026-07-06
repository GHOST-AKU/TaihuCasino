export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return true

  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    if (originUrl.origin === requestUrl.origin) return true

    const localHosts = new Set(["localhost", "127.0.0.1", "::1"])
    return (
      localHosts.has(originUrl.hostname) &&
      localHosts.has(requestUrl.hostname) &&
      originUrl.protocol === requestUrl.protocol &&
      originUrl.port === requestUrl.port
    )
  } catch {
    return false
  }
}
