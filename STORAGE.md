# Railway 存储桶配置指南

## 1. 创建存储桶

1. 在 Railway 项目中点击 "Add Service"
2. 选择 "Database" → "Storage" (或 Object Storage)
3. 记录生成的以下信息：
   - Bucket Name
   - Endpoint
   - Region
   - Access Key ID
   - Secret Access Key

## 2. 添加环境变量

在 Railway 的 leeao-api 服务中添加：

```
RAILWAY_BUCKET_NAME=<你的bucket名称>
RAILWAY_BUCKET_REGION=<region，如 us-east-1>
RAILWAY_BUCKET_ENDPOINT=<endpoint URL>
RAILWAY_BUCKET_ACCESS_KEY_ID=<Access Key ID>
RAILWAY_BUCKET_SECRET_ACCESS_KEY=<Secret Access Key>
RAILWAY_STATIC_URL=https://leeao-api-production.up.railway.app
```

## 3. 重新部署

推送代码后 Railway 会自动重新部署。

## 环境变量示例

```
RAILWAY_BUCKET_NAME=leeao-images
RAILWAY_BUCKET_REGION=us-east-1
RAILWAY_BUCKET_ENDPOINT=https://leeao-images.s3.us-east-1.storage.railway.app
RAILWAY_BUCKET_ACCESS_KEY_ID=xxxxxxxx
RAILWAY_BUCKET_SECRET_ACCESS_KEY=xxxxxxxx
RAILWAY_STATIC_URL=https://leeao-api-production.up.railway.app
```

## 图片访问方式

上传后的图片URL格式：
```
https://leeao-api-production.up.railway.app/upload/image/images/1234567890_abc123.jpg
```

通过 Railway 代理访问，国内可直接访问。
