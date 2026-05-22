import type { Metadata } from "next"

import { getLocalDemoCredentials } from "@/lib/server-auth"

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
  const params = await searchParams
  const testAccount = getLocalDemoCredentials()
  const initialMode = params.mode === "register" ? "register" : "sign-in"

  return <LoginForm initialMode={initialMode} next={params.next} testAccount={testAccount} />
}
