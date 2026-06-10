type StubCreditingEnvironment = {
  NODE_ENV?: string
  TAIHU_ENABLE_STUB_CREDITING?: string
}

type StubCreditSource = "ad-reward" | "purchase"

export const STUB_CREDITING_DISABLED_MESSAGE = "Stub crediting is disabled."

export function isStubCreditingEnabled(environment: StubCreditingEnvironment = process.env) {
  return environment.NODE_ENV !== "production" || environment.TAIHU_ENABLE_STUB_CREDITING === "true"
}

export function requireStubCreditingEnabled(environment: StubCreditingEnvironment = process.env) {
  if (!isStubCreditingEnabled(environment)) {
    throw new Error(STUB_CREDITING_DISABLED_MESSAGE)
  }
}

export function createStubCreditIdempotencyKey(source: StubCreditSource, referenceId: string) {
  return `${source}:${referenceId}`
}
