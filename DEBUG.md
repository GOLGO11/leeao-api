# Railway 更新

## 推送代码

```bash
cd railway
git add .
git commit -m "fix: 添加更多上传日志"
git push
```

## 检查日志

推送后，在 Railway 控制台查看日志，搜索 "Upload" 或 "createComment" 查看详细信息。

---

## 可能的问题

如果图片上传失败，日志会显示：
- `Upload error: xxx`
- `S3 Config: xxx` - 确认环境变量是否正确

如果评论创建失败，App 会显示：
- `createComment: postId=xxx, content=xxx, images=xxx`
- `createComment response: xxx`
