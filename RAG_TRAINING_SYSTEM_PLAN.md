# RAG Training System Implementation Plan

## Executive Summary

This document outlines the complete implementation plan for a Retrieval-Augmented Generation (RAG) training system in ArkAngel. The system will allow users to:
1. Select documents and transcripts for training
2. Create custom AI personas with RAG-backed knowledge
3. Use these personas in conversations with context-aware responses

---

## Research Findings (2025)

### Best Practices for RAG Systems

**Data Format:**
- JSON format with semantic chunking (200-300 words per chunk)
- Metadata-rich structure (source, date, type, tags)
- Vector embeddings stored alongside text

**Vector Database:**
- **FAISS** (Recommended): Faster, better for local deployment, 1.81s for 50 queries
- **ChromaDB**: Easier API, slightly slower at 2.18s for 50 queries
- Decision: Use FAISS for performance

**Embedding Model:**
- **all-MiniLM-L6-v2**: 384 dimensions, lightweight, proven
- **EmbeddingGemma**: New 2025 model, 308M params, best-in-class for local
- Decision: Start with all-MiniLM-L6-v2 for simplicity

---

## System Architecture

### Directory Structure

```
project_root/
├── training_data/          # Raw training data (already exists)
│   └── rag_training.json
│
├── rag_systems/            # NEW: RAG persona storage
│   └── [persona-id]/
│       ├── metadata.json   # Persona info, sources, created_at
│       ├── chunks.json     # All text chunks with IDs
│       ├── index.faiss     # FAISS vector index
│       ├── embeddings.npy  # Numpy array of embeddings
│       └── sources/        # Links to original documents
│           ├── documents/  # Document IDs
│           └── transcripts/# Transcript IDs
│
├── documents/              # User uploaded files
│   └── uploads/
│
└── transcripts/            # Conversation transcripts
```

### Data Flow Diagram

```
User Actions                Backend Processing              Storage
─────────────────────────────────────────────────────────────────────

1. SELECT PHASE
Documents Page          →   Mark for training          →   training_data/
  ├─ Check documents                                        rag_training.json
  └─ "Add to Training"

Transcripts Page        →   Mark for training          →   training_data/
  ├─ Check transcripts                                      rag_training.json
  └─ "Add to Training"

2. CREATE PERSONA PHASE
Training Page           →   Initialize RAG Builder     →   rag_systems/
  ├─ "Start Training"                                       [new-id]/
  ├─ Select data items
  ├─ Enter name/desc
  └─ "Create Persona"

Backend Processing:
  ├─ Load selected documents/transcripts
  ├─ Extract & clean text
  ├─ Chunk semantically (200-300 words)
  ├─ Generate embeddings (all-MiniLM-L6-v2)
  ├─ Build FAISS index
  ├─ Save metadata & chunks
  └─ Create persona entry

3. USE PERSONA PHASE
Chat Interface          →   Query RAG System           →   Context Injection
  ├─ Select RAG persona
  ├─ User sends message
  └─ AI responds with
      relevant context

Backend Processing:
  ├─ Embed user query
  ├─ Search FAISS index (top-k=5)
  ├─ Retrieve relevant chunks
  ├─ Inject into system prompt
  └─ Send to LLM API
```

---

## Implementation Phases

## PHASE 1: Documents "Add to Training" Feature

### 1.1 Frontend Changes

**File:** `src/components/advanced/AdvancedSettingsPage.tsx` (DocumentsSection)

**Add State:**
```typescript
const [selectionMode, setSelectionMode] = useState(false);
const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
const [saving, setSaving] = useState(false);
const [saveSuccess, setSaveSuccess] = useState(false);
```

**Add UI Elements:**
- "Add to Training" button (like transcripts)
- Checkbox for each document when in selection mode
- Save button that appears when documents are selected
- Success/error messages

**Functions to Add:**
```typescript
const toggleSelectionMode = () => { ... }
const toggleDocSelection = (docId: string) => { ... }
const handleSaveToTraining = async () => { ... }
```

### 1.2 Backend Changes

**File:** `src-tauri/src/training_data_manager.rs`

