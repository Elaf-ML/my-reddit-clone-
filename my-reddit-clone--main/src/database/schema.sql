-- Make sure Posts table has a votes column
ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;

-- Make sure Comments table has a parent_id column for nested replies
ALTER TABLE "Comments" ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES "Comments"(id) NULL;

-- Create UserVotes table to track individual user votes
CREATE TABLE IF NOT EXISTS "UserVotes" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES "Posts"(id) ON DELETE CASCADE,
  vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Add Row Level Security (RLS) to UserVotes
ALTER TABLE "UserVotes" ENABLE ROW LEVEL SECURITY;

-- Create policies for UserVotes
CREATE POLICY "Users can manage their own votes" 
ON "UserVotes" FOR ALL TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read votes" 
ON "UserVotes" FOR SELECT TO anon, authenticated 
USING (true);

-- Create stored procedure for atomic vote operations
CREATE OR REPLACE FUNCTION vote_on_post(
  p_user_id UUID,
  p_post_id UUID,
  p_vote_value INTEGER
) RETURNS INTEGER AS $$
DECLARE
  current_votes INTEGER;
  new_votes INTEGER;
  post_exists BOOLEAN;
  existing_vote INTEGER;
BEGIN
  -- Check if post exists
  SELECT EXISTS(SELECT 1 FROM "Posts" WHERE id = p_post_id) INTO post_exists;
  
  IF NOT post_exists THEN
    RAISE EXCEPTION 'post not found: %', p_post_id;
  END IF;
  
  -- Check if user already voted on this post
  SELECT vote_value INTO existing_vote 
  FROM "UserVotes" 
  WHERE user_id = p_user_id AND post_id = p_post_id;
  
  -- Get current total votes for post
  SELECT votes INTO current_votes FROM "Posts" WHERE id = p_post_id;
  
  -- Set default value if null
  IF current_votes IS NULL THEN
    current_votes := 0;
  END IF;
  
  -- Handle vote logic
  IF existing_vote IS NULL THEN
    -- No previous vote, add new vote
    INSERT INTO "UserVotes" (user_id, post_id, vote_value)
    VALUES (p_user_id, p_post_id, p_vote_value);
    
    -- Update total
    new_votes := current_votes + p_vote_value;
  ELSIF existing_vote = p_vote_value THEN
    -- Same vote, remove it (toggle off)
    DELETE FROM "UserVotes" 
    WHERE user_id = p_user_id AND post_id = p_post_id;
    
    -- Update total
    new_votes := current_votes - p_vote_value;
  ELSE
    -- Different vote (switching from up to down or vice versa)
    UPDATE "UserVotes" 
    SET vote_value = p_vote_value
    WHERE user_id = p_user_id AND post_id = p_post_id;
    
    -- Update total (subtract old vote and add new vote)
    new_votes := current_votes - existing_vote + p_vote_value;
  END IF;
  
  -- Update post total
  UPDATE "Posts" SET votes = new_votes WHERE id = p_post_id;
  
  -- Return new vote count
  RETURN new_votes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add schema_version for tracking
CREATE TABLE IF NOT EXISTS "schema_version" (
  id SERIAL PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the current schema version
INSERT INTO "schema_version" (version) 
VALUES ('1.1.0-user-votes-tracking');

-- If you had old tables, uncomment to drop them
-- DROP TABLE IF EXISTS "Votes";
-- DROP TABLE IF EXISTS "SavedPosts";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS "Comments";
DROP TABLE IF EXISTS "Posts";

-- Create Posts table
CREATE TABLE "Posts" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    image_url TEXT,
    username VARCHAR(255),
    votes INTEGER DEFAULT 0
);

-- Create Comments table
CREATE TABLE "Comments" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES "Posts"(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    parent_id UUID REFERENCES "Comments"(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX comments_post_id_idx ON "Comments"(post_id);
CREATE INDEX comments_parent_id_idx ON "Comments"(parent_id); 