export function resolveAppRedirectTarget(nextTarget: unknown, fallback = "/") {
  if (
    typeof nextTarget !== "string" ||
    !nextTarget.startsWith("/") ||
    nextTarget.startsWith("//") ||
    nextTarget.includes("\\")
  ) {
    return fallback
  }

  return nextTarget
}
