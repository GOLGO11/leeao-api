@echo off
chcp 65001 >nul
set API_URL=https://leeao-api-production.up.railway.app/articles

echo 正在获取文章列表...
echo.

curl -s "%API_URL%"

echo.
