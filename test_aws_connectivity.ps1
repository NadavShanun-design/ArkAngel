# AWS Connectivity Test Script
Write-Host "Testing AWS API Connectivity..." -ForegroundColor Green
Write-Host "===============================" -ForegroundColor Green

$apiUrl = "https://y2xm4fan1b.execute-api.us-west-2.amazonaws.com/prod/ingest/new"
$deviceId = "dev001"
$testFilename = "test_connection.json"

Write-Host "API Endpoint: $apiUrl" -ForegroundColor Cyan
Write-Host "Device ID: $deviceId" -ForegroundColor Cyan
Write-Host "Test Filename: $testFilename" -ForegroundColor Cyan

# Test payload
$payload = @{
    deviceId = $deviceId
    filename = $testFilename
} | ConvertTo-Json

Write-Host "`nSending test request..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method POST -Body $payload -ContentType "application/json"
    
    Write-Host "✅ API Connection Successful!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host "  URL: $($response.url)" -ForegroundColor White
    Write-Host "  Key: $($response.key)" -ForegroundColor White
    
    # Test if the presigned URL is valid
    Write-Host "`nTesting presigned URL..." -ForegroundColor Yellow
    
    $testContent = "Test content for AWS connectivity test"
    $testBytes = [System.Text.Encoding]::UTF8.GetBytes($testContent)
    
    try {
        $uploadResponse = Invoke-RestMethod -Uri $response.url -Method PUT -Body $testBytes -ContentType "application/json"
        Write-Host "✅ Presigned URL Upload Test Successful!" -ForegroundColor Green
        Write-Host "Your AWS integration is fully working!" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Presigned URL test failed: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "This might be normal if the URL has expired or S3 permissions need adjustment" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host "❌ API Connection Failed:" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode
        Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 401) {
            Write-Host "This suggests an authentication issue with your presigner Lambda" -ForegroundColor Yellow
        } elseif ($statusCode -eq 403) {
            Write-Host "This suggests a permissions issue with your presigner Lambda" -ForegroundColor Yellow
        } elseif ($statusCode -eq 404) {
            Write-Host "This suggests the API route is not found - check your API Gateway configuration" -ForegroundColor Yellow
        }
    }
}

Write-Host "`nNext Steps:" -ForegroundColor Green
Write-Host "1. If the test was successful, start ArkAngel to begin automatic uploads" -ForegroundColor White
Write-Host "2. If there were errors, check the error messages above for troubleshooting" -ForegroundColor White
Write-Host "3. Check your AWS Console for any Lambda or API Gateway errors" -ForegroundColor White
