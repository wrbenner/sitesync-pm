-- AI Usage Tracking for rate limiting and billing

CREATE TABLE IF NOT EXISTS ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  function_name text NOT NULL,
  input_tokens int DEFAULT 0,
  output_tokens int DEFAULT 0,
  model text DEFAULT 'claude-sonnet-4-20250514',
  cost_cents numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_usage_project_date ON ai_usage(project_id, created_at);
CREATE INDEX idx_ai_usage_user_date ON ai_usage(user_id, created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_select ON ai_usage FOR SELECT USING (is_project_member(project_id));
CREATE POLICY ai_usage_insert ON ai_usage FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_ai_rate_limit(p_user_id uuid, p_limit int DEFAULT 100)
RETURNS boolean AS $$
DECLARE
  count int;
BEGIN
  SELECT COUNT(*) INTO count
  FROM ai_usage
  WHERE user_id = p_user_id
    AND function_name = 'ai_chat'
    AND created_at > now() - interval '24 hours';
  RETURN count < p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
