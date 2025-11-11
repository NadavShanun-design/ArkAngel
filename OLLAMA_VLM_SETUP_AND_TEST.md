# Ollama VLM Setup and Testing Guide

**Date**: November 10, 2025
**Status**: Implementation complete, ready for Ollama installation

---

## Current Status

✅ **Code Implementation**: Complete
✅ **Rust Backend**: Compiled (0 errors)
✅ **TypeScript Frontend**: Compiled (0 errors)
⚠️ **Ollama Service**: Not currently running/installed

---

## Quick Start: Install and Test

### Step 1: Install Ollama

#### Option A: Native Installation (Recommended for macOS)

```bash
# Install Ollama via Homebrew
brew install ollama

# Start Ollama service in background
ollama serve &

# Wait 5 seconds for service to start
sleep 5

# Verify it's running
curl http://localhost:11434/api/tags
```

#### Option B: Docker Installation

```bash
# Start Docker Desktop first
# Then run:

docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  --memory=16G \
  ollama/ollama:latest

# Verify
docker ps | grep ollama
```

---

### Step 2: Pull Moondream Model

```bash
# Option A (Native):
ollama pull moondream:latest

# Option B (Docker):
docker exec ollama ollama pull moondream:latest

# This downloads 1.7GB model (takes 2-5 minutes depending on connection)
```

**Expected output**:
```
pulling manifest
pulling 7b8a14b5d6f8... 100% ▕████████████████▏ 1.7 GB
pulling 40a9e0e5f62a... 100% ▕████████████████▏  287 B
pulling 06c7415ca321... 100% ▕████████████████▏   98 B
pulling 1b5531f3baa1... 100% ▕████████████████▏  520 B
verifying sha256 digest
writing manifest
success
```

---

### Step 3: Verify Ollama Setup

```bash
# Check available models
curl http://localhost:11434/api/tags | jq '.'

# Should return JSON with moondream model:
# {
#   "models": [
#     {
#       "name": "moondream:latest",
#       "model": "moondream:latest",
#       "modified_at": "2025-11-10T...",
#       "size": 1700000000,
#       ...
#     }
#   ]
# }
```

If you don't have `jq`, use:
```bash
curl http://localhost:11434/api/tags
```

---

### Step 4: Test Ollama Directly (Before ArkAngel)

Create a test image:
```bash
# Create a simple test image with text
cat > /tmp/test.png <<'EOF'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
EOF
# (This is a base64-encoded 1x1 red pixel - replace with actual screenshot)
```

Test caption generation:
```bash
# Encode image to base64
base64_image=$(base64 /tmp/test.png)

# Send to Ollama
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"moondream:latest\",
    \"prompt\": \"Describe this image briefly.\",
    \"images\": [\"$base64_image\"],
    \"stream\": false
  }"
```

**Expected response** (takes 90-300 seconds on CPU):
```json
{
  "response": "A red pixel.",
  "done": true,
  "total_duration": 95234567890,
  "eval_count": 3
}
```

---

### Step 5: Test in ArkAngel

Now that Ollama is running, test the full integration:

1. **Ensure ArkAngel is running**:
   ```bash
   # Should already be running at http://localhost:1420
   # If not, start with: npm run tauri dev
   ```

2. **Open ArkAngel** in browser/app

3. **Submit a test prompt**:
   - Type: "Test screenshot with VLM caption"
   - Press Enter

4. **Watch the console/logs**:
   ```bash
   # In a separate terminal, watch the logs
   tail -f /tmp/arkangel-updated.log | grep -E "(Screenshot|VLM)"
   ```

   **Expected log output**:
   ```
   [Screenshot] Starting capture with auto-caption (local Ollama VLM)...
   [Screenshot] Captured: workflows/screenshot_abc123.png
   [VLM] Starting Ollama caption generation for: workflows/screenshot_abc123.png
   [VLM] Using model: moondream:latest at http://localhost:11434
   [VLM] Image encoded, size: 245678 bytes
   [VLM] Sending request to Ollama...
   (90-300 second wait here - Moondream inference)
   [VLM] Response received in 95.34s
   [VLM] Caption generated successfully:
   [VLM]   Model: moondream:latest
   [VLM]   Tokens: 38
   [VLM]   Duration: 95.34s
   [VLM]   Caption length: 156 chars
   [VLM]   Caption preview: A screenshot showing the ArkAngel application interface with a chat window, text input...
   [Screenshot] Caption generated: A screenshot showing the ArkAngel applicat...
   ```

