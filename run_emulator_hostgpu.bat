@echo off
cd /d "%LOCALAPPDATA%\Android\Sdk\emulator"
emulator.exe -avd Eyecon_GAPI_35 -no-snapshot-load -no-boot-anim -gpu host -memory 3072
