// Transcript-related types matching the Rust backend

export interface TranscriptFile {
  filename: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM:SS
  session_id: string;
  message_count: number;
  file_path: string;
}

export interface TranscriptBatch {
  id: string;
  title: string; // First few words
  content: string;
  sentence_count: number;
  batch_index: number;
  total_batches: number;
}

export interface BatchedTranscript {
  file_info: TranscriptFile;
  batches: TranscriptBatch[];
  total_content: string;
}

export interface TranscriptViewState {
  loading: boolean;
  error: string | null;
  selectedTranscript: BatchedTranscript | null;
  allTranscripts: TranscriptFile[];
}
