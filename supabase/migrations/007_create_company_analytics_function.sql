-- Migration: Create company analytics function
-- Date: 2025-01-XX
-- Description: Aggregates employee analytics to provide company-wide insights for employers

-- Function to get company-wide analytics aggregated from all employees
CREATE OR REPLACE FUNCTION public.get_company_analytics(p_employer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_organization_id UUID;
  v_result JSONB;
BEGIN
  -- Get the organization ID for this employer
  SELECT id INTO v_organization_id
  FROM public.organizations
  WHERE employer_id = p_employer_id
  LIMIT 1;

  -- If no organization found, return empty result
  IF v_organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'total_employees', 0,
      'total_screenshots', 0,
      'company_category_breakdown', '{}'::jsonb,
      'employee_performance', '[]'::jsonb,
      'productivity_trends', '[]'::jsonb,
      'insights', '[]'::jsonb
    );
  END IF;

  -- Build the result with aggregated data
  SELECT jsonb_build_object(
    'total_employees', (
      SELECT COUNT(DISTINCT user_id)
      FROM public.employee_analytics
      WHERE organization_id = v_organization_id
    ),
    'total_screenshots', (
      SELECT COALESCE(SUM(total_screenshots), 0)
      FROM public.employee_analytics
      WHERE organization_id = v_organization_id
    ),
    'company_category_breakdown', (
      SELECT jsonb_object_agg(
        category,
        jsonb_build_object(
          'total_count', total_count,
          'percentage', ROUND((total_count::numeric / NULLIF(total_all, 0) * 100)::numeric, 2),
          'employee_count', employee_count
        )
      )
      FROM (
        SELECT
          key as category,
          SUM((value->>'count')::integer) as total_count,
          COUNT(DISTINCT user_id) as employee_count,
          (SELECT SUM(total_screenshots) FROM public.employee_analytics WHERE organization_id = v_organization_id) as total_all
        FROM public.employee_analytics,
        LATERAL jsonb_each(category_breakdown)
        WHERE organization_id = v_organization_id
        GROUP BY key
      ) aggregated
    ),
    'employee_performance', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', ea.user_id,
          'total_screenshots', ea.total_screenshots,
          'most_used_category', ea.most_used_category,
          'last_updated', ea.last_updated,
          'employee_name', COALESCE(u.full_name, u.email, 'Unknown'),
          'employee_email', u.email
        ) ORDER BY ea.total_screenshots DESC
      )
      FROM public.employee_analytics ea
      LEFT JOIN public.users u ON u.id = ea.user_id
      WHERE ea.organization_id = v_organization_id
    ),
    'productivity_trends', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', date,
          'total_screenshots', total_screenshots,
          'active_employees', active_employees
        ) ORDER BY date DESC
      )
      FROM (
        SELECT
          date,
          SUM(screenshots)::integer as total_screenshots,
          COUNT(DISTINCT user_id)::integer as active_employees
        FROM public.employee_analytics,
        LATERAL jsonb_array_elements(timeline) as timeline_entry
        WHERE organization_id = v_organization_id
          AND (timeline_entry->>'date') IS NOT NULL
        GROUP BY date
        ORDER BY date DESC
        LIMIT 30
      ) trends
    ),
    'insights', (
      SELECT jsonb_agg(insight ORDER BY priority)
      FROM (
        SELECT
          jsonb_build_object(
            'type', 'warning',
            'priority', 1,
            'title', 'Critical: Disengaged Employees',
            'message', format('%.0f employee(s) show minimal activity (< 5 screenshots). Immediate action needed.', disengaged_count),
            'action', 'Schedule check-ins to identify obstacles and offer support'
          ) as insight
        FROM (
          SELECT COUNT(*)::numeric as disengaged_count
          FROM public.employee_analytics
          WHERE organization_id = v_organization_id AND total_screenshots < 5
        ) t1
        WHERE disengaged_count > 0

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', 'warning',
            'priority', 2,
            'title', 'Low Activity Employees',
            'message', format('%.0f employee(s) have moderate activity (5-20 screenshots). May need guidance.', moderate_count),
            'action', 'Provide additional training or resources'
          ) as insight
        FROM (
          SELECT COUNT(*)::numeric as moderate_count
          FROM public.employee_analytics
          WHERE organization_id = v_organization_id AND total_screenshots BETWEEN 5 AND 20
        ) t2
        WHERE moderate_count > 0

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', 'success',
            'priority', 3,
            'title', 'Top Performers Identified',
            'message', format('%.0f employee(s) in top 20%% for productivity. Setting excellent standards.', top_count),
            'action', 'Recognize achievements and document best practices for team learning'
          ) as insight
        FROM (
          SELECT COUNT(*)::numeric as top_count
          FROM public.employee_analytics
          WHERE organization_id = v_organization_id
            AND total_screenshots > (
              SELECT PERCENTILE_CONT(0.8) WITHIN GROUP (ORDER BY total_screenshots)
              FROM public.employee_analytics
              WHERE organization_id = v_organization_id
            )
        ) t3
        WHERE top_count > 0

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', 'info',
            'priority', 4,
            'title', 'Primary Focus Area',
            'message', format('Team focuses on %s (%.1f%% of activity). Ensure tools and training are optimized.', top_category, top_pct),
            'action', 'Audit tool availability, schedule team training on advanced features'
          ) as insight
        FROM (
          SELECT key as top_category, ROUND((SUM((value->>'count')::integer)::numeric / NULLIF(SUM(total_screenshots), 0) * 100)::numeric, 1) as top_pct
          FROM (SELECT key, value, SUM(total_screenshots) OVER() as total_screenshots FROM public.employee_analytics, LATERAL jsonb_each(category_breakdown) WHERE organization_id = v_organization_id) cat_data
          GROUP BY key
          ORDER BY SUM((value->>'count')::integer) DESC
          LIMIT 1
        ) t4
        WHERE top_category IS NOT NULL

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', CASE WHEN social_pct > 30 THEN 'warning' WHEN social_pct > 15 THEN 'info' ELSE 'success' END,
            'priority', 5,
            'title', CASE WHEN social_pct > 30 THEN 'High Social Media Usage Alert' WHEN social_pct > 15 THEN 'Elevated Social Media Activity' ELSE 'Healthy Social Media Balance' END,
            'message', format('Social media: %.1f%% of activity. %s', social_pct, CASE WHEN social_pct > 30 THEN 'Indicates productivity concerns.' WHEN social_pct > 15 THEN 'Monitor trends; clarify policies if needed.' ELSE 'Team maintains healthy balance.' END),
            'action', CASE WHEN social_pct > 30 THEN 'Establish break policies, schedule focused work blocks' WHEN social_pct > 15 THEN 'Discuss productivity expectations' ELSE 'Continue monitoring' END
          ) as insight
        FROM (
          SELECT ROUND((SUM(CASE WHEN key = 'social_media' THEN (value->>'count')::integer ELSE 0 END)::numeric / NULLIF(SUM(total_screenshots), 0) * 100)::numeric, 1) as social_pct, SUM(total_screenshots) as total_screenshots
          FROM public.employee_analytics, LATERAL jsonb_each(category_breakdown)
          WHERE organization_id = v_organization_id
        ) t5
        WHERE total_screenshots > 0

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', CASE WHEN comm_pct < 10 THEN 'warning' ELSE 'success' END,
            'priority', 6,
            'title', CASE WHEN comm_pct < 10 THEN 'Low Communication Tool Adoption' ELSE 'Strong Team Collaboration' END,
            'message', format('Communication tools: %.1f%% of activity. %s', comm_pct, CASE WHEN comm_pct < 10 THEN 'May indicate external tool usage.' ELSE 'Team actively collaborates.' END),
            'action', CASE WHEN comm_pct < 10 THEN 'Review tool adoption, provide team training' ELSE 'Ensure advanced features are accessible' END
          ) as insight
        FROM (
          SELECT ROUND((SUM(CASE WHEN key = 'communication' THEN (value->>'count')::integer ELSE 0 END)::numeric / NULLIF(SUM(total_screenshots), 0) * 100)::numeric, 1) as comm_pct, SUM(total_screenshots) as total_screenshots
          FROM public.employee_analytics, LATERAL jsonb_each(category_breakdown)
          WHERE organization_id = v_organization_id
        ) t6
        WHERE total_screenshots > 0

        UNION ALL

        SELECT
          jsonb_build_object(
            'type', 'info',
            'priority', 7,
            'title', 'Email Activity Review',
            'message', format('Email usage: %.1f%% of activity. %s', email_pct, CASE WHEN email_pct < 5 THEN 'Using alternative communication.' WHEN email_pct < 15 THEN 'Balanced email patterns.' ELSE 'High email dependency.' END),
            'action', CASE WHEN email_pct < 5 THEN 'Ensure critical comms monitored' WHEN email_pct >= 15 THEN 'Implement email management practices' ELSE 'Current balance is good' END
          ) as insight
        FROM (
          SELECT ROUND((SUM(CASE WHEN key = 'email' THEN (value->>'count')::integer ELSE 0 END)::numeric / NULLIF(SUM(total_screenshots), 0) * 100)::numeric, 1) as email_pct, SUM(total_screenshots) as total_screenshots
          FROM public.employee_analytics, LATERAL jsonb_each(category_breakdown)
          WHERE organization_id = v_organization_id
        ) t7
        WHERE total_screenshots > 0
      ) all_insights
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_company_analytics(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_company_analytics IS 'Aggregates employee analytics to provide company-wide insights including productivity trends, category breakdowns, and actionable recommendations';

