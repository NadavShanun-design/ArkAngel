import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Clock, Activity, Target } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getEmployeeAnalytics } from '@/lib/supabase';

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

interface EmployeeAnalytics {
  total_screenshots: number;
  category_breakdown: Record<string, { count: number; percentage: number }>;
  timeline: Array<{ date: string; screenshots: number; most_used: string }>;
  most_used_category: string | null;
}

export default function PerformancePage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<EmployeeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Load analytics from Supabase
      const data = await getEmployeeAnalytics(user.id);
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load employee analytics:', error);
      setError('Failed to load performance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getPieChartData = () => {
    if (!analytics || !analytics.category_breakdown) return [];

    return Object.entries(analytics.category_breakdown)
      .filter(([_, data]) => data.count > 0)
      .map(([category, data]) => ({
        name: category.replace('_', ' ').toUpperCase(),
        value: data.percentage,
        count: data.count,
        category,
      }));
  };

  const getMostUsed = () => {
    if (!analytics || !analytics.most_used_category) return 'N/A';
    return analytics.most_used_category.replace('_', ' ').toUpperCase();
  };

  const getTotalHours = () => {
    if (!analytics) return '0';
    // Estimate 5 minutes per screenshot
    const minutes = analytics.total_screenshots * 5;
    return (minutes / 60).toFixed(1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-muted-foreground animate-pulse text-lg">
          Loading your performance data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-destructive text-lg mb-2">{error}</p>
          <button
            onClick={loadAnalytics}
            className="text-sm text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-2">Please sign in to view performance data</p>
        </div>
      </div>
    );
  }

  if (!analytics || analytics.total_screenshots === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <p className="text-muted-foreground text-lg mb-2">No performance data available yet</p>
          <p className="text-sm text-muted-foreground">
            Start using the app to track your productivity
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-background">
      <div className="space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="pb-6 border-b border-border">
          <h1 className="text-3xl font-bold mb-2">Your Performance</h1>
          <p className="text-muted-foreground">
            Track your productivity and software usage
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Activity className="text-blue-600 dark:text-blue-400" size={20} />
              </div>
              <span className="text-sm text-muted-foreground">Total Screenshots</span>
            </div>
            <p className="text-3xl font-bold">{analytics.total_screenshots}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Clock className="text-green-600 dark:text-green-400" size={20} />
              </div>
              <span className="text-sm text-muted-foreground">Est. Hours</span>
            </div>
            <p className="text-3xl font-bold">{getTotalHours()}h</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Target className="text-purple-600 dark:text-purple-400" size={20} />
              </div>
              <span className="text-sm text-muted-foreground">Most Used</span>
            </div>
            <p className="text-xl font-bold truncate">{getMostUsed()}</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <TrendingUp className="text-orange-600 dark:text-orange-400" size={20} />
              </div>
              <span className="text-sm text-muted-foreground">Categories</span>
            </div>
            <p className="text-3xl font-bold">{getPieChartData().length}</p>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Software Usage Distribution</h3>
            {getPieChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={getPieChartData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {getPieChartData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.category] || COLORS.other} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No usage data available
              </div>
            )}
          </div>

          {/* Category Breakdown */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Category Details</h3>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {Object.entries(analytics.category_breakdown)
                .filter(([_, data]) => data.count > 0)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([category, data]) => (
                  <div key={category} className="flex items-center justify-between p-3 bg-background rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{ICONS[category] || ICONS.other}</span>
                      <div>
                        <div className="font-medium text-sm">
                          {category.replace('_', ' ').toUpperCase()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.count} screenshot{data.count !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg" style={{ color: COLORS[category] || COLORS.other }}>
                        {data.percentage.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {analytics.timeline && analytics.timeline.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
            <div className="space-y-2">
              {analytics.timeline.slice(0, 7).map((entry, index) => (
                <div key={index} className="flex items-center gap-4 p-3 bg-background rounded-lg">
                  <div className="text-sm font-medium text-muted-foreground min-w-[100px]">
                    {new Date(entry.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all"
                        style={{ width: `${Math.min((entry.screenshots / analytics.total_screenshots) * 100 * 10, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-sm font-semibold min-w-[80px] text-right">
                    {entry.screenshots} screenshot{entry.screenshots !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>Privacy Note:</strong> Your performance data is private and only visible to you and your employer.
            Screenshot data is used to help you understand your productivity patterns.
          </p>
        </div>
      </div>
    </div>
  );
}
