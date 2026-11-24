@echo off
chcp 65001 >nul
title Вишлисты — локальный запуск
cd /d "%~dp0"

if not exist "package.json" (
  echo [ОШИБКА] Файл package.json не найден. Скрипт должен лежать в корне проекта.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Первый запуск: устанавливаю зависимости, это займёт 1-3 минуты...
  call npm install
  if errorlevel 1 goto :error
)

if not exist ".env" (
  echo Создаю файл настроек .env по образцу .env.example...
  copy .env.example .env >nul
  echo ВАЖНО: откройте .env и замените два секрета — инструкция в docs\RUN.md, шаг 6.
)

rem Всегда проверяем миграции: после обновлений проект может требовать новую схему.
set SEED_DB=
if not exist "server\data\app.db" set SEED_DB=1
call npm run db:migrate
if errorlevel 1 goto :error
if defined SEED_DB (
  echo Создаю тестовые данные...
  call npm run db:seed
  if errorlevel 1 goto :error
)

echo.
echo Запускаю сайт. Через несколько секунд откроется браузер.
echo Адрес: http://localhost:3000
echo Чтобы остановить сайт — нажмите Ctrl+C в этом окне.
echo.

if /i not "%~1"=="nobrowser" (
  start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 9; Start-Process 'http://localhost:3000'"
)

call npm run dev
goto :end

:error
echo.
echo Что-то пошло не так. Откройте файл docs\RUN.md, раздел 17 «Типовые проблемы».
pause
exit /b 1

:end
echo.
echo Сайт остановлен.
pause
