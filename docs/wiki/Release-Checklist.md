# Release Checklist / 发布清单

Use this checklist before production release and during rollback decisions.

发布前与回滚决策时使用本清单。

## Pre-release / 发布前

- [ ] Required env vars are present and verified. / 必需环境变量已配置并验证。
- [ ] `corepack pnpm run ci` passes. / `corepack pnpm run ci` 已通过。
- [ ] Auth callback URLs and provider configs are correct. / 认证回调 URL 和 provider 配置正确。
- [ ] Critical member flows smoke-tested. / 关键会员流程已完成 smoke test：
  - login/register / 登录与注册
  - table buy-in / 桌台买入
  - round settlement / 回合结算
  - cash-out / 离桌结算

## Deployment / 部署

- [ ] Confirm target branch/tag and release notes. / 确认目标分支、tag 和发布说明。
- [ ] Deploy and monitor server/runtime logs for error spikes. / 部署并监控服务端和运行时日志的异常峰值。
- [ ] Validate core API endpoints after deployment. / 部署后验证核心 API。

## Rollback Triggers / 回滚触发条件

- Repeated auth failures / 持续认证失败
- Wallet/session settlement inconsistencies / 钱包或 session 结算不一致
- Sustained high-severity API errors / 持续出现高严重度 API 错误

## Rollback Steps / 回滚步骤

1. Revert to last known good deployment. / 回退到最近已知正常部署。
2. Re-run post-deploy smoke checks. / 重新执行部署后 smoke test。
3. Announce incident summary and follow-up actions. / 发布事故摘要和后续行动。

## References / 参考文档

- [Deployment Readiness](../DEPLOYMENT_READINESS.md)
- [Supabase Auth Schema](../SUPABASE_AUTH_SCHEMA.md)