**Add Functions:**
```rust
pub fn add_document_to_training(
    &self,
    doc_id: String,
    doc_name: String,
    content: String,
    file_type: String,
    size: u64,
) -> Result<TrainingDataItem>

pub fn add_multiple_documents(
    &self,
    documents: Vec<(String, String, String, String, u64)>
) -> Result<Vec<TrainingDataItem>>
```

**File:** `src-tauri/src/lib.rs`

**Add Tauri Commands:**
```rust
#[tauri::command]
async fn add_document_to_training(...) -> Result<TrainingDataItem, String>

#[tauri::command]
async fn add_multiple_documents_to_training(...) -> Result<Vec<TrainingDataItem>, String>
```

---

## PHASE 2: Training Page Enhancements

### 2.1 Add Data Type Filters

**File:** `src/components/advanced/AdvancedSettingsPage.tsx` (TrainingSection)

**Add State:**
```typescript
type DataTypeFilter = 'all' | 'documents' | 'transcripts';
const [filterType, setFilterType] = useState<DataTypeFilter>('all');
```

**Add UI:**
```tsx
<div className="flex gap-2 mb-4">
  <Button
    variant={filterType === 'all' ? 'default' : 'outline'}
    onClick={() => setFilterType('all')}
  >
    All ({trainingItems.length})
  </Button>
  <Button
    variant={filterType === 'documents' ? 'default' : 'outline'}
    onClick={() => setFilterType('documents')}
  >
    Documents ({trainingItems.filter(i => i.source_type === 'document').length})
  </Button>
  <Button
    variant={filterType === 'transcripts' ? 'default' : 'outline'}
    onClick={() => setFilterType('transcripts')}
  >
    Transcripts ({trainingItems.filter(i => i.source_type === 'transcript').length})
  </Button>
</div>
```

### 2.2 Add "Start Training" Button

**Add to TrainingSection header:**
```tsx
<div className="flex items-center justify-between">
  <div>
    <h2>Training Data</h2>
    <p>...</p>
  </div>
  <div className="flex gap-2">
    <Button
      onClick={() => setShowCreatePersonaWizard(true)}
      disabled={trainingItems.length === 0}
    >
      <Plus className="w-4 h-4 mr-1" />
      Start Training
    </Button>
    {trainingItems.length > 0 && (
      <Button onClick={handleClearAll} variant="destructive">
        <Trash2 className="w-4 h-4 mr-1" />
        Clear All
      </Button>
    )}
  </div>
</div>
```

---

## PHASE 3: Create Persona Wizard

### 3.1 Wizard Component Structure

**New File:** `src/components/training/CreatePersonaWizard.tsx`

**Steps:**
1. **Select Training Data** - Checkboxes for documents & transcripts
2. **Configure Persona** - Name, description, avatar (optional)
3. **Processing** - Show progress of RAG creation
4. **Success** - Show completion, link to use persona

**Component:**
```tsx
export const CreatePersonaWizard: React.FC<{
  trainingItems: TrainingDataItem[];
  onClose: () => void;
  onComplete: (personaId: string) => void;
}> = ({ trainingItems, onClose, onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [personaName, setPersonaName] = useState('');
  const [personaDescription, setPersonaDescription] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Step 1: Select Data
  // Step 2: Configure
  // Step 3: Create RAG
  // Step 4: Success
};
```

### 3.2 Backend RAG System Manager

**New File:** `src-tauri/src/rag_system_manager.rs`

**Key Structures:**
```rust
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagPersona {
    pub id: String,
    pub name: String,
    pub description: String,
    pub avatar_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub source_count: usize,
    pub chunk_count: usize,
    pub embedding_model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RagChunk {
    pub id: String,
    pub text: String,
    pub source_id: String,
    pub source_type: String, // "document" | "transcript"
    pub source_name: String,
    pub chunk_index: usize,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RagMetadata {
    pub persona: RagPersona,
    pub sources: Vec<RagSource>,
    pub embedding_config: EmbeddingConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RagSource {
    pub id: String,
    pub source_type: String,
    pub name: String,
    pub added_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub model: String, // "all-MiniLM-L6-v2"
    pub dimensions: usize, // 384
    pub chunk_size: usize, // 300 words
    pub chunk_overlap: usize, // 50 words
}

pub struct RagSystemManager {
    rag_systems_dir: PathBuf,
}
```

