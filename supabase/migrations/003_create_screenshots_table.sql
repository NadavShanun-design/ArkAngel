-- Migration: Create screenshots table for Supabase-synced screenshot data
-- Date: 2025-11-12
-- Description: Stores screenshot metadata with VLM captions and AI categorization

-- Create screenshots table
CREATE TABLE IF NOT EXISTS public.screenshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Screenshot metadata
  screenshot_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  width INTEGER,
  height INTEGER,
  file_size BIGINT,

  -- VLM & AI analysis
  caption TEXT,
  caption_generated_at TIMESTAMP WITH TIME ZONE,
  detected_category TEXT,

  -- Supabase Storage reference
  storage_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique screenshots per user
  CONSTRAINT unique_screenshot_per_user UNIQUE(user_id, screenshot_id)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_screenshots_user_id ON public.screenshots(user_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_organization_id ON public.screenshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_screenshots_timestamp ON public.screenshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_category ON public.screenshots(detected_category);
CREATE INDEX IF NOT EXISTS idx_screenshots_created_at ON public.screenshots(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Employees can insert their own screenshots
CREATE POLICY "employees_insert_own_screenshots" ON public.screenshots
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Employees can read their own screenshots
CREATE POLICY "employees_read_own_screenshots" ON public.screenshots
FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Employees can update their own screenshots
CREATE POLICY "employees_update_own_screenshots" ON public.screenshots
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS Policy: Employers can read all screenshots in their organization
CREATE POLICY "employers_read_org_screenshots" ON public.screenshots
FOR SELECT TO authenticated
USING (
  organization_id IN (
    SELECT id FROM public.organizations WHERE employer_id = auth.uid()
  )
);

-- Function to insert screenshot with validation
CREATE OR REPLACE FUNCTION public.insert_screenshot(
  p_user_id UUID,
  p_organization_id UUID,
  p_screenshot_id TEXT,
  p_file_path TEXT,
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_width INTEGER,
  p_height INTEGER,
  p_file_size BIGINT,
  p_caption TEXT,
  p_detected_category TEXT,
  p_storage_url TEXT
)
RETURNS UUID AS $$
DECLARE
  new_id UUID;
BEGIN
  INSERT INTO public.screenshots (
    user_id,
    organization_id,
    screenshot_id,
    file_path,
    timestamp,
    width,
    height,
    file_size,
    caption,
    caption_generated_at,
    detected_category,
    storage_url
  ) VALUES (
    p_user_id,
    p_organization_id,
    p_screenshot_id,
    p_file_path,
    p_timestamp,
    p_width,
    p_height,
    p_file_size,
    p_caption,
    NOW(),
    p_detected_category,
    p_storage_url
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_screenshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER screenshot_update_timestamp
BEFORE UPDATE ON public.screenshots
FOR EACH ROW
EXECUTE FUNCTION public.update_screenshot_timestamp();

COMMENT ON TABLE public.screenshots IS 'Stores screenshot data synced from local Tauri app with VLM captions and AI categorization';
COMMENT ON COLUMN public.screenshots.screenshot_id IS 'Local screenshot ID from workflows/index.json';
COMMENT ON COLUMN public.screenshots.detected_category IS 'AI-categorized software type (browsers, code_editors, social_media, etc.)';
COMMENT ON COLUMN public.screenshots.storage_url IS 'Supabase Storage URL for screenshot file';
