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

Railway Bucket 的 Credentials 页面会提供以下变量。请将它们添加到
`leeao-api` 服务，并保持 Bucket、Endpoint、Region 与生产 Bucket 一致：

```
AWS_S3_BUCKET_NAME=<S3 bucket名称，通常带唯一后缀>
AWS_DEFAULT_REGION=<region>
AWS_ENDPOINT_URL=<S3 endpoint URL>
AWS_ACCESS_KEY_ID=<Access Key ID>
AWS_SECRET_ACCESS_KEY=<Secret Access Key>
AWS_S3_URL_STYLE=virtual
RAILWAY_STATIC_URL=https://leeao-api-production.up.railway.app
```

## 3. 重新部署

推送代码后 Railway 会自动重新部署。

## 环境变量示例

```
AWS_S3_BUCKET_NAME=leeao-images-xxxxxxxx
AWS_DEFAULT_REGION=auto
AWS_ENDPOINT_URL=https://t3.storageapi.dev
AWS_ACCESS_KEY_ID=xxxxxxxx
AWS_SECRET_ACCESS_KEY=xxxxxxxx
AWS_S3_URL_STYLE=virtual
RAILWAY_STATIC_URL=https://leeao-api-production.up.railway.app
```

## 图片访问方式

上传后的图片URL格式：
```
https://leeao-api-production.up.railway.app/upload/image/images/1234567890_abc123.jpg
```

通过 Railway 代理访问，国内可直接访问。
