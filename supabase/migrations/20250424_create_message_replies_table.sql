-- Create message replies table for threaded conversations
CREATE TABLE IF NOT EXISTS message_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_message_id TEXT NOT NULL, -- the message being replied to
  reply_message_id TEXT NOT NULL, -- the reply message
  conversation_type TEXT NOT NULL CHECK (conversation_type IN ('dm', 'group')),
  conversation_id TEXT NOT NULL,
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  media_url TEXT,
  media_type TEXT
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_message_replies_parent ON message_replies(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_message_replies_conversation ON message_replies(conversation_id, conversation_type);
CREATE INDEX IF NOT EXISTS idx_message_replies_sender ON message_replies(sender_id);

-- Enable RLS
ALTER TABLE message_replies ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see replies in conversations they're part of
CREATE POLICY "message_replies_select_dm" ON message_replies
  FOR SELECT
  USING (
    conversation_type = 'dm' AND (
      conversation_id LIKE auth.uid()::text || '-%' OR
      conversation_id LIKE '%-' || auth.uid()::text
    )
  );

CREATE POLICY "message_replies_select_group" ON message_replies
  FOR SELECT
  USING (
    conversation_type = 'group' AND
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE group_id = message_replies.conversation_id::uuid 
      AND user_id = auth.uid()
    )
  );

-- Policy: Users can only insert their own replies
CREATE POLICY "message_replies_insert" ON message_replies
  FOR INSERT
  WITH CHECK (sender_id = auth.uid());
