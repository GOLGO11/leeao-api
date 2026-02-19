@echo off
setlocal enabledelayedexpansion
set API_URL=https://leeao-api-production.up.railway.app/articles
set PASSWORD=leeao2025

echo Listing articles...
echo.

curl -s "%API_URL%"

echo.
echo.
echo To delete an article, use: delete-article.bat "article_id"
