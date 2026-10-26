@echo off
setlocal
title Text-to-SQL Local MySQL Connector
cd /d "%~dp0"

set "PYTHON=.venv\Scripts\python.exe"
if not exist "%PYTHON%" (
    echo Creating the project's Python environment...
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -m venv .venv
    ) else (
        python -m venv .venv
    )
    if errorlevel 1 goto setup_failed
)

"%PYTHON%" -c "import sqlalchemy" >nul 2>nul
if errorlevel 1 (
    echo Installing backend packages required by the connector. This may take a few minutes...
    "%PYTHON%" -m pip install -r backend\requirements.txt
    if errorlevel 1 goto setup_failed
)

"%PYTHON%" backend\desktop_connector.py
if errorlevel 1 pause
goto end

:setup_failed
echo.
echo Connector setup failed. Check that Python 3.10+ is installed and that this computer has internet access for the initial package install.
pause

:end
endlocal