5. **Navigate to Photos**:
   - Click Advanced Settings → Hamburger menu → Photos
   - Should see new screenshot with caption

6. **Click the screenshot**:
   - Full caption should display in "VLM Caption" section
   - Generation timestamp should show

---

## Performance Optimization

### Current Performance (CPU)
- Screenshot capture: ~10ms
- Base64 encoding: ~50ms
- Network (localhost): ~10ms
- **Moondream inference: 80,000-300,000ms (80-300 seconds)** ⬅ Bottleneck
- **Total: ~90-300 seconds per screenshot**

### GPU Acceleration (20-90x Faster!)

If you have an NVIDIA GPU:

```bash
# Stop current Ollama
pkill ollama  # or: docker stop ollama

# Install NVIDIA Docker runtime (if using Docker)
brew install nvidia-container-toolkit  # macOS with NVIDIA eGPU
# OR follow: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html

# Start GPU-accelerated Ollama
docker run -d \
  --name ollama \
  --gpus all \
  -p 11434:11434 \
  -v ollama-data:/root/.ollama \
  ollama/ollama:latest

# Pull model again
docker exec ollama ollama pull moondream:latest

# Test - should now take 3-5 seconds instead of 90+!
```

**Performance with GPU**:
- Screenshot capture: ~10ms
- Base64 encoding: ~50ms
- Network (localhost): ~10ms
- **Moondream inference: 3,000-5,000ms (3-5 seconds)** ✅
- **Total: ~3-5 seconds per screenshot**

---

## Alternative Models

### Faster Model: Moondream 4-bit
```bash
ollama pull moondream:4bit
# 800MB instead of 1.7GB
# 2x faster inference
# Slightly lower quality
```

Update in code to use:
```typescript
// In useCompletion.ts
const ollamaModel = 'moondream:4bit';
```

### Higher Quality: LLaVA 7B
```bash
ollama pull llava:7b
# 4.7GB model
# Better descriptions
# 50% slower than Moondream
```

### Best Quality: Llama 3.2 Vision
```bash
ollama pull llama3.2-vision:11b
# 7.8GB model
# Highest quality captions
# 2-3x slower than Moondream
```

---

## Troubleshooting

### Issue 1: "Cannot connect to Ollama"

**Symptoms**:
- Console shows: `[Screenshot] Auto-caption failed (Ollama not running?)`
- Screenshots captured but no captions

**Fix**:
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# If not running, start it:
ollama serve &

# Verify:
curl http://localhost:11434/api/tags
```

---

### Issue 2: "Model not found: moondream:latest"

**Symptoms**:
- Ollama responds but says model doesn't exist

**Fix**:
```bash
# Pull the model
ollama pull moondream:latest

# Verify
ollama list
# Should show moondream:latest
```

---

### Issue 3: Very slow inference (10+ minutes)

**Symptoms**:
- Caption takes longer than 5 minutes
- System becomes unresponsive

**Possible causes**:
1. CPU too slow (old MacBook, limited cores)
2. RAM insufficient (model needs 4-8GB free)
3. Thermal throttling

**Fixes**:
```bash
# Check CPU usage
top -l 1 | grep "CPU usage"

# Check memory
vm_stat | grep "Pages free"

# Use smaller model
ollama pull moondream:4bit

