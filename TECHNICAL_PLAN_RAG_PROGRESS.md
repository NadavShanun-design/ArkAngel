# Technical Plan: Real-Time RAG Persona Creation with Visible Progress

**Date:** October 22, 2025
**Goal:** Show real-time, visible progress updates during RAG persona creation
**Status:** Detailed implementation plan

---

## Problem Analysis

### Current Issues:
1. ❌ Progress stuck at 0%
2. ❌ No visible feedback about what's happening
3. ❌ Console logs hidden (user has to switch to Console tab)
4. ❌ Backend may be failing silently
5. ❌ User can't see if anything is actually working

### What User Wants:
1. ✅ Real-time status updates visible in the UI
2. ✅ See exactly what the code is doing at each step
3. ✅ Know that something is actually happening (not fake progress)
4. ✅ Clear error messages if something fails
5. ✅ Professional pipeline implementation like LlamaIndex

---

## Research Findings

### Modern RAG Pipeline Patterns (2025):

1. **Streaming Progress Updates**
   - Use event emitters to send real-time updates from backend to frontend
   - Update UI immediately as each step completes
   - Show step-by-step status messages

2. **LlamaIndex Ingestion Pipeline**
   - Tracks each transformation step
   - Caches processed nodes
   - Detects changes incrementally
   - Reports progress through callbacks

3. **Tauri Event System**
   - Use `app.emit_all("event_name", payload)` in Rust
   - Listen with `listen("event_name", callback)` in TypeScript
   - Fast, ordered, real-time communication
   - Perfect for progress updates

---

## Technical Solution

### Architecture:

```
┌─────────────────────────────────────────────┐
│          Frontend (TypeScript)              │
│                                             │
│  1. User clicks "Create Persona"            │
│  2. Call invoke('create_rag_persona')       │
│  3. Listen to 'rag_progress' events         │
│  4. Update UI with each event               │
│     - Status text                           │
│     - Progress percentage                   │
│     - Current step details                  │
│  5. Show success/error when complete        │
└─────────────────────────────────────────────┘
                    ▲
                    │ Events
                    │
┌─────────────────────────────────────────────┐
│           Backend (Rust)                    │
│                                             │
│  1. Receive create_rag_persona command      │
│  2. Emit: "Validating training data..." 10% │
│  3. Emit: "Loading training items..." 30%   │
│  4. Emit: "Extracting text content..." 50%  │
│  5. Emit: "Creating persona file..." 70%    │
│  6. Emit: "Saving to disk..." 90%           │
│  7. Emit: "Complete!" 100%                  │
│  8. Return persona object                   │
└─────────────────────────────────────────────┘
```

---

## Implementation Steps

### Phase 1: Backend Progress Emitter (Rust)

**File:** `src-tauri/src/simple_rag_manager.rs`

**Changes:**

1. **Add AppHandle parameter** to `create_persona()`
   ```rust
   pub fn create_persona(
       &self,
       name: String,
       description: String,
       training_item_ids: Vec<String>,
       app_handle: tauri::AppHandle,  // NEW
   ) -> Result<SimpleRagPersona>
   ```

2. **Define Progress Event Payload**
   ```rust
   #[derive(Debug, Serialize, Clone)]
   struct RagProgressEvent {
       status: String,      // "Loading training items..."
       step: u32,           // 1, 2, 3, 4, 5
       total_steps: u32,    // 5
       percentage: u32,     // 20, 40, 60, 80, 100
       details: Option<String>, // Additional info
   }
   ```

3. **Emit events at each step**
   ```rust
   // Step 1: Validate (20%)
   app_handle.emit_all("rag_progress", RagProgressEvent {
       status: "Validating training data...".to_string(),
       step: 1,
       total_steps: 5,
       percentage: 20,
       details: Some(format!("{} items selected", training_item_ids.len())),
   })?;

   // Step 2: Load metadata (40%)
   app_handle.emit_all("rag_progress", RagProgressEvent {
       status: "Loading training items...".to_string(),
       step: 2,
       total_steps: 5,
       percentage: 40,
       details: None,
   })?;

   // Step 3: Extract text (60%)
   app_handle.emit_all("rag_progress", RagProgressEvent {
       status: "Extracting text content...".to_string(),
       step: 3,
       total_steps: 5,
       percentage: 60,
       details: Some(format!("Processing {} items", training_item_ids.len())),
   })?;

   // Step 4: Create persona (80%)
   app_handle.emit_all("rag_progress", RagProgressEvent {
       status: "Creating persona file...".to_string(),
       step: 4,
       total_steps: 5,
       percentage: 80,
       details: Some(format!("Persona: {}", name)),
   })?;

   // Step 5: Save (100%)
   app_handle.emit_all("rag_progress", RagProgressEvent {
       status: "Persona created successfully!".to_string(),
       step: 5,
       total_steps: 5,
       percentage: 100,
       details: Some(format!("ID: {}", id)),
   })?;
   ```

