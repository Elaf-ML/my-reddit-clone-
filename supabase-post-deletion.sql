-- Function to delete a post and all its comments (including nested comments)
CREATE OR REPLACE FUNCTION delete_post_with_comments(post_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  success BOOLEAN := FALSE;
BEGIN
  -- Start a transaction to ensure all operations succeed or fail together
  BEGIN
    -- Delete all comments for this post, including replies
    -- First, delete comments that have parent_id (replies)
    DELETE FROM "Comments"
    WHERE post_id = post_id AND parent_id IS NOT NULL;

    -- Then delete root comments
    DELETE FROM "Comments"
    WHERE post_id = post_id;
    
    -- Delete votes for this post (if table exists)
    BEGIN
      DELETE FROM "UserVotes" WHERE post_id = post_id;
      EXCEPTION WHEN undefined_table THEN
        -- Ignore if UserVotes table doesn't exist
        NULL;
    END;
    
    -- Finally delete the post itself
    DELETE FROM "Posts" WHERE id = post_id;
    
    success := TRUE;
    RETURN success;
  EXCEPTION WHEN OTHERS THEN
    -- Roll back on any error
    RAISE NOTICE 'Error deleting post: %', SQLERRM;
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy to allow calling this function
GRANT EXECUTE ON FUNCTION delete_post_with_comments TO authenticated;

-- Alternative method: Add cascade delete to foreign keys
-- This allows database-level cascading deletions
-- WARNING: Only run this if you want posts to automatically delete all related comments

-- First, drop the existing foreign key constraint
ALTER TABLE "Comments" DROP CONSTRAINT IF EXISTS "Comments_post_id_fkey";

-- Then add it back with CASCADE delete
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_post_id_fkey" 
  FOREIGN KEY (post_id) REFERENCES "Posts" (id) ON DELETE CASCADE;

-- Optionally, add CASCADE to the parent_id foreign key as well
ALTER TABLE "Comments" DROP CONSTRAINT IF EXISTS "Comments_parent_id_fkey";
ALTER TABLE "Comments" ADD CONSTRAINT "Comments_parent_id_fkey" 
  FOREIGN KEY (parent_id) REFERENCES "Comments" (id) ON DELETE CASCADE; 