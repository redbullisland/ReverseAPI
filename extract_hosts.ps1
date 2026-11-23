$src = 'D:\ReverseAPI\eyecon_jadx\sources'
$hosts = @{}

Get-ChildItem -LiteralPath $src -Recurse -File -Filter '*.java' | ForEach-Object {
    $text = Get-Content -LiteralPath $_.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $text) { return }
    foreach ($m in [regex]::Matches($text, 'https?://[^\s"<>]+')) {
        $h = [regex]::Match($m.Value, 'https?://([^/\s"<>]+)').Groups[1].Value
        if ($h) {
            if ($hosts.ContainsKey($h)) { $hosts[$h]++ } else { $hosts[$h] = 1 }
        }
    }
}

$hosts.GetEnumerator() |
    Sort-Object Value -Descending |
    Select-Object -First 60 Name, Value |
    Format-Table -AutoSize
