export interface Employee {
  id: string;
  name: string;
  email: string;
  avatar: string;
  status: 'active' | 'inactive';
  is_current_user: boolean;
}

export interface SoftwareUsageInstance {
  screenshot_id: string;
  timestamp: string;
  // Keyword-based detection (old format)
  detected_keywords?: string[];
  confidence?: number;
  // AI-based detection (new format)
  detected_category?: string;
  caption_preview?: string;
  error?: string;
}

export interface SoftwareCategoryUsage {
  count: number;
  percentage: number;
  instances: SoftwareUsageInstance[];
}

export interface EmployeeUsageData {
  employee_id: string;
  last_updated: string;
  total_screenshots: number;
  software_usage: Record<string, SoftwareCategoryUsage>;
  timeline: Array<{
    date: string;
    screenshots: number;
    most_used: string;
  }>;
}

export interface EmployeeList {
  employees: Employee[];
}