**Key Functions:**
```rust
impl RagSystemManager {
    pub fn new() -> Result<Self>;

    // Create new RAG system
    pub fn create_rag_persona(
        &self,
        name: String,
        description: String,
        training_item_ids: Vec<String>,
    ) -> Result<RagPersona>;

    // Process and chunk documents
    fn process_training_items(
        &self,
        item_ids: Vec<String>,
    ) -> Result<Vec<RagChunk>>;

    // Generate embeddings (calls Python script)
    fn generate_embeddings(
        &self,
        chunks: Vec<RagChunk>,
    ) -> Result<Vec<Vec<f32>>>;

    // Build FAISS index (calls Python script)
    fn build_faiss_index(
        &self,
        persona_id: &str,
        embeddings: Vec<Vec<f32>>,
    ) -> Result<()>;

    // Save metadata and chunks
    fn save_rag_system(
        &self,
        persona: &RagPersona,
        chunks: Vec<RagChunk>,
        sources: Vec<RagSource>,
    ) -> Result<()>;

    // List all RAG personas
    pub fn list_rag_personas(&self) -> Result<Vec<RagPersona>>;

    // Query RAG system
    pub fn query_rag(
        &self,
        persona_id: &str,
        query: String,
        top_k: usize,
    ) -> Result<Vec<RagChunk>>;

    // Delete RAG system
    pub fn delete_rag_persona(&self, persona_id: &str) -> Result<()>;
}
```

---

## PHASE 4: Python Embedding Service

### 4.1 Embedding Script

**New File:** `sidecar/python_embeddings/embedding_service.py`

**Purpose:** Generate embeddings and manage FAISS index

**Dependencies:**
```python
# requirements.txt
sentence-transformers==2.6.0
faiss-cpu==1.7.4
numpy==1.26.4
```

**Main Script:**
```python
import sys
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss

class EmbeddingService:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        self.dimension = 384

    def generate_embeddings(self, texts):
        """Generate embeddings for a list of texts"""
        embeddings = self.model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()

    def create_faiss_index(self, embeddings, output_path):
        """Create and save FAISS index"""
        embeddings_np = np.array(embeddings).astype('float32')

        # Create FAISS index (L2 distance)
        index = faiss.IndexFlatL2(self.dimension)
        index.add(embeddings_np)

        # Save index
        faiss.write_index(index, output_path)
        return True

    def search_similar(self, index_path, query_embedding, top_k=5):
        """Search for similar embeddings"""
        # Load index
        index = faiss.read_index(index_path)

        # Search
        query_np = np.array([query_embedding]).astype('float32')
        distances, indices = index.search(query_np, top_k)

        return {
            'indices': indices[0].tolist(),
            'distances': distances[0].tolist()
        }

if __name__ == '__main__':
    command = sys.argv[1]
    service = EmbeddingService()

    if command == 'embed':
        # Read texts from stdin
        texts = json.loads(sys.stdin.read())
        embeddings = service.generate_embeddings(texts)
        print(json.dumps(embeddings))

    elif command == 'create_index':
        embeddings_path = sys.argv[2]
        output_path = sys.argv[3]

        with open(embeddings_path, 'r') as f:
            embeddings = json.load(f)

        service.create_faiss_index(embeddings, output_path)
        print(json.dumps({'success': True}))

    elif command == 'search':
        index_path = sys.argv[2]
        query_embedding_path = sys.argv[3]
        top_k = int(sys.argv[4]) if len(sys.argv) > 4 else 5

        with open(query_embedding_path, 'r') as f:
            query_embedding = json.load(f)

        results = service.search_similar(index_path, query_embedding, top_k)
        print(json.dumps(results))
```

### 4.2 Rust-Python Integration

**File:** `src-tauri/src/rag_system_manager.rs`

