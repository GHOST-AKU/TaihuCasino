# TaihuCasino Legal Review Checklist / 法律审查清单

Status / 状态: Engineering framework complete; legal approval pending. / 工程框架已完成，法律批准待完成。

The public legal pages are deliberately marked as drafts. They are not final legal documents and must not be presented as approved legal advice.

公开法律页面已明确标注为草稿，不是正式法律文书，不得被描述为已经获得法律批准。

## Confirmed product boundary / 已确认产品边界

- TaihuCasino is a casino-themed leisure game using virtual tokens, not a real-money casino.
- Virtual tokens cannot be withdrawn or redeemed for cash, prizes, or real-world value.
- User-to-user token transfer and sale are not supported.
- 太湖赌场是使用虚拟代币的赌场题材休闲游戏，不是真钱赌场。
- 虚拟代币不可提现，也不可兑换现金、奖品或现实价值。
- 不支持用户间转账或出售虚拟代币。

## Decisions still required / 仍需确认的事项

- Launch jurisdictions and distribution channels. / 首批上线地区与分发渠道。
- Applicable minimum age and whether stronger verification is required. / 适用最低年龄以及是否需要更强验证。
- Official support, complaint, and security-report contact channels. / 正式支持、投诉与安全报告渠道。
- Data retention periods after an account-deletion request. / 账户删除申请后的数据保留期限。
- Which security, ledger, consent, and fraud-prevention records must be retained or anonymized. / 哪些安全、流水、同意与反欺诈记录需要保留或匿名化。
- Final governing law, dispute process, processor disclosures, and jurisdiction-specific notices. / 最终适用法律、争议流程、处理方披露和地区特定通知。

## Engineering behavior / 当前工程行为

- Registration and consent-aware OAuth require Terms, Privacy, and age-eligibility acknowledgement.
- Consent records include version identifiers, timestamp, locale, source, and age attestation.
- Authenticated members can export their own data as private, non-cached JSON.
- Account deletion uses a two-stage request. Confirmation requires recent login and no active table sessions.
- Confirmed deletion requests stop at retention/operator review; the application does not directly delete the auth user.
- 注册与带同意的 OAuth 要求条款、隐私和年龄资格声明。
- 同意记录包含版本、时间、地区语言、来源和年龄声明。
- 已认证会员可导出自己的私有、禁止缓存 JSON 数据。
- 删除账户采用两阶段申请；确认要求近期登录且没有活跃桌台。
- 已确认删除申请停在保留与人工审核阶段，应用不会直接删除认证用户。
