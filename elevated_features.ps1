$out = 'D:\ReverseAPI\dism_features.txt'
& DISM.exe /Online /Get-Features /Format:Table *> $out
"EXIT=$LASTEXITCODE" | Out-File -Append -LiteralPath $out
