-- Migration: Create employee_analytics table for pre-computed statistics
-- Date: 2025-11-12
-- Description: Stores aggregated employee statistics for fast dashboard loading

-- Create employee_analytics table
CREATE TABLE IF NOT EXISTS public.employee_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Computed statistics
  total_screenshots INTEGER DEFAULT 0,
  category_breakdown JSONB DEFAULT '{}'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  most_used_category TEXT,

  -- Timestamps
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure one analytics record per user
  CONSTRAINT unique_analytics_per_user UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_analytics_user_id ON public.employee_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_analytics_organization_id ON public.employee_analytics(organization_id);
CREATE INDEX IF NOT EXISTS idx_employee_analytics_last_updated ON public.employee_analytics(last_updated DESC);

-- Enable Row Level Security
ALTER TABLE public.employee_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees can read their own analytics
CREATE POLICY "employees_read_own_analytics" ON public.employee_analytics
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Employers can read analytics for employees in their organization
CREATE POLICY "employers_read_org_analytics" ON public.employee_analytics
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE employer_id = auth.uid()
  )
);

-- Function to calculate and update employee analytics
CREATE OR REPLACE FUNCTION public.update_employee_analytics(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_organization_id UUID;
  v_total_screenshots INTEGER;
  v_category_breakdown JSONB;
  v_timeline JSONB;
  v_most_used_category TEXT;
BEGIN
  -- Get user's organization
  SELECT organization_id INTO v_organization_id
  FROM public.users
  WHERE id = target_user_id;

  -- If no organization, exit
  IF v_organization_id IS NULL THEN
    RETURN;
  END IF;

  -- Calculate total screenshots
  SELECT COUNT(*) INTO v_total_screenshots
  FROM public.screenshots
  WHERE user_id = target_user_id;

  -- Calculate category breakdown
  SELECT jsonb_object_agg(
    detected_category,
    jsonb_build_object(
      'count', count,
      'percentage', ROUND((count::numeric / NULLIF(v_total_screenshots, 0) * 100)::numeric, 2)
    )
  ) INTO v_category_breakdown
  FROM (
    SELECT
      COALESCE(detected_category, 'other') as detected_category,
      COUNT(*)::integer as count
    FROM public.screenshots
    WHERE user_id = target_user_id
    GROUP BY detected_category
  ) subquery;

  -- Calculate timeline (daily aggregation)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'screenshots', screenshots,
      'most_used', most_used
    ) ORDER BY date DESC
  ) INTO v_timeline
  FROM (
    SELECT
      DATE(timestamp) as date,
      COUNT(*)::integer as screenshots,
      MODE() WITHIN GROUP (ORDER BY COALESCE(detected_category, 'other')) as most_used
    FROM public.screenshots
    WHERE user_id = target_user_id
    GROUP BY DATE(timestamp)
    ORDER BY DATE(timestamp) DESC
    LIMIT 30
  ) daily;

  -- Find most used category
  SELECT detected_category INTO v_most_used_category
  FROM (
    SELECT COALESCE(detected_category, 'other') as detected_category, COUNT(*) as count
    FROM public.screenshots
    WHERE user_id = target_user_id
    GROUP BY detected_category
    ORDER BY count DESC
    LIMIT 1
  ) top_category;

  -- Insert or update analytics
  INSERT INTO public.employee_analytics (
    user_id,
    organization_id,
    total_screenshots,
    category_breakdown,
    timeline,
    most_used_category,
    last_updated
  )
  VALUES (
    target_user_id,
    v_organization_id,
    v_total_screenshots,
    COALESCE(v_category_breakdown, '{}'::jsonb),
    COALESCE(v_timeline, '[]'::jsonb),
    v_most_used_category,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_screenshots = EXCLUDED.total_screenshots,
    category_breakdown = EXCLUDED.category_breakdown,
    timeline = EXCLUDED.timeline,
    most_used_category = EXCLUDED.most_used_category,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update analytics when screenshot is inserted
CREATE OR REPLACE FUNCTION public.trigger_update_analytics()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.update_employee_analytics(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER screenshot_inserted_update_analytics
AFTER INSERT ON public.screenshots
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_analytics();

-- Trigger to update analytics when screenshot is updated
CREATE TRIGGER screenshot_updated_update_analytics
AFTER UPDATE ON public.screenshots
FOR EACH ROW
WHEN (OLD.detected_category IS DISTINCT FROM NEW.detected_category)
EXECUTE FUNCTION public.trigger_update_analytics();

COMMENT ON TABLE public.employee_analytics IS 'Pre-computed employee statistics for fast dashboard loading with automatic updates';
COMMENT ON COLUMN public.employee_analytics.category_breakdown IS 'JSONB object with category counts and percentages';
COMMENT ON COLUMN public.employee_analytics.timeline IS 'JSONB array of daily screenshot counts for the last 30 days';
