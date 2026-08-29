# Wyth 云端上线新手指南

> 正式域名：`thewyth.com`（Cloudflare Registrar）。认证邮件计划使用独立发信子域名 `auth.thewyth.com`。

本指南用于把 Wyth 从本机预览逐步变成面向国际用户的服务。现在不要购买传统云服务器，也不要把任何密钥、密码、身份证件或银行卡信息发到聊天里。

## 1. 采用的第一版托管架构

| 需要 | 服务 | 为什么先选它 | 现在是否要开通 |
| --- | --- | --- | --- |
| 账号、数据库、头像存储 | Supabase | 托管 Auth、Postgres、Storage，适合邮件密码登录与用户数据隔离 | 是，先建 staging |
| 部署 Node 服务 | Render | 不需要自己维护 Linux 服务器；仓库已经提供 `render.yaml` Blueprint、健康检查与私密环境变量声明 | staging 银行卡验证完成后 |
| 发验证/重置邮件 | Resend | 配置较少，适合先做测试邮件 | 在上线账户功能前 |
| 错误与故障监控 | Sentry | 能看到生产报错而不读取用户聊天内容 | 在 staging 部署后 |
| 域名与代码部署 | GitHub + 域名注册商 | GitHub 用于审查/自动部署；域名用于正式访问与邮件验证 | GitHub 先行，域名稍后 |
| 全球订阅与税务 | Paddle | 若个人/个体申请获批，可作为 Merchant of Record | 公测站与政策页齐备后申请 |
| 收款备选 | PayPal 中国个人卖家 | Paddle 审核未通过或较慢时的备选路径 | 与 Paddle 并行准备，不先接代码 |

腾讯云、阿里云账户暂时保留即可。它们更适合以后单独做中国大陆部署；国际首发先避免自己购买、维护 VPS。

## 2. 两个环境，绝不混用

| 环境 | 用途 | 可使用的数据 | 禁止事项 |
| --- | --- | --- | --- |
| staging（测试） | 开发、内部验收、支付沙盒、功能试用 | 测试账号、测试数据、测试付款产品 | 不导入真实客户、不要使用生产密钥 |
| production（正式） | 对外运营 | 真实用户与正式支付 | 不直接修改、不用测试密钥 |

规则：每个服务都单独创建 `Wyth Staging` 与 `Wyth Production`。数据库、付款产品、邮件发送域名、监控项目、环境变量都要分开。先在 staging 验证，再部署 production；出问题可回滚到上一版本。

## 3. 账号开通顺序

1. 创建/确认 GitHub 账号并开启双重验证；不要把密码或恢复码交给任何人。
2. 创建 Supabase 账号，先建立一个 staging 项目。
3. 创建 Render 账号并连接 GitHub；使用 `render.yaml` 的 Render Blueprint 部署 staging。Render 当前要求银行卡验证时，必须使用本人真实、受支持且已开通境外线上支付的卡。
4. 创建 Sentry 与 Resend 测试项目。
5. 等 staging 有公开 HTTPS 地址、价格页、隐私政策、服务条款和退款/取消政策后，再申请 Paddle。
6. 同期自行注册 PayPal 中国个人卖家，完成平台要求的身份与收款验证；审批能力以其后台实际显示为准。
7. 购买域名，配置 production 后再创建 production 的 Supabase/Render/邮件/监控项目。

## 4. 第一步：创建 Supabase staging 项目

请只在你自己的浏览器里完成以下操作：

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard)，注册或登录。
2. 点击 `New project`，组织选择个人组织即可。
3. 名称填写 `wyth-staging`；数据库密码由密码管理器生成并保存，不要发给我。
4. 区域优先选择离主要国际用户较近且你能接受的数据区域。首次测试可先选 Singapore；正式上线前根据目标市场、合规和延迟重新确认。
5. 在项目的 `Settings -> General` 记录项目名称和区域；在 `Settings -> Billing` 设置尽可能低的预算提醒阈值。免费层限制随平台变化，以控制台显示为准。
6. 暂时不要把任何 `service_role` 密钥复制到前端、Git、截图或聊天里。后续只需要你在控制台中自己填入托管平台的私密变量栏。

完成后只需告诉我“Supabase staging 已创建”，并可告诉我项目区域；不要发送密钥、连接字符串或截图中的敏感字段。届时我会给你下一步的数据库和身份认证配置。

## 5. Render staging 部署顺序

