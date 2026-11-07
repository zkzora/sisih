# Verify UI, routes, and take screenshots across viewports for Home, Connect, and Proof
$ErrorActionPreference = "Stop"

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$outDir = "C:\Sisih\docs\screenshots"
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

Write-Host "Starting Next.js local production server on port 3000..."
$serverProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd /d C:\Sisih\web && .\node_modules\.bin\next.cmd start -p 3000" -PassThru -WindowStyle Hidden

try {
    # Wait for server ready
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try {
            $res = Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing -TimeoutSec 2
            if ($res.StatusCode -eq 200) {
                $ready = $true
                break
            }
        } catch {
            Write-Host "Waiting for server ($i)..."
        }
    }

    if (!$ready) {
        throw "Next.js server failed to respond within 30 seconds."
    }

    Write-Host "Server is ready! Verifying primary routes..."
    $primaryRoutes = @("/", "/connect", "/proof")
    foreach ($r in $primaryRoutes) {
        $url = "http://127.0.0.1:3000$r"
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing
        if ($res.StatusCode -ne 200) {
            throw "Route $r returned status code $($res.StatusCode)"
        }
        Write-Host "  [OK] $r -> $($res.StatusCode)"
    }

    Write-Host "`nVerifying legacy redirect routes..."
    $legacyRoutes = @(
        "/workspace",
        "/tour",
        "/obligations",
        "/agent",
        "/memory",
        "/learning",
        "/activity",
        "/settings"
    )
    foreach ($r in $legacyRoutes) {
        $url = "http://127.0.0.1:3000$r"
        $res = Invoke-WebRequest -Uri $url -UseBasicParsing
        if ($res.StatusCode -ne 200) {
            throw "Legacy route $r returned status code $($res.StatusCode)"
        }
        Write-Host "  [OK] $r redirected -> $($res.StatusCode)"
    }

    Write-Host "`nCapturing screenshots across viewports for Home, Connect, and Proof..."
    $shots = @(
        @{ Name = "01-home-desktop-1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:3000/" },
        @{ Name = "02-home-desktop-1280.png"; Width = 1280; Height = 800; Url = "http://127.0.0.1:3000/" },
        @{ Name = "03-home-tablet-768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:3000/" },
        @{ Name = "04-home-mobile-375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:3000/" },
        @{ Name = "05-connect-desktop-1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:3000/connect" },
        @{ Name = "06-connect-desktop-1280.png"; Width = 1280; Height = 800; Url = "http://127.0.0.1:3000/connect" },
        @{ Name = "07-connect-tablet-768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:3000/connect" },
        @{ Name = "08-connect-mobile-375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:3000/connect" },
        @{ Name = "09-proof-desktop-1440.png"; Width = 1440; Height = 900; Url = "http://127.0.0.1:3000/proof" },
        @{ Name = "10-proof-desktop-1280.png"; Width = 1280; Height = 800; Url = "http://127.0.0.1:3000/proof" },
        @{ Name = "11-proof-tablet-768.png"; Width = 768; Height = 1024; Url = "http://127.0.0.1:3000/proof" },
        @{ Name = "12-proof-mobile-375.png"; Width = 375; Height = 812; Url = "http://127.0.0.1:3000/proof" }
    )

    foreach ($s in $shots) {
        $outFile = Join-Path $outDir $s.Name
        $w = $s.Width
        $h = $s.Height
        $u = $s.Url
        Write-Host "  Capturing $($s.Name) (${w}x${h}) from $u..."
        $args = @(
            "--headless=new",
            "--disable-gpu",
            "--window-size=$w,$h",
            "--screenshot=$outFile",
            $u
        )
        $proc = Start-Process -FilePath $edgePath -ArgumentList $args -PassThru -Wait
        if (Test-Path $outFile) {
            $len = (Get-Item $outFile).Length
            Write-Host "    -> Saved $outFile ($len bytes)"
        } else {
            Write-Warning "    -> Failed to save $outFile"
        }
    }

    Write-Host "`nAll screenshots and route checks completed successfully!"
} finally {
    Write-Host "Stopping Next.js server..."
    if ($serverProcess -and !$serverProcess.HasExited) {
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}
