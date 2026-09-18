# Wyth 生产密钥与配置清单

此文件只记录变量名称、用途和保存位置，绝不填写变量值。真实值只存在于密码管理器和对应平台的私密环境变量界面。

| 变量名 | 用途 | staging 保存位置 | production 保存位置 | 能否进浏览器/Git |
| --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 | Render staging Environment | Render production Environment | 公开 URL 可供前端；服务端另存一份 |
| `SUPABASE_PUBLISHABLE_KEY` | 浏览器登录/数据请求的受限公钥 | 前端构建环境 | 前端构建环境 | 可公开，但只能配合 RLS |
| `RESEND_API_KEY` | 验证与重置邮件 | Render staging Environment | Render production Environment | 否 |
| `SENTRY_DSN` | 错误上报配置 | Render staging Environment | Render production Environment | 只按 Sentry 官方建议配置 |
| `SENTRY_AUTH_TOKEN` | 构建上传 source map | GitHub Actions Secrets | GitHub Actions Secrets | 否 |
| `APP_ORIGIN` | 允许的 Wyth 网站域名 | Render staging Environment | Render production Environment | 可公开 |
| `AUTH_RECOVERY_SECRET` | 绑定一次性密码恢复会话的 HMAC 密钥（至少 32 随机字节） | Render staging Environment | Render production Environment | 绝对禁止 |

## 操作规则

- 变量名可以写在文档、代码和问题里；变量值不可以。
- 不在 `.env`、`.env.local`、截图、录屏、浏览器控制台、测试输出、日志或 Git 中写密钥。
- staging 和 production 的每个密钥必须不同；轮换时先更新 staging 验证，再更新 production。
- Wyth 不保存用户的模型密钥；它只存在于当前浏览器标签页内存，并随单次模型请求经安全代理转发。
- 不在 Render 或 `.local-data/model.json` 中配置平台模型密钥、付款私钥或付款 webhook secret。
