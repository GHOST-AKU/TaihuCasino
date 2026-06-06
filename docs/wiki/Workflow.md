# Workflow / 工作流

This page defines the default delivery loop from planning to merge.

本页定义从计划到合并的默认交付流程。

## Issue -> PR -> Review -> Merge / Issue 到合并

1. Create or refine an issue with required sections. / 创建或完善 Issue，包含必需部分：
   - Goal / 目标
   - Scope / 范围
   - Acceptance / 验收标准
   - Out of scope / 非目标
2. Move the issue into the active queue. / 将 Issue 移入活跃队列。
3. Open a PR with bilingual summary and verification steps. / 创建包含中英双语摘要和验证步骤的 PR。
4. Address review comments and rerun checks. / 处理评审意见并重新运行检查。
5. Merge only after acceptance criteria are met. / 仅在满足验收标准后合并。

## Required PR Content / PR 必需内容

- What changed / 变更内容
- Verification / 验证步骤
- Follow-ups / 后续项（if any）

## Review Expectations / 评审要求

- Changes must align with issue scope. / 改动必须符合 Issue 范围。
- Include test/build evidence for behavioral changes. / 行为变更必须提供测试或构建证据。
- Keep unrelated refactors out of scope unless necessary. / 除非必要，不要混入无关重构。

## References / 参考文档

- [CONTRIBUTING](../../CONTRIBUTING.md)
- [Docs Index](../README.md)
