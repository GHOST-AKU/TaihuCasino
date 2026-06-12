import { LegalPage, LegalSection } from "@/components/legal-page"
import { TERMS_VERSION } from "@/lib/legal"

export default function TermsPage() {
  return (
    <LegalPage eyebrow={`Draft version ${TERMS_VERSION}`} title="Terms Framework / 使用条款框架" summary="The rules framework for using TaihuCasino as a virtual-token leisure game.">
      <LegalSection title="Product boundary / 产品边界">
        <p>TaihuCasino is a casino-themed leisure game using virtual tokens. It is not an online real-money casino.</p>
        <p>太湖赌场是一款使用虚拟代币的赌场题材休闲游戏，不是线上真钱赌场。</p>
        <p>Virtual tokens cannot be withdrawn, sold, transferred between users, redeemed for cash, prizes, or anything of real-world value.</p>
        <p>虚拟代币不可提现、出售、用户间转账，也不可兑换现金、奖品或任何现实价值。</p>
      </LegalSection>
      <LegalSection title="Fair use / 合理使用">
        <p>Automation, abuse, account sharing, bypassing security controls, and manipulating game or wallet systems are prohibited.</p>
        <p>禁止自动化滥用、共享账号、绕过安全控制，以及操纵游戏或虚拟钱包系统。</p>
      </LegalSection>
      <LegalSection title="Pending decisions / 待确认事项">
        <p>Launch jurisdictions, minimum age, dispute process, and final governing-law language remain pending legal review.</p>
        <p>首批上线地区、最低年龄、争议处理方式和最终适用法律文字仍待法律审查。</p>
      </LegalSection>
    </LegalPage>
  )
}
