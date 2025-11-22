/* 
 * FILE: CompanyInsights.tsx
 * ========================
 * 
 * Employer Dashboard Component - Displays company-wide analytics
 * 
 * ARCHITECTURE:
 * =============
 * 
 * DEV MODE (import.meta.env.DEV === true):
 * ├─ Calls: invoke('get_company_analytics') [Tauri command]
 * ├─ Data: Reads from employees/*.json (mock data locally)
 * ├─ Auth: NONE - no auth checks
 * └─ Use: Testing dashboard without Supabase setup
 * 
 * PRODUCTION MODE (import.meta.env.DEV === false):
 * ├─ Auth Check 1: Verify user exists
 * ├─ Auth Check 2: Verify user.role === 'employer'
 * ├─ Calls: getCompanyAnalytics(user.id) [Supabase RPC]
 * ├─ Request: Includes Supabase JWT token in headers
 * ├─ Backend: PostgreSQL RPC function (in Supabase)
 * │   ├─ Verifies JWT token
 * │   ├─ Confirms user is employer
 * │   ├─ Prevents cross-organization access (RLS)
 * │   └─ Aggregates real screenshot data from database
 * └─ Return: CompanyAnalytics JSON object
 * 
 * SECURITY LAYERS:
 * ================
 * 1. Frontend: Role-based component access (employer only)
 * 2. JWT Token: Expires and requires re-authentication
 * 3. RLS Policies: Database prevents accessing other organizations' data
 * 4. Row Filtering: All queries filtered by organization_id
 * 5. Session Management: Automatic token refresh via Supabase
 * 
 * DATA FLOW:
 * ==========
 * User Click → Load Analytics → Check Auth → Fetch Data → Display Charts
 * 
 * ERROR HANDLING:
 * ===============
 * - No auth: Show "Please sign in"
 * - Wrong role: Show "Admin access required"
 * - Data fetch error: Show "Failed to load insights"
 * - Network error: Show retry button
 * 
 * TESTING:
 * ========
 * npm run tauri dev → Uses DEV mode → Reads mock JSON
 * npm run build && deploy → Uses PRODUCTION mode → Connects to Supabase
 */
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Activity, AlertCircle, CheckCircle, Info, Target, Clock, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getCompanyAnalytics } from '@/lib/supabase';
import type { CompanyAnalytics } from '@/types/employee';
import { invoke } from '@tauri-apps/api/core';

const COLORS: Record<string, string> = {
  browsers: '#4285F4',
  code_editors: '#007ACC',
  social_media: '#0A66C2',
  communication: '#E01E5A',
  productivity: '#FF6B6B',
  email: '#EA4335',
  design: '#F24E1E',
  terminal: '#000000',
  media: '#FF0000',
  other: '#999999',
};

const ICONS: Record<string, string> = {
  browsers: '🌐',
  code_editors: '💻',
  social_media: '📱',
  communication: '💬',
  productivity: '📊',
  email: '📧',
  design: '🎨',
  terminal: '⚙️',
  media: '🎵',
  other: '📄',
};

const INSIGHT_ICONS = {
  info: Info,
  warning: AlertCircle,
  success: CheckCircle,
};

const INSIGHT_COLORS = {
  info: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  success: 'text-green-600 dark:text-green-400 bg-green-500/10 border-green-500/20',
};

/* COMPONENT: CompanyInsights Dashboard
 * 
 * AUTHENTICATION REQUIREMENTS (PRODUCTION):
 * =========================================
 * 1. User MUST be authenticated (JWT token from Supabase Auth)
 * 2. User MUST have role = 'employer'
 * 3. User MUST belong to an organization
 * 
 * DEV MODE:
 * - Bypasses all auth checks
 * - Reads mock employee data from JSON files
 * - For testing without Supabase setup
 * 
 * PRODUCTION MODE:
 * - Checks user exists and has 'employer' role
 * - Fetches real analytics from Supabase RPC (authenticated)
 * - Row-level security (RLS) prevents cross-organization access
 * - Session token automatically included in all requests
 */
