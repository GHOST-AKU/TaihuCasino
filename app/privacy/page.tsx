import { LegalPage, LegalSection } from "@/components/legal-page"
import { PRIVACY_VERSION } from "@/lib/legal"

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow={`Draft version ${PRIVACY_VERSION}`} title="Privacy Framework / 隐私框架" summary="A plain-language outline of the data TaihuCasino uses to operate accounts, security, and gameplay.">
      <LegalSection title="Data categories / 数据类别">
        <p>Account identity, profile preferences, virtual wallet and ledger records, game sessions, game rounds, consent records, security events, and support requests.</p>
        <p>账户身份、个人偏好、虚拟钱包与流水、游戏会话、游戏记录、同意记录、安全事件与支持请求。</p>
      </LegalSection>
      <LegalSection title="Security identifiers / 安全标识">
        <p>Rate limiting stores HMAC-hashed identifiers rather than raw IP addresses. Passwords, tokens, cookies, and complete request bodies are not written to security-event logs.</p>
        <p>限流系统保存 HMAC 哈希标识而非原始 IP。安全事件日志不记录密码、Token、Cookie 或完整请求体。</p>
      </LegalSection>
      <LegalSection title="Your controls / 用户权利入口">
        <p>Authenticated members can export their account data and submit a two-stage account-deletion request from Member Settings.</p>
        <p>已登录会员可在会员设置中导出账户数据，并提交两阶段账户删除申请。</p>
      </LegalSection>
      <LegalSection title="Pending decisions / 待确认事项">
        <p>Final retention periods, support contact, processors, launch jurisdictions, and legally required disclosures remain pending review.</p>
        <p>最终保留期限、支持渠道、数据处理方、上线地区和法定披露内容仍待审查。</p>
      </LegalSection>
    </LegalPage>
  )
}
