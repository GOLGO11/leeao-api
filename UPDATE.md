# 更新 Railway 代码

## 步骤

1. 将 `railway` 目录推送到 GitHub
2. Railway 会自动检测更新并重新部署

## 命令

```bash
cd railway
git add .
git commit -m "fix: 修复帖子ID格式和时间显示"
git push
```

## 修复内容

1. **帖子ID格式** - MongoDB `_id` 转换为前端兼容的 `id`
2. **用户创建时间** - 返回 `createdAt` 字段

---

或者告诉我你的 GitHub 仓库地址，我帮你更新。