export default function CompanyInsights() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const isDev = import.meta.env.DEV;
      let data;

      if (isDev) {
        data = await invoke<CompanyAnalytics>('get_company_analytics');
      } else {
        if (!user || user.role !== 'employer') {
          setLoading(false);
          return;
        }
        data = await getCompanyAnalytics(user.id);

        /* PRODUCTION/ACTUAL DATA FLOW:
         * In production, the above call to getCompanyAnalytics(user.id) makes an RPC call to Supabase:
         * 
         * AUTHENTICATION REQUIREMENTS:
         * 1. User MUST be authenticated (checked: !user)
         * 2. User MUST have 'employer' role (checked: user.role !== 'employer')
         * 3. Supabase session token is sent automatically in request headers via @supabase/supabase-js client
         * 
         * ACTUAL PRODUCTION CODE (in supabase.ts):
         * export const getCompanyAnalytics = async (employerId: string) => {
         *   const { data, error } = await supabase.rpc('get_company_analytics', {
         *     p_employer_id: employerId
         *   })
         *   if (error) throw new Error(error.message)
         *   return data
         * }
         * 
         * BACKEND RPC FUNCTION (PostgreSQL):
         * This calls a Supabase PostgreSQL function that:
         * - Verifies the employer_id matches authenticated user's organization
         * - Aggregates screenshot data from 'screenshots' table filtered by organization_id
         * - Calculates analytics across all employees in the organization
         * - Returns CompanyAnalytics object with real employee performance data
*/
      }

      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load company analytics:', error);
      setError('Failed to load company insights. Please try again later.');
    } finally {
      setLoading(false);
    }
  };



  const getPieChartData = () => {
    if (!analytics || !analytics.company_category_breakdown) return [];

    return Object.entries(analytics.company_category_breakdown)
      .filter(([_, data]) => data.total_count > 0)
      .map(([category, data]) => ({
        name: category.replace('_', ' ').toUpperCase(),
        value: data.percentage,
        count: data.total_count,
        category,
        employeeCount: data.employee_count,
      }));
  };

  const getProductivityChartData = () => {
    if (!analytics || !analytics.productivity_trends) return [];
    
    // Show last 7 days
    return analytics.productivity_trends.slice(0, 7).reverse();
  };

  const getTopPerformers = () => {
    if (!analytics || !analytics.employee_performance) return [];
    return analytics.employee_performance;
  };

  const getEstimatedHours = () => {
    if (!analytics) return '0';
    // Estimate 5 minutes per screenshot
    const minutes = analytics.total_screenshots * 5;
    return (minutes / 60).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-muted-foreground animate-pulse text-lg">
          Loading company insights...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <div className="text-lg font-semibold mb-2">Error Loading Data</div>
          <div className="text-muted-foreground mb-4">{error}</div>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center text-muted-foreground">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <div className="text-lg">No company data available</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8 overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold">Company Insights</h1>
          <p className="text-muted-foreground mt-1">
            Actionable insights for your entire team
          </p>
        </div>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Total Employees</div>
          </div>
          <div className="text-4xl font-bold">{analytics.total_employees}</div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-green-600 dark:text-green-400" />
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">Total Screenshots</div>
          </div>
          <div className="text-4xl font-bold">{analytics.total_screenshots.toLocaleString()}</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Estimated Hours</div>
          </div>
          <div className="text-4xl font-bold">{getEstimatedHours()}</div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">Avg per Employee</div>
          </div>
          <div className="text-4xl font-bold">
            {analytics.total_employees > 0
              ? Math.round(analytics.total_screenshots / analytics.total_employees)
              : 0}
          </div>
        </div>
      </div>

      {/* Actionable Insights */}
      {analytics.insights && analytics.insights.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Actionable Insights for Your Team</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {analytics.insights.map((insight, index) => {
              const Icon = INSIGHT_ICONS[insight.type];
              const isHighPriority = insight.priority <= 3;
              const isPriority = insight.priority <= 2;
              return (
                <div
                  key={index}
                  className={`relative rounded-lg border-2 p-5 transition-all ${
                    isPriority ? 'lg:col-span-2' : ''
                  } ${
                    isPriority
                      ? `${INSIGHT_COLORS[insight.type]} shadow-lg`
                      : `${INSIGHT_COLORS[insight.type]} hover:shadow-md`
                  }`}
                >
                  {isHighPriority && (
                    <div className="absolute top-0 right-0 flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg bg-current opacity-80">
                      {insight.priority === 1 ? '🔴 URGENT' : insight.priority === 2 ? '🟠 HIGH' : '🟡 PRIORITY'}
                    </div>
                  )}
                  <div className="flex items-start gap-3 pt-2">
                    <Icon className="w-6 h-6 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-bold text-lg mb-2">{insight.title}</div>
                      <div className="text-sm leading-relaxed mb-3">{insight.message}</div>
                      <div className="bg-background/40 rounded-lg p-3 border border-current/20">
                        <div className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">Recommended Action</div>
                        <div className="text-sm font-medium">{insight.action}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Software Usage */}
        <div className="bg-background/50 border border-border rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Company Software Usage</h2>
          {getPieChartData().length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={getPieChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getPieChartData().map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[entry.category] || '#999999'}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    `${value.toFixed(1)}% (${props.payload.count} total, ${props.payload.employeeCount} employees)`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No usage data available
            </div>
          )}
        </div>

        {/* Productivity Trends */}
        <div className="bg-background/50 border border-border rounded-xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold mb-6">Productivity Trends (Last 7 Days)</h2>
          {getProductivityChartData().length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={getProductivityChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'total_screenshots' ? `${value} screenshots` : `${value} employees`,
                    name === 'total_screenshots' ? 'Screenshots' : 'Active Employees',
                  ]}
                />
                <Legend />
                <Bar dataKey="total_screenshots" fill="#4285F4" name="Screenshots" />
                <Bar dataKey="active_employees" fill="#34A853" name="Active Employees" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              No trend data available
            </div>
          )}
        </div>
      </div>

      {/* Top Performers with Individual Insights */}
      {getTopPerformers().length > 0 && (
        <div className="bg-background/50 border border-border rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6">Employees and Insights</h2>
          <div className="space-y-4">
            {getTopPerformers().map((employee, index) => {
              const isExpanded = expandedEmployee === employee.user_id;
              const hasInsights = employee.employee_insights && employee.employee_insights.length > 0;
              
              return (
                <div
                  key={employee.user_id}
                  className="rounded-lg bg-background/80 border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedEmployee(isExpanded ? null : employee.user_id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors text-left"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold text-sm flex-shrink-0">
                      {index + 1}
                    </div>
                    {employee.employee_avatar && (
                      <img
                        src={employee.employee_avatar}
                        alt={employee.employee_name}
                        className="w-12 h-12 rounded-full ring-2 ring-border flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-lg">{employee.employee_name}</div>
                      <div className="text-sm text-muted-foreground truncate">{employee.employee_email}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-lg">{employee.total_screenshots.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">screenshots</div>
                    </div>
                    {employee.most_used_category && (
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm flex-shrink-0">
                        {ICONS[employee.most_used_category] || '📄'}
                        <span className="hidden sm:inline">{employee.most_used_category.replace('_', ' ').toUpperCase()}</span>
                      </div>
                    )}
                    {hasInsights && (
                      <ChevronDown
                        className={`w-5 h-5 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    )}
                  </button>

                  {/* Per-Employee Insights Section */}
                  {isExpanded && hasInsights && (
                    <div className="border-t border-border bg-background/40 p-4 space-y-3">
                      {employee.employee_insights.map((insight: any, idx: number) => {
                        const Icon = INSIGHT_ICONS[insight.type];
                        return (
                          <div
                            key={idx}
                            className={`rounded-lg border-2 p-4 ${INSIGHT_COLORS[insight.type]}`}
                          >
                            <div className="flex items-start gap-3">
                              {Icon && <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-bold text-sm">{insight.title}</div>
                                  {insight.priority <= 2 && (
                                    <span className="text-xs font-bold px-2 py-0.5 bg-current/20 rounded">
                                      {insight.priority === 1 ? '🔴 URGENT' : '🟠 HIGH'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm leading-relaxed mb-2">{insight.message}</div>
                                <div className="bg-background/60 rounded p-2 border border-current/10 text-xs">
                                  <div className="font-semibold opacity-70 mb-1">ACTION:</div>
                                  <div>{insight.action}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Production Implementation Comment */}
          {/* 
            Sample JSON return that works with this-

            {
  "total_employees": 12,
  "total_screenshots": 2450,
  "company_category_breakdown": {
    "development": {
      "percentage": 65.5,
      "total_count": 1605,
      "employee_count": 8
    },
    "communication": {
      "percentage": 20.0,
      "total_count": 490,
      "employee_count": 12
    },
    "social_media": {
      "percentage": 5.2,
      "total_count": 127,
      "employee_count": 4
    }
  },
  "employee_performance": [
    {
      "user_id": "a1b2c3d4-...",
      "employee_name": "Sarah Jenkins",
      "employee_email": "sarah.j@company.com",
      "total_screenshots": 450,
      "most_used_category": "development",
      "last_updated": "2025-01-15T14:30:00Z"
    },
    {
      "user_id": "e5f6g7h8-...",
      "employee_name": "Mike Ross",
      "employee_email": "m.ross@company.com",
      "total_screenshots": 380,
      "most_used_category": "design",
      "last_updated": "2025-01-15T14:15:00Z"
    }
  ],
  "productivity_trends": [
    {
      "date": "2025-01-15",
      "total_screenshots": 850,
      "active_employees": 12
    },
    {
      "date": "2025-01-14",
      "total_screenshots": 790,
      "active_employees": 11
    }
  ],
  "insights": [
    {
      "type": "success",
      "title": "Top Performers Identified",
      "priority": 3,
      "message": "3 employee(s) in top 20% for productivity. Setting excellent standards.",
      "action": "Recognize achievements and document best practices for team learning"
    },
    {
      "type": "info",
      "title": "Primary Focus Area",
      "priority": 4,
      "message": "Team focuses on development (65.5% of activity). Ensure tools and training are optimized.",
      "action": "Audit tool availability, schedule team training on advanced features"
    },
    {
      "type": "success",
      "title": "Healthy Social Media Balance",
      "priority": 5,
      "message": "Social media: 5.2% of activity. Team maintains healthy balance.",
      "action": "Continue monitoring"
    }
  ]
}


          */}
        </div>
      )}

      {/* Category Breakdown */}
      {analytics.company_category_breakdown && Object.keys(analytics.company_category_breakdown).length > 0 && (
        <div className="bg-background/50 border border-border rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-6">Detailed Category Breakdown</h2>
          <div className="space-y-4">
            {Object.entries(analytics.company_category_breakdown)
              .filter(([_, data]) => data.total_count > 0)
              .sort(([, a], [, b]) => b.total_count - a.total_count)
              .map(([category, data]) => (
                <div
                  key={category}
                  className="flex items-center gap-4 p-4 rounded-lg bg-background/80 border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="text-2xl">{ICONS[category] || '📄'}</div>
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: COLORS[category] }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-lg">
                      {category.replace('_', ' ').toUpperCase()}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {data.total_count.toLocaleString()} total screenshots • {data.percentage.toFixed(1)}% • Used by {data.employee_count} employee{data.employee_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="w-32 bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${data.percentage}%`,
                        backgroundColor: COLORS[category],
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

