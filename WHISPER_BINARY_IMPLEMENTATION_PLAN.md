# Whisper.cpp Pre-built Binary Implementation Plan

**Goal**: Fast on-device transcription with real-time word-by-word streaming

**Status**: Ready to implement

---

## 📋 Step-by-Step Plan

### Phase 1: Download & Setup (15 min)

#### Step 1.1: Get whisper.cpp Binary for Mac
- Download from: https://github.com/ggerganov/whisper.cpp/releases
- Or build locally with: `git clone + make`
- Target: `main` executable for ARM Mac
- Location: `src-tauri/binaries/whisper-mac-arm64`

#### Step 1.2: Download Whisper Model
- Model: `ggml-base.en.bin` (142 MB, best balance)
- Alternative: `ggml-tiny.en.bin` (75 MB, faster but less accurate)
- Download from: https://huggingface.co/ggerganov/whisper.cpp
- Location: `src-tauri/models/ggml-base.en.bin`

#### Step 1.3: Create Directory Structure
```
src-tauri/
├── binaries/
│   └── whisper-mac-arm64 (executable)
├── models/
│   └── ggml-base.en.bin
└── src/
    └── whisper_local.rs (new)
```

---

### Phase 2: Rust Integration (20 min)

#### Step 2.1: Create whisper_local.rs Module
**Purpose**: Wrapper around whisper.cpp binary

**Key Functions**:
```rust
pub struct WhisperLocal {
    binary_path: PathBuf,
    model_path: PathBuf,
}

impl WhisperLocal {
    pub fn new() -> Result<Self>
    pub fn transcribe_file(&self, audio_path: &Path) -> Result<String>
    pub fn transcribe_stream(&self, audio_data: Vec<f32>) -> Result<String>
}
```

**Features**:
- Save audio to temp file
- Call whisper binary with args: `./whisper -m model.bin -f audio.wav`
- Parse stdout for transcription
- Clean up temp files
- Log everything

#### Step 2.2: Add Tauri Commands
```rust
#[tauri::command]
async fn transcribe_local(audio_data: Vec<f32>, app: tauri::AppHandle) -> Result<String, String>

#[tauri::command]
fn is_local_transcription_available() -> Result<bool, String>
```

#### Step 2.3: Update lib.rs
- Add `mod whisper_local;`
- Register commands in invoke_handler
- Initialize WhisperLocal in setup

---

### Phase 3: Frontend Real-Time Streaming (15 min)

#### Step 3.1: Modify Speech.tsx
**Current**: Waits for full sentence (onSpeechEnd)
**New**: Process chunks in real-time (onSpeechChunk)

**Changes**:
```typescript
// OLD: Wait for speech to end
onSpeechEnd: async (audio) => {
  const transcription = await transcribeAudio(audio, apiKey);
  submit(transcription);
}

// NEW: Process chunks in real-time
const [partialTranscription, setPartialTranscription] = useState("");

onSpeechStart: () => {
  setPartialTranscription("");
}

onSpeechChunk: async (audio) => {
  // Transcribe this chunk
  const text = await invoke('transcribe_local', { audioData: Array.from(audio) });

  // Append to partial transcription
  setPartialTranscription(prev => prev + " " + text);

  // Update UI in real-time (show what's being transcribed)
  // Don't submit yet
}

onSpeechEnd: () => {
  // Submit complete transcription
  submit(partialTranscription);
  setPartialTranscription("");
}
```

#### Step 3.2: Add Visual Feedback
- Show partial transcription above input field
- Highlight new words as they appear
- Fade out when complete

---

### Phase 4: Testing & Optimization (10 min)

#### Step 4.1: Test Basic Transcription
- Click mic button
- Say: "Testing one two three"
- Verify: Words appear one by one
- Verify: Fast (< 500ms per word)

#### Step 4.2: Test Accuracy
- Long sentences
- Technical words
- Background noise
- Multiple speakers

#### Step 4.3: Optimize Performance
- Chunk size tuning (smaller = faster but less accurate)
- Model selection (tiny vs base vs small)
- Thread count adjustment
- Memory management

---

## 🔧 Technical Details

