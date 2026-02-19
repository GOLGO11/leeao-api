@echo off
chcp 65001 >nul
set API_URL=https://leeao-api-production.up.railway.app/articles/add
set PASSWORD=leeao2025

if "%~1"=="" (
    echo 用法: add-article.bat "微信文章URL"
    echo 示例: add-article.bat "https://mp.weixin.qq.com/s/xxxxxx"
    exit /b 1
)

set URL=%~1

echo 正在添加文章...
echo URL: %URL%
echo.

curl -X POST "%API_URL%" -H "Content-Type: application/json" -d "{\"url\":\"%URL%\",\"password\":\"%PASSWORD%\"}"

echo.
