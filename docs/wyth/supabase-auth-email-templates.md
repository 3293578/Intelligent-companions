# Wyth Supabase 安全邮件模板配置

Wyth 不接收放在 URL fragment 里的 access token 或 refresh token。确认注册和重置密码都通过服务端一次性 `token_hash` 完成，再写入 HttpOnly Cookie。

在 Supabase Dashboard 打开 **Authentication → Emails → Templates**。保留原有邮件正文，只把按钮链接分别替换为以下地址。

## Confirm signup

本地 staging：

```html
<a href="http://127.0.0.1:53128/api/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your Wyth account</a>
```

## Reset password

本地 staging：

```html
<a href="http://127.0.0.1:53128/api/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Reset your Wyth password</a>
```

部署 staging 和 production 后，分别把 `http://127.0.0.1:53128` 换成对应 HTTPS 域名。不要把 `ConfirmationURL`、access token、refresh token 或任何 API Key 放进模板。

## 验证清单

- 注册邮件点击后回到 `/?auth=confirmed`，地址栏没有 token。
- 重置邮件点击后回到 `/?auth=recovery`，自动打开“设置新密码”。
- 链接只能使用一次，过期链接不会建立会话。
- 密码更新后恢复会话 Cookie 被清除，需要使用新密码重新登录。
