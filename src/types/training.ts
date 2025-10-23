// Training data types matching Rust backend

export interface TrainingMetadata {
  source_id: string;
  source_date?: string;
  source_time?: string;
  message_count?: number;
  session_id?: string;
  original_filename?: string;
}

export interface TrainingDataItem {
  id: string;
  source_type: string; // "transcript", "conversation", "document", etc.
  title: string;
  content: string;
  metadata: TrainingMetadata;
  added_at: string; // ISO 8601 timestamp
  format: string; // "json", "text", "markdown"
}

export interface TrainingCollection {
  items: TrainingDataItem[];
  total_count: number;
  total_size_bytes: number;
  last_updated: string;
}