# Or use GPU acceleration (see above)
```

---

### Issue 4: Timeout after 10 minutes

**Symptoms**:
- Error: "Ollama request timeout after 10 minutes"

**Fix (temporary workaround)**:

Edit `src-tauri/src/vlm_captioner.rs` line 337:
```rust
// Increase timeout from 600 to 1200 seconds (20 minutes)
.timeout(std::time::Duration::from_secs(1200))
```

Then recompile:
```bash
cd /Users/nadavshanun/Downloads/ArkAngel2/src-tauri
cargo build
```

---

### Issue 5: Caption quality is poor

**Symptoms**:
- Captions are generic or inaccurate
- Missing important details

**Fixes**:
1. **Use higher quality model**:
   ```bash
   ollama pull llava:7b
   # or
   ollama pull llama3.2-vision:11b
   ```

2. **Increase screenshot resolution**:
   Edit `src-tauri/src/screenshot_manager.rs` line 10:
   ```rust
   const MAX_WIDTH: u32 = 2560; // Instead of 1920
   ```

3. **Adjust prompt** (make more specific):
   Edit `src-tauri/src/vlm_captioner.rs` line 293-298

---

## Monitoring and Debugging

### Watch Ollama Logs
```bash
# Native Ollama
tail -f ~/.ollama/logs/server.log

# Docker Ollama
docker logs -f ollama
```

### Watch ArkAngel Logs
```bash
# Screenshot and VLM activity
tail -f /tmp/arkangel-updated.log | grep -E "(Screenshot|VLM)"

# All activity
tail -f /tmp/arkangel-updated.log
```

### Check Ollama Status
```bash
# List models
curl http://localhost:11434/api/tags | jq '.models[].name'

# Check Ollama version
curl http://localhost:11434/api/version
```

---

## Configuration Reference

### Current Settings

**Backend** (`src-tauri/src/vlm_captioner.rs`):
- Default Ollama URL: `http://localhost:11434`
- Default model: `moondream:latest`
- Timeout: 600 seconds (10 minutes)
- Temperature: 0.7
- Top-P: 0.9
- Top-K: 40
- Max tokens: 150

**Frontend** (`src/hooks/useCompletion.ts`):
- Ollama URL source: `settings?.ollamaUrl` or `'http://localhost:11434'`
- Fallback behavior: Capture without caption if Ollama fails

---

## Testing Checklist

- [ ] Ollama installed (native or Docker)
- [ ] Ollama service running (`curl http://localhost:11434/api/tags`)
- [ ] Moondream model pulled (`ollama list`)
- [ ] Test Ollama directly (curl test)
- [ ] ArkAngel app running (`http://localhost:1420`)
- [ ] Submit test prompt in ArkAngel
- [ ] Wait 90-300 seconds for caption
- [ ] Check logs for VLM activity
- [ ] Navigate to Photos section
- [ ] Verify caption displays in grid
- [ ] Click photo, verify full caption in panel
- [ ] Test without Ollama (should capture without caption)

---

## Next Steps After Testing

1. **Add Settings UI** for Ollama configuration:
   - Ollama URL input
   - Model selection dropdown
   - Test connection button

2. **Add progress indicator**:
   - Show "Generating caption..." during 90s wait
   - Progress bar or spinner

3. **Add model management**:
   - Download models from UI
   - Switch models dynamically
   - Show model status (loaded/not loaded)

4. **Optimize performance**:
   - GPU detection and auto-enable
   - Model quantization options
   - Batch processing for multiple screenshots

---

## Quick Reference Commands

```bash
# Start Ollama
ollama serve &

# Pull model
ollama pull moondream:latest

# List models
ollama list

# Test Ollama
curl http://localhost:11434/api/tags

# Watch logs
tail -f /tmp/arkangel-updated.log | grep VLM

# Stop Ollama
pkill ollama
```

---

## Expected Results After Setup

✅ **Screenshot captured** in `workflows/screenshot_*.png`
✅ **VLM caption generated** in 90-300 seconds (CPU) or 3-5 seconds (GPU)
✅ **Caption stored** in `workflows/index.json`
✅ **Caption displayed** in Photos section grid
✅ **Full caption shown** in metadata panel when clicking photo
✅ **100% free, 100% private, 100% offline**

---

**Setup Guide Complete**
**Ready to install Ollama and test VLM integration!** 🎉
