import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { getLocalDemoCredentials } from "@/lib/server-auth"
import { getAuthenticatedMember } from "@/lib/member-data"
import { resolveAppRedirectTarget } from "@/lib/redirect-target"

import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "会员登录 | TaihuCasino",
  description: "登录 TaihuCasino 会员中心，查看余额、优惠与实时牌桌动态。",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>
}) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()])
  const member = await getAuthenticatedMember(cookieStore)

  if (member) {
    redirect(resolveAppRedirectTarget(params.next))
  }

  const testAccount = getLocalDemoCredentials()
  const initialMode = params.mode === "register" ? "register" : "sign-in"

  return <LoginForm initialMode={initialMode} next={params.next} testAccount={testAccount} />
}