**Add Helper Functions:**
```rust
use std::process::Command;

impl RagSystemManager {
    fn call_python_embeddings(
        &self,
        texts: Vec<String>,
    ) -> Result<Vec<Vec<f32>>> {
        let python_script = self.get_embedding_script_path();

        let mut child = Command::new("python3")
            .arg(&python_script)
            .arg("embed")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()?;

        // Write texts to stdin as JSON
        {
            let stdin = child.stdin.as_mut()
                .ok_or_else(|| anyhow!("Failed to open stdin"))?;
            serde_json::to_writer(stdin, &texts)?;
        }

        // Read embeddings from stdout
        let output = child.wait_with_output()?;
        let embeddings: Vec<Vec<f32>> = serde_json::from_slice(&output.stdout)?;

        Ok(embeddings)
    }

    fn call_python_create_index(
        &self,
        embeddings_path: &Path,
        output_path: &Path,
    ) -> Result<()> {
        let python_script = self.get_embedding_script_path();

        let output = Command::new("python3")
            .arg(&python_script)
            .arg("create_index")
            .arg(embeddings_path)
            .arg(output_path)
            .output()?;

        if !output.status.success() {
            return Err(anyhow!("Failed to create FAISS index"));
        }

        Ok(())
    }

    fn call_python_search(
        &self,
        index_path: &Path,
        query_embedding: Vec<f32>,
        top_k: usize,
    ) -> Result<(Vec<usize>, Vec<f32>)> {
        // Save query embedding to temp file
        let query_path = self.rag_systems_dir.join("temp_query.json");
        std::fs::write(&query_path, serde_json::to_string(&query_embedding)?)?;

        let python_script = self.get_embedding_script_path();

        let output = Command::new("python3")
            .arg(&python_script)
            .arg("search")
            .arg(index_path)
            .arg(&query_path)
            .arg(top_k.to_string())
            .output()?;

        if !output.status.success() {
            return Err(anyhow!("Failed to search FAISS index"));
        }

        let result: serde_json::Value = serde_json::from_slice(&output.stdout)?;
        let indices: Vec<usize> = serde_json::from_value(result["indices"].clone())?;
        let distances: Vec<f32> = serde_json::from_value(result["distances"].clone())?;

        Ok((indices, distances))
    }
}
```

---

## PHASE 5: RAG Query Integration

### 5.1 Add RAG Field to Personas

**File:** `src/types/index.ts`

**Update Persona Type:**
```typescript
export interface Persona {
  id: string;
  name: string;
  prompt: string;
  summary: string;
  isDefault: boolean;
  ragEnabled?: boolean;        // NEW
  ragSystemId?: string;        // NEW
  ragQueryTopK?: number;       // NEW (default 5)
}
```

### 5.2 Query RAG Before Sending Message

**File:** `src/hooks/useCompletion.ts`

**Modify sendMessage function:**
```typescript
const sendMessage = async (content: string) => {
  // ... existing code ...

  // NEW: Check if current persona has RAG enabled
  if (currentPersona.ragEnabled && currentPersona.ragSystemId) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      // Query RAG system
      const ragResults = await invoke<RagChunk[]>('query_rag_system', {
        personaId: currentPersona.ragSystemId,
        query: content,
        topK: currentPersona.ragQueryTopK || 5
      });

      // Build context from RAG results
      const context = ragResults.map((chunk, i) =>
        `[Context ${i + 1} from ${chunk.source_name}]:\n${chunk.text}`
      ).join('\n\n');

      // Inject context into system message
      const systemWithContext = `${currentPersona.prompt}\n\n` +
        `You have access to the following relevant information:\n\n${context}\n\n` +
        `Use this information to provide accurate, contextual responses.`;

      // Use systemWithContext instead of currentPersona.prompt
      messages[0].content = systemWithContext;
    } catch (error) {
      console.error('RAG query failed:', error);
      // Continue without RAG if it fails
    }
  }

  // ... continue with existing send logic ...
};
```

### 5.3 Backend Query Function

**File:** `src-tauri/src/rag_system_manager.rs`

