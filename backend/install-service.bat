@echo off
echo Installing KAIROS Backend as Windows Service...
npm install -g node-windows
node install-service.js
echo Done.
pause
