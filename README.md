# 与敖同行 API - Railway 部署

## 部署步骤

### 1. 注册 Railway
访问 https://railway.app 注册账号（不需要实名认证）

### 2. 创建项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 连接你的 GitHub 仓库并选择此目录

### 3. 添加 MongoDB
1. 在项目中点击 "Add Service"
2. 选择 "Database" → "MongoDB"
3. Railway 会自动创建并连接

### 4. 配置环境变量
在项目设置中添加以下环境变量：

```
ADMIN_PASSWORD=leeao2025
R2_ENDPOINT=https://<你的account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<R2访问密钥ID>
R2_SECRET_ACCESS_KEY=<R2访问密钥>
R2_BUCKET_NAME=leeao-images
R2_PUBLIC_URL=https://leeao-images.你的域名.com
```

### 5. 获取 R2 凭证
1. 登录 Cloudflare Dashboard
2. 进入 R2 → Manage R2 API Tokens
3. 创建 API Token，权限选择 "Object Read & Write"
4. 复制 Access Key ID 和 Secret Access Key

### 6. 为 R2 绑定自定义域名（可选但推荐）
为了让国内用户能访问图片，建议为 R2 绑定自定义域名：
1. 在 R2 bucket 设置中添加自定义域名
2. 例如：`leeao-images.你的域名.com`

### 7. 部署
Railway 会自动检测并部署。部署成功后会获得一个域名，如：
```
https://leeao-api-production.up.railway.app
```

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/auth/register` | POST | 用户注册 |
| `/auth/login` | POST | 用户登录 |
| `/community/posts` | GET | 获取帖子列表 |
| `/community/post` | POST | 发帖 |
| `/community/post/:id` | DELETE | 删帖 |
| `/community/comments/:postId` | GET | 获取评论 |
| `/community/comment` | POST | 发评论 |
| `/articles` | GET | 获取文章列表 |
| `/articles/add` | POST | 添加文章 |

## 本地开发

```bash
npm install
cp .env.example .env
# 编辑 .env 文件
npm run dev
```

## 费用说明

Railway 免费额度：
- 每月 $5 免费额度
- 大约够用 500 小时/月
- 超出后按量计费

MongoDB 免费：
- Railway 提供的 MongoDB 有免费额度
