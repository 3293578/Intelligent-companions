# Wyth 生产密钥与配置清单

此文件只记录变量名称、用途和保存位置，绝不填写变量值。真实值只存在于密码管理器和对应平台的私密环境变量界面。

| 变量名 | 用途 | staging 保存位置 | production 保存位置 | 能否进浏览器/Git |
| --- | --- | --- | --- | --- |
| `DEEPSEEK_API_KEY` | 平台统一管理的模型密钥 | Render staging Environment | Render production Environment | 否 |
| `DEEPSEEK_MODEL` | 模型名称 | Render staging Environment | Render production Environment | 可公开名称，不放密钥文件 |
| `SUPABASE_URL` | Supabase 项目地址 | Render staging Environment | Render production Environment | 公开 URL 可供前端；服务端另存一份 |
| `SUPABASE_PUBLISHABLE_KEY` | 浏览器登录/数据请求的受限公钥 | 前端构建环境 | 前端构建环境 | 可公开，但只能配合 RLS |
| `SUPABASE_SECRET_KEY` | 服务器管理和 webhook 工作 | Render staging Environment | Render production Environment | 绝对禁止 |
| `RESEND_API_KEY` | 验证、重置及账单邮件 | Render staging Environment | Render production Environment | 否 |
| `SENTRY_DSN` | 错误上报配置 | Render staging Environment | Render production Environment | 只按 Sentry 官方建议配置 |
| `SENTRY_AUTH_TOKEN` | 构建上传 source map | GitHub Actions Secrets | GitHub Actions Secrets | 否 |
| `PADDLE_API_KEY` | Paddle 服务端 API | Render staging Environment | Render production Environment | 否 |
| `PADDLE_CLIENT_TOKEN` | Paddle.js 打开安全结账层；仅允许匹配环境的客户端令牌 | Render staging Environment | Render production Environment | 是（仅该客户端令牌） |
| `PADDLE_WEBHOOK_SECRET` | 验证 Paddle webhook | Render staging Environment | Render production Environment | 否 |
| `PADDLE_STANDARD_PRICE_ID` | Standard 套餐价格 ID | Render staging Environment | Render production Environment | 可公开，但按环境分开 |
| `PADDLE_UNLIMITED_PRICE_ID` | Unlimited 套餐价格 ID | Render staging Environment | Render production Environment | 可公开，但按环境分开 |
| `PADDLE_ENVIRONMENT` | `sandbox` 或 `production` | Render staging Environment | Render production Environment | 可公开 |
| `PAYPAL_CLIENT_ID` | PayPal server checkout 标识 | Render staging Environment | Render production Environment | 前端仅在正式方案审核后按官方要求使用 |
| `PAYPAL_CLIENT_SECRET` | PayPal 服务端密钥 | Render staging Environment | Render production Environment | 否 |
| `PAYPAL_WEBHOOK_ID` | 验证 PayPal webhook | Render staging Environment | Render production Environment | 否 |
| `APP_ORIGIN` | 允许的 Wyth 网站域名 | Render staging Environment | Render production Environment | 可公开 |
| `ADMIN_BOOTSTRAP_EMAIL` | 首位 owner 初始化允许名单 | Render staging Environment，一次性使用 | Render production Environment，一次性使用 | 否 |
| `AUTH_RECOVERY_SECRET` | 绑定一次性密码恢复会话的 HMAC 密钥（至少 32 随机字节） | Render staging Environment | Render production Environment | 绝对禁止 |

## 操作规则

- 变量名可以写在文档、代码和问题里；变量值不可以。
- 不在 `.env`、`.env.local`、截图、录屏、浏览器控制台、测试输出、日志或 Git 中写密钥。
- staging 和 production 的每个密钥必须不同；轮换时先更新 staging 验证，再更新 production。
- `SUPABASE_SECRET_KEY`、付款私钥、webhook secret 和 DeepSeek 密钥只能由服务器读取。
- 平台上线前使用部署平台的“环境变量/Secrets”页面；不要再依赖本机 `.local-data/model.json` 保存生产密钥。
