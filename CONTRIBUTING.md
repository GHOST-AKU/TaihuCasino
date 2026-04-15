# Contributing Guide / 贡献指南

## Language Rule / 语言规则

All pull requests for this repository should be written in both English and Chinese.

本仓库中的所有 Pull Request 都应使用英文和中文双语撰写。

This applies to:

适用于以下内容：

- PR title / PR 标题
- PR description / PR 描述
- Change summary / 变更摘要
- Testing notes / 测试说明

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
