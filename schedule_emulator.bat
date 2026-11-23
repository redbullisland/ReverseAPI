@echo off
schtasks /create /tn EyeconEmulator /tr "D:\ReverseAPI\run_emulator.bat" /sc once /st 23:59 /f
schtasks /run /tn EyeconEmulator
schtasks /query /tn EyeconEmulator /fo LIST
