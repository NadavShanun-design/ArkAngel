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

export interface CompanyAnalytics {
  total_employees: number;
  total_screenshots: number;
  company_category_breakdown: Record<string, {
    total_count: number;
    percentage: number;
    employee_count: number;
  }>;
  productivity_trends: Array<{
    date: string;
    total_screenshots: number;
    active_employees: number;
  }>;
  employee_performance: Array<{
    user_id: string;
    employee_name: string;
    employee_email: string;
    total_screenshots: number;
    most_used_category?: string;
  }>;
  insights: Array<{
    type: 'info' | 'warning' | 'success';
    priority: number;
    title: string;
    message: string;
    action: string;
  }>;
}
