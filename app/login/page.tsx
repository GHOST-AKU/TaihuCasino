import type { Metadata } from "next"

import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "会员登录 | TaihuCasino",
  description: "登录 TaihuCasino 会员中心，查看余额、优惠与实时牌桌动态。",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams

  return <LoginForm next={params.next} />
}