**Implement query_rag:**
```rust
pub fn query_rag(
    &self,
    persona_id: &str,
    query: String,
    top_k: usize,
) -> Result<Vec<RagChunk>> {
    // 1. Load persona metadata
    let metadata_path = self.rag_systems_dir
        .join(persona_id)
        .join("metadata.json");
    let metadata: RagMetadata = serde_json::from_str(
        &std::fs::read_to_string(&metadata_path)?
    )?;

    // 2. Generate query embedding
    let query_embedding = self.call_python_embeddings(vec![query])?
        .into_iter()
        .next()
        .ok_or_else(|| anyhow!("No embedding generated"))?;

    // 3. Search FAISS index
    let index_path = self.rag_systems_dir
        .join(persona_id)
        .join("index.faiss");
    let (indices, distances) = self.call_python_search(
        &index_path,
        query_embedding,
        top_k,
    )?;

    // 4. Load chunks
    let chunks_path = self.rag_systems_dir
        .join(persona_id)
        .join("chunks.json");
    let all_chunks: Vec<RagChunk> = serde_json::from_str(
        &std::fs::read_to_string(&chunks_path)?
    )?;

    // 5. Return top-k chunks
    let mut results = Vec::new();
    for idx in indices {
        if let Some(chunk) = all_chunks.get(idx) {
            results.push(chunk.clone());
        }
    }

    Ok(results)
}
```

---

## PHASE 6: UI for RAG Personas

### 6.1 Add RAG Personas Section to Training Page

**File:** `src/components/advanced/AdvancedSettingsPage.tsx` (TrainingSection)

**Add at top of page:**
```tsx
{/* RAG Personas Section */}
{ragPersonas.length > 0 && (
  <div className="mb-6">
    <h3 className="text-md font-semibold mb-3">Created RAG Personas</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {ragPersonas.map((persona) => (
        <SpotlightArea
          key={persona.id}
          className="p-4 border border-input/50 rounded-md bg-background/50 hover:bg-accent/20 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-sm">{persona.name}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {persona.description}
              </p>
              <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
                <span>{persona.source_count} sources</span>
                <span>•</span>
                <span>{persona.chunk_count} chunks</span>
              </div>
            </div>
            <Button
              onClick={() => handleUsePersona(persona.id)}
              size="sm"
              variant="ghost"
            >
              Use
            </Button>
          </div>
        </SpotlightArea>
      ))}
    </div>
  </div>
)}
```

### 6.2 Link RAG Personas to Angel Profiles

**File:** `src/components/advanced/AdvancedSettingsPage.tsx` (AngelProfilesSection)

**When creating/editing persona, add RAG option:**
```tsx
<div>
  <Label className="text-sm font-medium">
    <input
      type="checkbox"
      checked={editingRagEnabled}
      onChange={(e) => setEditingRagEnabled(e.target.checked)}
    />
    <span className="ml-2">Enable RAG (Retrieval-Augmented Generation)</span>
  </Label>
  {editingRagEnabled && (
    <select
      value={editingRagSystemId}
      onChange={(e) => setEditingRagSystemId(e.target.value)}
      className="mt-2 w-full"
    >
      <option value="">Select RAG System...</option>
      {ragPersonas.map(rp => (
        <option key={rp.id} value={rp.id}>
          {rp.name} ({rp.source_count} sources)
        </option>
      ))}
    </select>
  )}
</div>
```

---

## PHASE 7: Document Processing & Chunking

### 7.1 Text Extraction Enhancement

**File:** `src-tauri/src/rag_system_manager.rs`

**Add text chunking:**
```rust
fn chunk_text(
    &self,
    text: String,
    chunk_size: usize,  // words
    chunk_overlap: usize, // words
) -> Vec<String> {
    let words: Vec<&str> = text.split_whitespace().collect();
    let mut chunks = Vec::new();

    let mut start = 0;
    while start < words.len() {
        let end = std::cmp::min(start + chunk_size, words.len());
        let chunk = words[start..end].join(" ");
        chunks.push(chunk);

        if end >= words.len() {
            break;
        }

        start = end - chunk_overlap;
    }

    chunks
}

fn process_document(
    &self,
    doc_id: String,
    content: String,
    metadata: serde_json::Value,
) -> Result<Vec<RagChunk>> {
    let config = EmbeddingConfig {
        model: "all-MiniLM-L6-v2".to_string(),
        dimensions: 384,
        chunk_size: 300,
        chunk_overlap: 50,
    };

    let text_chunks = self.chunk_text(
        content,
        config.chunk_size,
        config.chunk_overlap,
    );

    let mut rag_chunks = Vec::new();
    for (idx, text) in text_chunks.into_iter().enumerate() {
        rag_chunks.push(RagChunk {
            id: format!("{}_{}", doc_id, idx),
            text,
            source_id: doc_id.clone(),
            source_type: "document".to_string(),
            source_name: metadata.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string(),
            chunk_index: idx,
            metadata: metadata.clone(),
        });
    }

    Ok(rag_chunks)
}
```

