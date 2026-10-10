@echo off
title Text-to-SQL Studio Launcher
cls
echo Starting Text-to-SQL Studio...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    python run.py
)
pause