### Whisper.cpp Command Format
```bash
./whisper \
  -m models/ggml-base.en.bin \
  -f audio.wav \
  -t 4 \              # 4 threads
  -l en \             # English
  --no-timestamps \   # No timestamps in output
  --print-colors \    # Better logging
  -nt                 # No timestamps in output
```

### Expected Output
```
[00:00:00.000 --> 00:00:03.000]  This is a test transcription
```

### Parsing Strategy
- Read stdout line by line
- Extract text after timestamp
- Remove whitespace
- Return clean text

---

## 📦 Bundling with Tauri

### tauri.conf.json Updates
```json
{
  "tauri": {
    "bundle": {
      "resources": [
        "binaries/whisper-mac-arm64",
        "models/ggml-base.en.bin"
      ],
      "externalBin": [
        "binaries/whisper-mac-arm64"
      ]
    }
  }
}
```

### Runtime Path Resolution
```rust
// Get bundled resource path
let binary_path = app_handle
    .path_resolver()
    .resolve_resource("binaries/whisper-mac-arm64")
    .expect("Failed to resolve whisper binary");

let model_path = app_handle
    .path_resolver()
    .resolve_resource("models/ggml-base.en.bin")
    .expect("Failed to resolve whisper model");
```

---

## 🎯 Success Criteria

### Must Have
- ✅ Binary executes successfully
- ✅ Model loads correctly
- ✅ Transcription works (any speed)
- ✅ No OpenAI API calls
- ✅ Logs show activity

### Should Have
- ✅ Real-time word-by-word display
- ✅ < 1 second latency per chunk
- ✅ 90%+ accuracy on clear speech
- ✅ No crashes on long audio

### Nice to Have
- ⭐ < 500ms latency
- ⭐ Background noise handling
- ⭐ Multiple language support
- ⭐ Confidence scores per word

---

## 🚨 Potential Issues & Solutions

### Issue 1: Binary Permission Denied
**Solution**: `chmod +x binaries/whisper-mac-arm64`

### Issue 2: Model Not Found
**Solution**: Verify model path, download if missing

### Issue 3: Slow Transcription
**Solution**: Use smaller model (tiny vs base)

### Issue 4: Audio Format Mismatch
**Solution**: Convert to 16kHz mono WAV before calling binary

### Issue 5: Temp File Cleanup
**Solution**: Use Rust tempfile crate for automatic cleanup

---

## 📊 Performance Estimates

### Model Comparison (Mac M1)
| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny.en | 75 MB | ~0.3s/sec | 85% |
| base.en | 142 MB | ~0.6s/sec | 92% |
| small.en | 466 MB | ~1.5s/sec | 96% |

**Recommendation**: Start with base.en, switch to tiny.en if too slow

### Expected Latency
- **Chunk processing**: 300-600ms
- **Full sentence**: 1-2 seconds
- **Network (current)**: 3-5 seconds

**Improvement**: 3-5x faster than OpenAI API

---

## 🏁 Implementation Order

1. ✅ Create plan (this file)
2. ⏭️ Download binary and model
3. ⏭️ Create whisper_local.rs
4. ⏭️ Add Tauri commands
5. ⏭️ Update Speech.tsx for streaming
6. ⏭️ Test basic transcription
7. ⏭️ Optimize chunk size
8. ⏭️ Add visual feedback
9. ⏭️ Final testing

**Estimated Total Time**: 60 minutes

---

## 📝 Files to Create/Modify

### New Files
- `src-tauri/src/whisper_local.rs` (200+ lines)
- `src-tauri/binaries/whisper-mac-arm64` (download)
- `src-tauri/models/ggml-base.en.bin` (download)
- `WHISPER_BINARY_IMPLEMENTATION_PLAN.md` (this file)

### Modified Files
- `src-tauri/src/lib.rs` (add module, commands)
- `src-tauri/tauri.conf.json` (bundle resources)
- `src-tauri/Cargo.toml` (add tempfile dependency)
- `src/components/completion/Speech.tsx` (real-time streaming)
- `src/lib/api.ts` (add local transcription function)

---

## ✅ Ready to Proceed

All steps are clearly defined. Starting implementation now...
