# Contributing Guide / 贡献指南

## Language Rule / 语言规则

All formal repository documents should be written in both English and Chinese.

仓库中的正式文档应统一使用英文和中文双语撰写。

This applies to:

适用于以下内容：

- README files / README 文档
- architecture and planning docs / 架构与规划文档
- specifications and design docs / 规格与设计文档
- setup guides / 搭建与使用说明
- pull requests / Pull Request

If a document starts as a draft in one language, it should be converted to bilingual form before it is treated as a formal project document.

如果文档最初只用一种语言起草，那么在成为正式项目文档之前，应补全为双语版本。

## Pull Request Format / Pull Request 格式

Please follow the PR template in `.github/pull_request_template.md`.

请使用 `.github/pull_request_template.md` 中提供的 PR 模板。

Recommended PR sections:

推荐的 PR 章节：

- Summary / 概要
- Changes / 改动内容
- Testing / 测试情况
- Notes / 备注

## Commit Messages / Commit 提交信息

Bilingual commit messages are recommended when practical, especially for user-facing or collaborative changes.

在合适的情况下，建议 commit message 也使用中英双语，尤其是用户可见改动或多人协作改动。

## General Collaboration / 通用协作约定

- Keep descriptions concise and specific. / 描述尽量简洁且具体。
- Include testing status clearly. / 清晰说明测试执行情况。
- Prefer consistent wording between English and Chinese sections. / 英文与中文内容尽量保持语义一致。

## Theme Rule / 主题规则

- All new pages must support both light and dark themes. / 所有新页面都必须支持浅色和深色主题。
- Reuse the shared theme system documented in `docs/THEME_SYSTEM.md`. / 优先复用 `docs/THEME_SYSTEM.md` 中的共享主题系统。
- Avoid hardcoded page colors when semantic theme tokens can be used. / 如果可以使用语义化主题 token，就不要硬编码页面颜色。
