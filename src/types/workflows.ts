/**
 * Workflows and Screenshot Types
 * Matches Rust ScreenshotInfo struct from screenshot_manager.rs
 */

export interface ScreenshotInfo {
  id: string;
  file_path: string;
  timestamp: string;
  width: number;
  height: number;
  file_size: number;
  added_to_training: boolean;
  training_added_at?: string;
}

export interface AddToTrainingResult {
  screenshot_id: string;
  caption: string;
  tokens_used: number;
  cost: number;
}

export interface WorkflowsPageState {
  screenshots: ScreenshotInfo[];
  loading: boolean;
  error: string | null;
  selectedScreenshot: ScreenshotInfo | null;
  filterOptions: FilterOptions;
  sortBy: 'timestamp' | 'size' | 'dimensions';
  sortOrder: 'asc' | 'desc';
}

export interface FilterOptions {
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
  addedToTraining: 'all' | 'yes' | 'no';
  searchQuery: string;
}

export type VLMProvider = 'openai' | 'claude';
