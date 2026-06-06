# AI Interpreter - ngrok Setup Script
Write-Host "AI Interpreter - ngrok Setup Tool" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok already installed
if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    Write-Host "ngrok already installed" -ForegroundColor Green
    ngrok --version
} else {
    Write-Host "Downloading ngrok..." -ForegroundColor Yellow
    
    # Download ngrok
    $ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"
    $zipPath = "$env:TEMP\ngrok.zip"
    
    try {
        Invoke-WebRequest -Uri $ngrokUrl -OutFile $zipPath -UseBasicParsing
        Write-Host "Download complete" -ForegroundColor Green
        
        # Extract
        Write-Host "Extracting..." -ForegroundColor Yellow
        Expand-Archive -Path $zipPath -DestinationPath "$env:TEMP\ngrok" -Force
        
        # Move to .tools directory
        $toolsPath = "$PSScriptRoot\.tools"
        if (-not (Test-Path $toolsPath)) {
            New-Item -ItemType Directory -Path $toolsPath -Force | Out-Null
        }
        
        Copy-Item "$env:TEMP\ngrok\ngrok.exe" -Destination $toolsPath -Force
        Write-Host "Installed to: $toolsPath\ngrok.exe" -ForegroundColor Green
        
        # Cleanup
        Remove-Item $zipPath -Force
        Remove-Item "$env:TEMP\ngrok" -Recurse -Force
        
        # Add to PATH for this session
        $env:PATH += ";$toolsPath"
        Write-Host "Added to PATH" -ForegroundColor Green
        
        Write-Host ""
        Write-Host "Run: .\.tools\ngrok.exe http 3000" -ForegroundColor Cyan
    } catch {
        Write-Host "Download failed: $_" -ForegroundColor Red
        Write-Host "Manual download: https://ngrok.com/download" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Instructions:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Register ngrok (free):" -ForegroundColor White
Write-Host "   Visit: https://dashboard.ngrok.com/signup" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Get Authtoken:" -ForegroundColor White
Write-Host "   Dashboard -> Your Authtoken -> Copy token" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Configure token:" -ForegroundColor White
Write-Host "   .\.tools\ngrok.exe config add-authtoken YOUR_TOKEN" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Start service:" -ForegroundColor White
Write-Host "   .\.tools\ngrok.exe http 3000" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Copy the https URL - access from any device!" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
