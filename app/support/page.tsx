import { LegalPage, LegalSection } from "@/components/legal-page"

export default function SupportPage() {
  return (
    <LegalPage eyebrow="Draft support framework" title="Support / 支持" summary="A public entry point for account, privacy, safety, and gameplay support.">
      <LegalSection title="Available self-service / 当前自助入口">
        <p>Members can review account settings, export their data, submit an account-deletion request, and sign out from Member Settings.</p>
        <p>会员可在会员设置中检查账户设置、导出数据、提交账户删除申请并退出登录。</p>
      </LegalSection>
      <LegalSection title="Contact channel pending / 联系渠道待确认">
        <p>The official support and complaint email or ticket channel has not yet been approved. This page intentionally does not invent a contact address.</p>
        <p>正式支持与投诉邮箱或工单渠道尚未批准。本页面不会擅自编造联系方式。</p>
      </LegalSection>
      <LegalSection title="Urgent security reports / 紧急安全报告">
        <p>Security-report intake, response targets, and escalation ownership remain part of the launch-readiness checklist.</p>
        <p>安全报告入口、响应时限与升级负责人仍属于上线准备清单。</p>
      </LegalSection>
    </LegalPage>
  )
}
