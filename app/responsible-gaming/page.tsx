import { LegalPage, LegalSection } from "@/components/legal-page"

export default function ResponsibleGamingPage() {
  return (
    <LegalPage eyebrow="Draft player-protection framework" title="Responsible Play / 理性游玩" summary="TaihuCasino is designed around understandable randomness, calm pacing, and virtual-token play without cash value.">
      <LegalSection title="Core promise / 核心承诺">
        <p>No cash-out, no real-world prize redemption, no promises of profit, and no design intended to create a false expectation of real earnings.</p>
        <p>不提供提现或现实奖品兑换，不承诺收益，也不制造现实获利幻想。</p>
      </LegalSection>
      <LegalSection title="Player controls / 玩家控制">
        <p>Members can set a responsible-play limit in settings. Additional break reminders, cooling-off controls, and jurisdiction-specific protections remain on the review checklist.</p>
        <p>会员可在设置中配置理性游玩限额。休息提醒、冷静期和地区特定保护措施仍在审查清单中。</p>
      </LegalSection>
      <LegalSection title="Age gate / 年龄门槛">
        <p>Registration requires an age-eligibility attestation. The numeric minimum age will not be claimed until launch jurisdictions and legal review are confirmed.</p>
        <p>注册要求用户声明符合年龄条件。在上线地区和法律审查确认前，产品不会擅自声称具体最低年龄数字。</p>
      </LegalSection>
    </LegalPage>
  )
}
