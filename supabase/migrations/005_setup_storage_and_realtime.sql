-- Migration: Set up Supabase Storage and Realtime
-- Date: 2025-11-12
-- Description: Configures storage bucket for screenshots and enables realtime subscriptions

-- Create storage bucket for screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  false,
  10485760, -- 10MB limit per file
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Employees can upload screenshots to their own folder
CREATE POLICY "employees_upload_own_screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can read their own screenshots
CREATE POLICY "users_read_own_screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Employers can read screenshots from employees in their organization
CREATE POLICY "employers_read_org_screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT u.id::text
    FROM public.users u
    INNER JOIN public.organizations o ON u.organization_id = o.id
    WHERE o.employer_id = auth.uid()
  )
);

-- Users can update their own screenshots
CREATE POLICY "users_update_own_screenshots"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own screenshots
CREATE POLICY "users_delete_own_screenshots"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'screenshots' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable Realtime for screenshots table
-- Note: This is configured in Supabase dashboard under Database > Replication
-- or can be done via SQL:
ALTER PUBLICATION supabase_realtime ADD TABLE public.screenshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_analytics;

-- Function to get storage URL for a screenshot
CREATE OR REPLACE FUNCTION public.get_screenshot_storage_url(
  p_user_id UUID,
  p_filename TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_project_url TEXT;
  v_bucket_id TEXT := 'screenshots';
BEGIN
  -- Get Supabase project URL from environment or config
  -- This will be replaced with actual project URL
  v_project_url := current_setting('app.settings.supabase_url', true);

  IF v_project_url IS NULL THEN
    -- Fallback: construct from current database
    v_project_url := 'https://your-project.supabase.co';
  END IF;

  RETURN format('%s/storage/v1/object/%s/%s/%s',
    v_project_url,
    v_bucket_id,
    p_user_id,
    p_filename
  );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.get_screenshot_storage_url IS 'Generates Supabase Storage URL for a screenshot file';
