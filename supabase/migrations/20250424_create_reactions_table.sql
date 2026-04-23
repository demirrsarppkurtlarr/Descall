-- Create reactions table for message emoji reactions
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id TEXT NOT NULL, -- dm or group message id
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('dm', 'group')), -- 'dm' or 'group'
  conversation_id TEXT NOT NULL, -- convKey for dm, groupId for group
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL, -- emoji unicode or shortcode
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji) -- one reaction per emoji per user per message
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_reactions_message ON reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_conversation ON reactions(conversation_id, conversation_type);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);

-- Enable RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see reactions in conversations they're part of
CREATE POLICY "reactions_select_dm" ON reactions
  FOR SELECT
  USING (
    conversation_type = 'dm' AND (
      conversation_id LIKE auth.uid()::text || '-%' OR
      conversation_id LIKE '%-' || auth.uid()::text
    )
  );

CREATE POLICY "reactions_select_group" ON reactions
  FOR SELECT
  USING (
    conversation_type = 'group' AND
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_id = reactions.conversation_id::uuid 
      AND user_id = auth.uid()
    )
  );

-- Policy: Users can only insert their own reactions
CREATE POLICY "reactions_insert" ON reactions
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can only delete their own reactions
CREATE POLICY "reactions_delete" ON reactions
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to get reactions for a message
CREATE OR REPLACE FUNCTION get_message_reactions(msg_id TEXT)
RETURNS TABLE (
  emoji TEXT,
  count BIGINT,
  users JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.emoji,
    COUNT(*) as count,
    jsonb_agg(jsonb_build_object('id', r.user_id, 'username', u.username)) as users
  FROM reactions r
  JOIN users u ON u.id = r.user_id
  WHERE r.message_id = msg_id
  GROUP BY r.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;