---

## Implementation Timeline

### Week 1-2: Foundation
- ✅ Phase 1: Documents "Add to Training" feature
- ✅ Phase 2: Training page data type filters
- Set up Python embedding environment

### Week 3-4: Core RAG System
- Phase 4: Python embedding service
- Phase 4: Rust-Python integration
- Testing embedding generation & FAISS indexing

### Week 5-6: Persona Creation
- Phase 3: Create Persona Wizard UI
- Phase 7: Document processing & chunking
- Backend RAG system creation

### Week 7-8: Integration & Polish
- Phase 5: RAG query integration in chat
- Phase 6: RAG personas UI
- Testing end-to-end workflow

### Week 9-10: Optimization & Testing
- Performance optimization
- Error handling
- User testing
- Documentation

---

## Testing Strategy

### Unit Tests
- Text chunking algorithms
- Embedding generation
- FAISS index creation/search
- Document processing for different formats

### Integration Tests
- End-to-end persona creation
- RAG query during chat
- Multi-source RAG systems
- Large document handling

### User Acceptance Tests
- Create persona from documents
- Create persona from transcripts
- Create persona from mixed sources
- Use persona in conversation
- Verify context relevance

---

## Success Metrics

1. **Performance:**
   - Embedding generation: < 5s for 100 chunks
   - RAG query: < 1s for top-5 results
   - Persona creation: < 30s for 50 documents

2. **Accuracy:**
   - Retrieved chunks relevant to query: > 80%
   - Users satisfied with AI responses: > 75%

3. **Usability:**
   - Users can create persona: < 5 minutes
   - Error rate: < 5%
   - System uptime: > 99%

---

## Technical Risks & Mitigation

### Risk 1: Python Dependency
**Issue:** Users need Python + dependencies installed
**Mitigation:**
- Bundle Python embedding service in installer
- Provide clear setup documentation
- Fall back to cloud embeddings API if local fails

### Risk 2: Performance on Large Datasets
**Issue:** Slow processing for 1000+ documents
**Mitigation:**
- Progress tracking UI
- Background processing with queue
- Batch processing optimization

### Risk 3: Memory Usage
**Issue:** Large FAISS indices consume RAM
**Mitigation:**
- Use FAISS memory-mapped indices
- Limit max sources per persona
- Provide cleanup tools

### Risk 4: Embedding Model Download
**Issue:** First-time users need to download 80MB+ model
**Mitigation:**
- Show download progress
- Cache models system-wide
- Provide offline installer option

---

## Future Enhancements

1. **Advanced Retrieval:**
   - Hybrid search (keyword + semantic)
   - Re-ranking with cross-encoders
   - Multi-hop reasoning

2. **Fine-tuning:**
   - Custom embedding fine-tuning
   - User feedback loop
   - Domain adaptation

3. **Multi-modal RAG:**
   - Image embeddings
   - Audio transcription integration
   - Video frame analysis

4. **Collaborative Features:**
   - Share personas between users
   - Community persona library
   - Export/import RAG systems

---

## Conclusion

This plan provides a comprehensive roadmap for implementing a production-ready RAG training system in ArkAngel. The phased approach ensures:

1. **Progressive Enhancement:** Each phase builds on the previous
2. **Testability:** Clear testing points at each stage
3. **User Value:** Users see benefits early (Phase 1-2)
4. **Scalability:** Architecture supports future growth

**Estimated Total Timeline:** 10-12 weeks for full implementation

**Next Steps:**
1. Review and approve plan
2. Set up development environment (Python, dependencies)
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews
