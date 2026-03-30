@echo off
cd /d "C:\Users\Administrator\Desktop\KairosLab_Virtual_Office"
pm2 start ecosystem.config.cjs
pm2 save
echo KairosLab Office started with pm2
echo Use "pm2 status" to check, "pm2 logs" to see output
pause
