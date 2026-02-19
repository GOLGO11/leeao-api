@echo off
setlocal enabledelayedexpansion
set API_URL=https://leeao-api-production.up.railway.app/articles/add
set PASSWORD=leeao2025

if "%~1"=="" (
    echo Usage: add-article.bat "wechat_article_url"
    echo Example: add-article.bat "https://mp.weixin.qq.com/s/xxxxxx"
    exit /b 1
)

set URL=%~1

echo Adding article...
echo URL: %URL%
echo.

curl -s -X POST "%API_URL%" -H "Content-Type: application/json" -d "{\"url\":\"%URL%\",\"password\":\"%PASSWORD%\"}"

echo.
