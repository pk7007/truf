@echo off
cd /d "%~dp0"
echo Open http://127.0.0.1:4173 in your browser.
echo Keep this window open while using TRUF. Press Ctrl+C to stop.
node server.cjs
pause
