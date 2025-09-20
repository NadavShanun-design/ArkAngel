# AWS Integration Test Script for ArkAngel
Write-Host "Testing AWS Integration for ArkAngel" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

# Check if config.toml exists
if (Test-Path "src-tauri\config.toml") {
    Write-Host "Configuration file found: src-tauri\config.toml" -ForegroundColor Green
    
    # Read and display config
    $config = Get-Content "src-tauri\config.toml" | Select-String -Pattern "api_url|device_id|watch_dir"
    Write-Host "Current Configuration:" -ForegroundColor Yellow
    foreach ($line in $config) {
        Write-Host "   $line" -ForegroundColor Cyan
    }
} else {
    Write-Host "Configuration file not found: src-tauri\config.toml" -ForegroundColor Red
    Write-Host "   Please create the configuration file first." -ForegroundColor Yellow
}

# Check if memory folder exists
if (Test-Path "memory") {
    Write-Host "Memory folder found: memory\" -ForegroundColor Green
    
    # Count JSON files
    $jsonFiles = Get-ChildItem "memory\*.json" -ErrorAction SilentlyContinue
    $syncedFiles = Get-ChildItem "memory\*.synced" -ErrorAction SilentlyContinue
    
    Write-Host "File Status:" -ForegroundColor Yellow
    Write-Host "   Ready for upload: $($jsonFiles.Count)" -ForegroundColor Cyan
    Write-Host "   Already synced: $($syncedFiles.Count)" -ForegroundColor Cyan
    
    if ($jsonFiles.Count -gt 0) {
        Write-Host "Files ready for upload:" -ForegroundColor Yellow
        foreach ($file in $jsonFiles) {
            Write-Host "   - $($file.Name)" -ForegroundColor White
        }
    }
} else {
    Write-Host "Memory folder not found: memory\" -ForegroundColor Red
    Write-Host "   The folder will be created when ArkAngel runs." -ForegroundColor Yellow
}

# Check Rust compilation
Write-Host "Testing Rust Compilation..." -ForegroundColor Yellow
try {
    Push-Location "src-tauri"
    $result = cargo check 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Rust code compiles successfully" -ForegroundColor Green
    } else {
        Write-Host "Rust compilation failed:" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
    }
    Pop-Location
} catch {
    Write-Host "Failed to test Rust compilation: $_" -ForegroundColor Red
}

Write-Host "Next Steps:" -ForegroundColor Green
Write-Host "1. Update src-tauri\config.toml with your actual API Gateway URL" -ForegroundColor White
Write-Host "2. Set a unique device_id for this computer" -ForegroundColor White
Write-Host "3. Start ArkAngel to begin automatic AWS uploads" -ForegroundColor White
Write-Host "4. Check console output for upload status messages" -ForegroundColor White

Write-Host "For detailed configuration help, see: AWS_INTEGRATION_README.md" -ForegroundColor Cyan
