#!/usr/bin/env python3
"""
RAG Embedding Service
Handles text embedding generation and FAISS vector index management for ArkAngel RAG system.
"""

import sys
import json
import numpy as np
import os
from pathlib import Path

try:
    from sentence_transformers import SentenceTransformer
    import faiss
except ImportError as e:
    print(json.dumps({"error": f"Missing dependency: {str(e)}"}), file=sys.stderr)
    sys.exit(1)


class EmbeddingService:
    """Service for generating embeddings and managing FAISS indices."""

    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """
        Initialize the embedding service.

        Args:
            model_name: Name of the sentence-transformers model to use
        """
        self.model_name = model_name
        self.dimension = 384  # all-MiniLM-L6-v2 produces 384-dimensional embeddings
        self.model = None

    def _load_model(self):
        """Lazy-load the model to save memory when not needed."""
        if self.model is None:
            try:
                self.model = SentenceTransformer(self.model_name)
            except Exception as e:
                raise RuntimeError(f"Failed to load model {self.model_name}: {str(e)}")
        return self.model

    def generate_embeddings(self, texts):
        """
        Generate embeddings for a list of texts.

        Args:
            texts: List of strings to embed

        Returns:
            List of embeddings (each embedding is a list of floats)
        """
        if not texts:
            return []

        model = self._load_model()

        # Generate embeddings with progress disabled for cleaner output
        embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)

        # Convert to list for JSON serialization
        return embeddings.tolist()

    def create_faiss_index(self, embeddings, output_path):
        """
        Create a FAISS index from embeddings and save to disk.

        Args:
            embeddings: List of embeddings (list of lists of floats)
            output_path: Path where to save the FAISS index

        Returns:
            True if successful
        """
        if not embeddings:
            raise ValueError("Cannot create index from empty embeddings")

        # Convert embeddings to numpy array
        embeddings_np = np.array(embeddings, dtype='float32')

        # Normalize vectors for cosine similarity (optional but recommended)
        faiss.normalize_L2(embeddings_np)

        # Create FAISS index using L2 distance
        # For small datasets (<100k vectors), IndexFlatL2 is sufficient
        index = faiss.IndexFlatL2(self.dimension)

        # Add vectors to index
        index.add(embeddings_np)

        # Ensure output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        # Save index to disk
        faiss.write_index(index, output_path)

        return True

    def search_similar(self, index_path, query_embedding, top_k=5):
        """
        Search for similar embeddings in a FAISS index.

        Args:
            index_path: Path to the FAISS index file
            query_embedding: The query embedding (list of floats)
            top_k: Number of top results to return

        Returns:
            Dictionary with 'indices' and 'distances' lists
        """
        if not os.path.exists(index_path):
            raise FileNotFoundError(f"Index file not found: {index_path}")

        # Load index
        index = faiss.read_index(index_path)

        # Convert query to numpy array and normalize
        query_np = np.array([query_embedding], dtype='float32')
        faiss.normalize_L2(query_np)

        # Search
        distances, indices = index.search(query_np, top_k)

        return {
            'indices': indices[0].tolist(),
            'distances': distances[0].tolist()
        }

    def get_index_info(self, index_path):
        """
        Get information about a FAISS index.

        Args:
            index_path: Path to the FAISS index file

        Returns:
            Dictionary with index information
        """
        if not os.path.exists(index_path):
            raise FileNotFoundError(f"Index file not found: {index_path}")

        index = faiss.read_index(index_path)

        return {
            'total_vectors': index.ntotal,
            'dimension': index.d,
            'is_trained': index.is_trained
        }


def main():
    """Main CLI interface for the embedding service."""

    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "No command specified",
            "usage": "python embedding_service.py <command> [args]",
            "commands": ["embed", "create_index", "search", "info"]
        }), file=sys.stderr)
        sys.exit(1)

    command = sys.argv[1]
    service = EmbeddingService()

    try:
        if command == 'embed':
            # Read texts from stdin as JSON
            input_data = sys.stdin.read()
            texts = json.loads(input_data)

            if not isinstance(texts, list):
                raise ValueError("Input must be a JSON array of strings")

            embeddings = service.generate_embeddings(texts)
            print(json.dumps(embeddings))

        elif command == 'create_index':
            if len(sys.argv) < 4:
                raise ValueError("Usage: create_index <embeddings_file> <output_path>")

            embeddings_path = sys.argv[2]
            output_path = sys.argv[3]

            # Read embeddings from file
            with open(embeddings_path, 'r') as f:
                embeddings = json.load(f)

            success = service.create_faiss_index(embeddings, output_path)
            print(json.dumps({'success': success}))

        elif command == 'search':
            if len(sys.argv) < 4:
                raise ValueError("Usage: search <index_path> <query_embedding_file> [top_k]")

            index_path = sys.argv[2]
            query_embedding_path = sys.argv[3]
            top_k = int(sys.argv[4]) if len(sys.argv) > 4 else 5

            # Read query embedding from file
            with open(query_embedding_path, 'r') as f:
                query_embedding = json.load(f)

            results = service.search_similar(index_path, query_embedding, top_k)
            print(json.dumps(results))

        elif command == 'info':
            if len(sys.argv) < 3:
                raise ValueError("Usage: info <index_path>")

            index_path = sys.argv[2]
            info = service.get_index_info(index_path)
            print(json.dumps(info))

        else:
            raise ValueError(f"Unknown command: {command}")

    except Exception as e:
        error_response = {
            'error': str(e),
            'type': type(e).__name__
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
