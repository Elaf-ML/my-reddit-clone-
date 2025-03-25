-- Updated SQL function that properly handles nested comment deletion
CREATE OR REPLACE FUNCTION delete_comment_as_post_owner(
  comment_id UUID,
  user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  post_owner_id UUID;
  target_post_id UUID;
  success BOOLEAN := FALSE;
BEGIN
  -- Get the post_id for this comment
  SELECT post_id INTO target_post_id 
  FROM "Comments" 
  WHERE id = comment_id;
  
  IF target_post_id IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  
  -- Verify this post exists and get its owner
  SELECT user_id INTO post_owner_id 
  FROM "Posts" 
  WHERE id = target_post_id;
  
  IF post_owner_id IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;
  
  -- Check if user is post owner
  IF post_owner_id = user_id THEN
    -- Delete the comment and all its replies using recursive CTE
    WITH RECURSIVE comment_tree AS (
      -- Start with the comment to be deleted
      SELECT id FROM "Comments" WHERE id = comment_id
      
      UNION ALL
      
      -- Add all child comments that have the current comments as parents
      SELECT c.id 
      FROM "Comments" c
      JOIN comment_tree ct ON c.parent_id = ct.id
    )
    DELETE FROM "Comments" WHERE id IN (SELECT id FROM comment_tree);
    
    success := TRUE;
  ELSE
    RAISE EXCEPTION 'User % is not the owner of post %', user_id, target_post_id;
  END IF;
  
  RETURN success;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error in delete_comment_as_post_owner: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION delete_comment_as_post_owner TO authenticated; 