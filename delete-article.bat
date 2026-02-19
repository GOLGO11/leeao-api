@echo off
setlocal enabledelayedexpansion
set API_URL=https://leeao-api-production.up.railway.app/articles
set PASSWORD=leeao2025

if "%~1"=="" (
    echo Usage: delete-article.bat "article_id"
    echo.
    echo First run list-articles.bat to see article IDs
    exit /b 1
)

set ID=%~1

echo Deleting article...
echo ID: %ID%
echo.

curl -s -X DELETE "%API_URL%/%ID%" -H "Content-Type: application/json" -d "{\"password\":\"%PASSWORD%\"}"

echo.