1. 完成 Render 银行卡验证。不得使用虚假地址或借用身份；银行卡号、CVV 和验证码不进入聊天、截图或 Git。
2. 在 Render 选择 `New -> Blueprint`，连接 GitHub 仓库，并选择 `codex/wyth-cinematic-ui` 分支。
3. Render 从仓库根目录读取 `render.yaml`。确认服务名为 `wyth-staging`，运行时为 Node，健康检查为 `/api/health`。
4. 只在 Render 的 Environment/Secrets 页面填写 `APP_ORIGIN`、`SUPABASE_URL`、`SUPABASE_PUBLISHABLE_KEY`、`AUTH_RECOVERY_SECRET`、`DEEPSEEK_API_KEY`；不要把值发到聊天里。
5. 首次部署使用 Render 分配的 HTTPS 地址作为 `APP_ORIGIN`。部署成功并完成冒烟测试后，再绑定 `staging.thewyth.com` 并同步更新 Render、Supabase 的允许 URL。
6. 依次验证 `/api/health`、`/api/health/ready`、邮箱注册确认、登录、一次真实 DeepSeek 对话和退出登录。任何一步失败都先保留日志，不开放公开注册。
7. staging 通过后再建立独立 production 服务；不得复用 staging 的 Supabase 项目、密钥或 Paddle 沙盒产品。

### Production Blueprint（仅在 staging 全部通过后）

1. 新建独立 Render Blueprint，并将 Blueprint Path 指向 `render.production.yaml`；不要修改现有 `wyth-staging`。
2. 该文件创建 `wyth-production`，使用不会因空闲休眠的 Starter 实例，并关闭自动部署。正式发布必须先通过测试，再由人工触发部署。
3. production 必须使用独立 Supabase 项目、Paddle live API key/client token/webhook secret/live price IDs 和 DeepSeek 密钥。任何 sandbox ID 都不能复制到 production。
4. 首次创建时先不要开放注册。完成 `thewyth.com` / `www.thewyth.com` DNS、Supabase 回调、Paddle live 域名审批、邮件域名和政策页后，再执行生产冒烟测试。
5. `COMMERCE_REQUIRED=1` 会让服务在生产支付配置缺失、令牌环境不匹配或价格 ID 无效时拒绝启动，避免免费放行或混用沙盒账单。

银行卡验证尚未完成时可以继续本地测试和文档准备，但不能完成 Render 上的真实部署、Paddle webhook、正式回调 URL 或 Cloudflare 自定义域名验证。

## 6. 费用和告警最低配置

- 在每一个供应商后台打开账单邮件通知；分别给 staging 和 production 设置预算。
- 前期只允许 staging 支出；production 没有完成回滚、监控和付款沙盒验证前不开放用户注册。
- 每月检查 DeepSeek 用量、Render 运行时、Supabase 数据库/存储、邮件发送量和错误率。
- USD 20 "Unlimited" 在产品文案和服务条款中必须说明为合理人类使用，保留防自动化与紧急成本保护。

## 7. 上线前不可跳过的项目

- HTTPS 自定义域名、邮件域名验证（SPF/DKIM/DMARC）和域名续费提醒。
- 隐私政策、服务条款、退款/取消政策、AI 陪伴披露、未成年人非恋爱陪伴政策、推荐奖励规则。
- 聊天、角色和记忆仍在用户本机；注册前和公告内都要明确提醒，且先完成本地加密导出/导入。
- 生产数据库备份、恢复演练、管理员 MFA、最小权限角色、操作审计和撤销员工/协作者权限的流程。
- 支付必须通过获批的 Paddle 或 PayPal 真实账户；不得借用他人身份、伪造海外地址或使用虚假主体。

## 8. 万一泄露或丢失访问权

1. 立即在对应平台撤销/轮换密钥，不要只修改本机文件。
2. 检查部署日志、管理员登录记录和最近的支付 webhook。
3. 从 Git 历史与公开仓库移除泄露内容后，仍然必须轮换密钥；删除文本不能让旧密钥失效。
4. 暂停生产部署或支付入口，直到原因确认；不在公开公告中暴露用户信息或密钥细节。

## 9. 你现在需要准备的非敏感信息

- 一个专门用于 Wyth 的邮箱地址，开启 MFA。
- Wyth 的英文产品简介、客服邮箱、预计首发市场和支持语言。
- 已购买的 `thewyth.com` 域名及 Cloudflare 账号恢复方式；不要发送账号密码或恢复码。
- 用于付款申请的真实个人资料和真实收款账户，只在 Paddle/PayPal 官方页面填写。
