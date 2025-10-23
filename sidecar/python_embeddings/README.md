# Python Embedding Service

This service handles text embedding generation and FAISS vector index management for the ArkAngel RAG system.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Or with specific Python version
python3 -m pip install -r requirements.txt
```

## Usage

The service is called via CLI from Rust. Examples:

### Generate Embeddings
```bash
echo '["Hello world", "Another text"]' | python3 embedding_service.py embed
```

### Create FAISS Index
```bash
python3 embedding_service.py create_index embeddings.json output/index.faiss
```

### Search Similar Vectors
```bash
python3 embedding_service.py search index.faiss query_embedding.json 5
```

### Get Index Info
```bash
python3 embedding_service.py info index.faiss
```

## Model

Uses `all-MiniLM-L6-v2` (384 dimensions):
- Fast inference (~50ms per text on CPU)
- Good quality embeddings for semantic search
- 80MB model size
- First run downloads model automatically to `~/.cache/torch/sentence_transformers/`

## Output Format

All commands return JSON:
- `embed`: Array of embeddings (float arrays)
- `create_index`: `{"success": true}`
- `search`: `{"indices": [0, 1, 2], "distances": [0.1, 0.2, 0.3]}`
- `info`: `{"total_vectors": 100, "dimension": 384, "is_trained": true}`

Errors are printed to stderr as JSON: `{"error": "message", "type": "ErrorType"}`