**File:** `src-tauri/src/lib.rs`

**Changes:**

1. **Update command signature**
   ```rust
   #[tauri::command]
   async fn create_rag_persona(
       name: String,
       description: String,
       training_item_ids: Vec<String>,
       app_handle: tauri::AppHandle,  // NEW
   ) -> Result<simple_rag_manager::SimpleRagPersona, String> {
       let manager = simple_rag_manager::SimpleRagManager::new()
           .map_err(|e| format!("Failed to initialize RAG manager: {}", e))?;

       manager.create_persona(name, description, training_item_ids, app_handle)
           .map_err(|e| format!("Failed to create RAG persona: {}", e))
   }
   ```

---

### Phase 2: Frontend Progress Listener (TypeScript)

**File:** `src/components/training/CreatePersonaWizard.tsx`

**Changes:**

1. **Import event listener**
   ```typescript
   import { listen, UnlistenFn } from '@tauri-apps/api/event';
   ```

2. **Add state for detailed status**
   ```typescript
   const [statusMessage, setStatusMessage] = useState<string>('');
   const [statusDetails, setStatusDetails] = useState<string | null>(null);
   const [currentStep, setCurrentStep] = useState<number>(0);
   const [totalSteps, setTotalSteps] = useState<number>(5);
   ```

3. **Set up event listener**
   ```typescript
   const handleCreatePersona = async () => {
     console.log('[CreatePersona] Starting persona creation...');

     setProcessing(true);
     setProgress(0);
     setStep(3); // Move to progress screen
     setError(null);
     setStatusMessage('Initializing...');
     setStatusDetails(null);

     // Listen for progress events
     const unlisten = await listen<{
       status: string;
       step: number;
       total_steps: number;
       percentage: number;
       details: string | null;
     }>('rag_progress', (event) => {
       console.log('[CreatePersona] Progress update:', event.payload);

       // Update UI immediately
       setStatusMessage(event.payload.status);
       setStatusDetails(event.payload.details);
       setProgress(event.payload.percentage);
       setCurrentStep(event.payload.step);
       setTotalSteps(event.payload.total_steps);
     });

     try {
       const { invoke } = await import('@tauri-apps/api/core');

       const persona = await invoke<any>('create_rag_persona', {
         name: personaName,
         description: personaDescription,
         trainingItemIds: Array.from(selectedItems),
       });

       console.log('[CreatePersona] Persona created:', persona);
       setCreatedPersonaId(persona.id);

       // Clean up listener
       unlisten();

       // Small delay to show 100%
       setTimeout(() => {
         setStep(4);
         setProcessing(false);
       }, 500);
     } catch (err) {
       console.error('[CreatePersona] ERROR:', err);

       // Clean up listener
       unlisten();

       setError(err instanceof Error ? err.message : String(err));
       setProcessing(false);
       setStep(2); // Back to config
     }
   };
   ```

4. **Update Step 3 render with real-time status**
   ```typescript
   const renderStep3 = () => (
     <div className="space-y-6 py-8">
       <div className="text-center">
         <Loader2 className="w-16 h-16 mx-auto text-primary animate-spin mb-4" />
         <h3 className="text-lg font-semibold mb-2">Creating RAG Persona</h3>
         <p className="text-sm text-muted-foreground">
           {statusMessage || 'Processing your training data...'}
         </p>
         {statusDetails && (
           <p className="text-xs text-muted-foreground mt-1">
             {statusDetails}
           </p>
         )}
       </div>

       <div className="space-y-2">
         <div className="flex items-center justify-between text-sm">
           <span className="text-muted-foreground">
             Step {currentStep} of {totalSteps}
           </span>
           <span className="font-medium">{progress}%</span>
         </div>
         <div className="h-2 bg-muted rounded-full overflow-hidden">
           <div
             className="h-full bg-primary transition-all duration-300"
             style={{ width: `${progress}%` }}
           />
         </div>
       </div>

       {/* Real-time step breakdown */}
       <div className="space-y-1 text-xs">
         <div className={currentStep >= 1 ? "text-primary" : "text-muted-foreground"}>
           {currentStep > 1 ? "✓" : "○"} Validating training data
         </div>
         <div className={currentStep >= 2 ? "text-primary" : "text-muted-foreground"}>
           {currentStep > 2 ? "✓" : currentStep === 2 ? "→" : "○"} Loading training items
         </div>
         <div className={currentStep >= 3 ? "text-primary" : "text-muted-foreground"}>
           {currentStep > 3 ? "✓" : currentStep === 3 ? "→" : "○"} Extracting text content
         </div>
         <div className={currentStep >= 4 ? "text-primary" : "text-muted-foreground"}>
           {currentStep > 4 ? "✓" : currentStep === 4 ? "→" : "○"} Creating persona file
         </div>
         <div className={currentStep >= 5 ? "text-primary" : "text-muted-foreground"}>
           {currentStep === 5 ? "✓" : "○"} Complete!
         </div>
       </div>
     </div>
   );
   ```

---

### Phase 3: Enhanced Error Handling

**Both Backend and Frontend:**

1. **Rust: Emit error events**
   ```rust
   if let Err(e) = result {
       app_handle.emit_all("rag_error", RagErrorEvent {
           message: format!("Failed at step {}: {}", current_step, e),
           step: current_step,
           recoverable: true,
       })?;
       return Err(e);
   }
   ```

2. **TypeScript: Listen for errors**
   ```typescript
   await listen('rag_error', (event) => {
       console.error('[CreatePersona] Backend error:', event.payload);
       setError(event.payload.message);
       setProcessing(false);
   });
   ```

---

## Detailed Step-by-Step Pipeline

### Step 1: Validate Training Data (20%)

**Backend:**
```rust
// Emit start
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Validating training data...".to_string(),
    step: 1,
    total_steps: 5,
    percentage: 20,
    details: Some(format!("{} items to process", training_item_ids.len())),
})?;

// Check if training_data directory exists
if !self.training_manager.training_dir.exists() {
    return Err(anyhow!("Training data directory not found"));
}

// Check if all selected items exist
for item_id in &training_item_ids {
    if self.training_manager.get_training_item(item_id).is_err() {
        return Err(anyhow!("Training item not found: {}", item_id));
    }
}

println!("[SimpleRAG] Validation complete: {} items", training_item_ids.len());
```

### Step 2: Load Training Items (40%)

**Backend:**
```rust
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Loading training items...".to_string(),
    step: 2,
    total_steps: 5,
    percentage: 40,
    details: Some("Reading metadata and content".to_string()),
})?;

let mut loaded_items = Vec::new();
for item_id in &training_item_ids {
    let item = self.training_manager.get_training_item(item_id)?;
    loaded_items.push(item);
}

println!("[SimpleRAG] Loaded {} items", loaded_items.len());
```

### Step 3: Extract Text Content (60%)

**Backend:**
```rust
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Extracting text content...".to_string(),
    step: 3,
    total_steps: 5,
    percentage: 60,
    details: Some(format!("Processing {} items", loaded_items.len())),
})?;

let mut total_chunks = 0;
for item in &loaded_items {
    let chunks = self.extract_chunks_from_item(item)?;
    total_chunks += chunks.len();
}

println!("[SimpleRAG] Extracted {} text chunks", total_chunks);
```

### Step 4: Create Persona Object (80%)

**Backend:**
```rust
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Creating persona file...".to_string(),
    step: 4,
    total_steps: 5,
    percentage: 80,
    details: Some(format!("Persona: {}", name)),
})?;

let id = format!("rag_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
let persona = SimpleRagPersona {
    id: id.clone(),
    name,
    description,
    created_at: Utc::now().to_rfc3339(),
    updated_at: Utc::now().to_rfc3339(),
    training_item_ids: training_item_ids.clone(),
    source_count: training_item_ids.len(),
};

println!("[SimpleRAG] Created persona object: {}", persona.id);
```

### Step 5: Save to Disk (100%)

**Backend:**
```rust
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Saving persona...".to_string(),
    step: 5,
    total_steps: 5,
    percentage: 90,
    details: Some("Writing to disk".to_string()),
})?;

let persona_file = self.rag_dir.join(format!("{}.json", id));
let json_content = serde_json::to_string_pretty(&persona)?;
fs::write(&persona_file, json_content)?;

println!("[SimpleRAG] Saved persona to: {:?}", persona_file);

// Final complete event
app_handle.emit_all("rag_progress", RagProgressEvent {
    status: "Persona created successfully!".to_string(),
    step: 5,
    total_steps: 5,
    percentage: 100,
    details: Some(format!("Ready to use: {}", persona.name)),
})?;
```

---

## Testing Plan

### Test 1: Normal Success Flow

1. Start app with dev tools
2. Go to Training → Start Training
3. Select 1 training item
4. Name: "Test Persona"
5. Click Create

**Expected UI Updates:**
```
0% → "Initializing..."
20% → "Validating training data... (1 items to process)"
40% → "Loading training items... (Reading metadata)"
60% → "Extracting text content... (Processing 1 items)"
80% → "Creating persona file... (Persona: Test Persona)"
90% → "Saving persona... (Writing to disk)"
100% → "Persona created successfully! (Ready to use: Test Persona)"
```

**Expected Console Logs:**
```
[CreatePersona] Starting persona creation...
[CreatePersona] Progress update: {status: "Validating...", percentage: 20, ...}
[CreatePersona] Progress update: {status: "Loading...", percentage: 40, ...}
[CreatePersona] Progress update: {status: "Extracting...", percentage: 60, ...}
[CreatePersona] Progress update: {status: "Creating...", percentage: 80, ...}
[CreatePersona] Progress update: {status: "Saving...", percentage: 90, ...}
[CreatePersona] Progress update: {status: "Complete!", percentage: 100, ...}
[CreatePersona] Persona created: {id: "rag_...", ...}
```

### Test 2: Error Handling (Missing Training Item)

1. Manually delete a training item file
2. Try to create persona with that item

**Expected:**
- Progress stops at validation step (20%)
- Error message: "Training item not found: training_xxx"
- Returns to config screen
- User can fix and retry

### Test 3: Multiple Items

1. Select 2-3 training items
2. Create persona

**Expected:**
- Each step shows item count in details
- Text extraction shows progress through items
- Completes successfully

---

## Benefits of This Approach

### For User:
✅ **Visible Feedback** - See exactly what's happening
✅ **Real Progress** - Not fake, tied to actual operations
✅ **Professional Feel** - Like production RAG systems
✅ **Debugging** - Easy to see where failures occur
✅ **Confidence** - Know system is working

### For Development:
✅ **Easy to Debug** - Clear logs at each step
✅ **Maintainable** - Each step isolated and testable
✅ **Extensible** - Easy to add more steps later
✅ **Standard Pattern** - Follows Tauri best practices

---

## Timeline Estimate

- **Phase 1 (Backend)**: 30-45 minutes
  - Modify `simple_rag_manager.rs` to emit events
  - Update `lib.rs` command signature
  - Test event emission

- **Phase 2 (Frontend)**: 30-45 minutes
  - Add event listeners to `CreatePersonaWizard.tsx`
  - Update UI to show real-time status
  - Style progress display

- **Phase 3 (Testing)**: 15-30 minutes
  - Test normal flow
  - Test error cases
  - Verify all events fire correctly

**Total: 1.5 - 2 hours** for complete implementation

---

## Success Criteria

- [ ] Progress bar moves from 0% → 100% in real-time
- [ ] Status text updates at each step
- [ ] Details show specific information (item counts, names)
- [ ] Step checklist shows current step with arrow (→)
- [ ] Completed steps show checkmark (✓)
- [ ] Console logs show all events
- [ ] Errors display clear messages
- [ ] Persona file created successfully
- [ ] Success screen shows after completion

---

**Ready to implement? This plan follows industry best practices and will give you the professional, real-time progress updates you want.**
