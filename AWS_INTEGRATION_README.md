# AWS S3 Integration for Pluely

This document explains how to configure and use the AWS S3 integration that automatically uploads redacted conversation JSON files to your S3 bucket.

## Overview

The AWS integration works alongside the existing PII scrubbing system:

1. **PII Scrubbing**: Your conversations are automatically scrubbed of sensitive information and saved locally
2. **AWS Upload**: The background uploader monitors the local memory folder and uploads clean JSON files to S3
3. **File Management**: Successfully uploaded files are renamed to `.synced` to prevent re-uploading

## Prerequisites

Before configuring the AWS integration, ensure you have:

- ✅ **S3 Bucket**: `arkangel-json-ingest-prod` (private, SSE-S3)
- ✅ **Presigner Lambda**: `presign-upload` (Python) that returns `{ "url": <presigned_put>, "key": <s3_key> }`
- ✅ **API Gateway**: HTTP API with route `POST /ingest/new` → presign-upload Lambda
- ✅ **Region**: `us-west-2` (Oregon)

## Configuration

### Step 1: Find Your API Gateway URL

1. Go to [AWS Console](https://console.aws.amazon.com/) → API Gateway
2. Select your API: **arkangel-presign-api**
3. Go to **Stages** → **prod**
4. Copy the **Invoke URL**
5. Append `/ingest/new` to create your full endpoint

**Example:**
```
Invoke URL: https://abc123xyz.execute-api.us-west-2.amazonaws.com
Full endpoint: https://abc123xyz.execute-api.us-west-2.amazonaws.com/ingest/new
```

### Step 2: Update Configuration File

Edit `src-tauri/config.toml` with your actual values:

```toml
# AWS Upload Configuration for Pluely
api_url = "https://abc123xyz.execute-api.us-west-2.amazonaws.com/ingest/new"
device_id = "dev001"                    # Change this to a unique ID for this computer
watch_dir = ".\\memory"                 # Windows path - use "./memory" on Linux/macOS
scan_interval_secs = 60                 # How often to check for new files (seconds)
concurrency = 2                         # How many uploads to process in parallel
```

**Important Notes:**
- **device_id**: Use a unique identifier for this computer (e.g., "laptop-01", "desktop-main", "dev001")
- **watch_dir**: 
  - Windows: `".\\memory"` (double backslash)
  - Linux/macOS: `"./memory"`
- **scan_interval_secs**: How frequently to check for new files (default: 60 seconds)

## How It Works

### 1. Automatic Background Upload

When Pluely starts, the AWS uploader automatically runs in the background:

- **Scans** the memory folder every 60 seconds (configurable)
- **Finds** new `.json` files (ignores `.tmp` and `.synced` files)
- **Calls** your presigner API to get upload credentials
- **Uploads** the file content to S3 using presigned PUT URLs
- **Marks** successful uploads by renaming to `.json.synced`

### 2. File Lifecycle

```
conversation_123.json.tmp     →  conversation_123.json     →  conversation_123.json.synced
     ↓                              ↓                           ↓
  Writing                    Ready for Upload            Successfully Uploaded
```

### 3. Error Handling & Retries

The system includes robust error handling:

- **Presign Retries**: 3 attempts with exponential backoff (500ms, 1200ms, 2500ms)
- **Upload Retries**: 5 attempts with exponential backoff (starting at 700ms, capped at 30s)
- **Offline Resilience**: Files remain local until upload succeeds
- **Non-blocking**: Upload failures don't affect the main application

## Testing the Integration

### Method 1: Automatic Background Upload

1. **Start Pluely**: The AWS uploader starts automatically
2. **Create a conversation**: Use the app normally
3. **Check console**: Look for upload messages in the console output
4. **Verify S3**: Check your S3 bucket for uploaded files

### Method 2: Manual Upload Trigger

You can manually trigger an upload scan using the Tauri command:

```typescript
// From your frontend (if needed)
import { invoke } from '@tauri-apps/api/core';

try {
  const result = await invoke('trigger_aws_upload');
  console.log('Upload result:', result);
} catch (error) {
  console.error('Upload failed:', error);
}
```

### Method 3: Console Testing

1. **Drop a test file**: Place a JSON file in the `memory/` folder
2. **Run the app**: Start Pluely normally
3. **Watch console**: Look for upload progress messages
4. **Check S3**: Verify the file appears in your bucket

## Monitoring & Debugging

### Console Output

The uploader provides detailed console output:

```
✅ uploaded: conversation_123.json  →  s3://arkangel-json-ingest-prod/uploads/dev001/2025-01-27T10-30-00Z_uuid_conversation_123.json
⚠️  failed processing C:\path\to\file.json: upload failed with status 403
```

### Common Issues

#### 1. Configuration Errors
```
Failed to start AWS uploader: reading config.toml
```
**Solution**: Ensure `config.toml` exists and has valid TOML syntax

#### 2. API Connection Issues
```
calling presign endpoint: reqwest::Error
```
**Solution**: Check your `api_url` and ensure the API Gateway is accessible

#### 3. File Permission Issues
```
reading file before upload: Permission denied
```
**Solution**: Ensure the app has read access to the memory folder

#### 4. S3 Upload Failures
```
PUT to presigned URL: upload failed with status 403
```
**Solution**: Check presigned URL expiration and S3 bucket permissions

## Security Features

### 1. No AWS Credentials on Device
- Uses presigned URLs for secure uploads
- No long-lived AWS access keys stored locally
- URLs expire automatically (typically 5 minutes)

### 2. PII Scrubbing
- All sensitive data is automatically redacted before upload
- Files are scrubbed locally before being sent to S3
- No PII/PHI data ever leaves the device unscrubbed

### 3. Device Isolation
- Each device gets unique S3 key namespaces
- No cross-device data access
- Device IDs are configurable and isolated

## Performance Considerations

### 1. Upload Frequency
- **Default**: 60-second scan interval
- **Adjustable**: Modify `scan_interval_secs` in config
- **Balance**: Lower intervals = faster uploads, higher intervals = less resource usage

### 2. Concurrency
- **Default**: 2 concurrent uploads
- **Adjustable**: Modify `concurrency` in config
- **Considerations**: Higher concurrency = faster processing, but more resource usage

### 3. File Size
- **Typical**: Conversation JSON files are usually <10KB
- **Optimization**: Files are compressed and contain only essential data
- **Limits**: No hard limits, but very large files may timeout

## Troubleshooting

### Uploader Not Starting

1. **Check config.toml**: Ensure file exists and has valid syntax
2. **Verify dependencies**: Ensure all Rust dependencies are installed
3. **Check console**: Look for startup error messages
4. **Restart app**: Sometimes a restart resolves initialization issues

### Files Not Uploading

1. **Check API URL**: Verify your presigner endpoint is accessible
2. **Test connectivity**: Try calling the API manually
3. **Check S3 permissions**: Ensure your presigner Lambda has S3 write access
4. **Verify file format**: Ensure files are valid JSON and have `.json` extension

### Performance Issues

1. **Reduce scan frequency**: Increase `scan_interval_secs`
2. **Lower concurrency**: Reduce `concurrency` value
3. **Check network**: Ensure stable internet connection
4. **Monitor resources**: Check CPU/memory usage during uploads

## Advanced Configuration

### Custom Retry Settings

You can modify retry behavior by editing the AWS uploader code:

```rust
// In aws_uploader.rs, modify these values:
let presigned = {
    // 3 tries for presign, starting at 500ms backoff
    for delay in [500, 1200, 2500] {  // Customize delays
        // ... presign logic
    }
};

retry(
    || { upload_with_put(client, &presigned.url, bytes.clone()) },
    5,   // attempts - customize this
    700, // base delay ms - customize this
)?;
```

### Custom File Patterns

Modify the `is_complete_json` function to handle different file patterns:

```rust
fn is_complete_json(path: &Path) -> bool {
    // Customize file selection logic here
    if path.extension().and_then(|e| e.to_str()) != Some("json") {
        return false;
    }
    // Add custom filtering logic
    true
}
```

## Support

If you encounter issues:

1. **Check console output** for detailed error messages
2. **Verify configuration** matches your AWS setup
3. **Test API connectivity** manually
4. **Review S3 permissions** and bucket configuration
5. **Check network connectivity** and firewall settings

The integration is designed to be robust and self-healing, so most issues resolve automatically with retries.
