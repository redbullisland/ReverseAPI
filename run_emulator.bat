@echo off
set "EMU=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe"
"%EMU%" -avd Eyecon_GAPI_35 -no-snapshot-load -no-boot-anim -gpu swiftshader_indirect -memory 4096 > "D:\ReverseAPI\emulator_visible.log" 2>&1
