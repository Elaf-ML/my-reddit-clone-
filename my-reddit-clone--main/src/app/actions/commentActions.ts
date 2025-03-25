'use server';

import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { supabase } from '../../utils/supabaseClient';

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  username: string | null;
  replies?: Comment[];
}

// Initialize Supabase client
const getSupabase = () => {
  const cookieStore = cookies();
  
  // Log the available cookies for debugging
  console.log('Available cookie names:', cookieStore.getAll().map(c => c.name));
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookie = cookieStore.get(name);
          console.log(`Getting cookie: ${name}`, cookie?.value ? 'Found' : 'Not found');
          return cookie?.value;
        },
        set(name: string, value: string, options: any) {
          console.log(`Setting cookie: ${name}`);
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          console.log(`Removing cookie: ${name}`);
          cookieStore.delete(name);
        },
      },
    }
  );
};

export async function getPostComments(postId: string) {
  try {
    const supabase = getSupabase();
    console.log(`Fetching comments for post ${postId}...`);
    
    // Only use uppercase 'Comments' table name
    const { data: comments, error } = await supabase
      .from('Comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching comments:', error);
      return { comments: [], error: error.message };
    }
    
    console.log(`Retrieved ${comments?.length || 0} comments for post ${postId}`);
    
    if (!comments || comments.length === 0) {
      return { comments: [], error: null };
    }
    
    // Get user IDs to fetch usernames separately
    const userIds = [...new Set(comments.map((comment: any) => comment.user_id))];
    
    // Only use uppercase 'Users' table name
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIds);
    
    // Create a map of user_id to username
    const usernameMap: Record<string, string> = {};
    if (users && !usersError) {
      users.forEach((user: any) => {
        usernameMap[user.id] = user.username;
      });
    }
    
    // Format comments with usernames
    const formattedComments = comments.map((comment: any) => ({
      ...comment,
      username: usernameMap[comment.user_id] || null,
    }));
    
    // Organize comments into a tree structure
    const commentMap: Record<string, Comment> = {};
    const rootComments: Comment[] = [];
    
    // First pass: Create a map of all comments
    formattedComments.forEach((comment: Comment) => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });
    
    // Second pass: Build the tree structure
    formattedComments.forEach((comment: Comment) => {
      if (comment.parent_id) {
        // This is a reply, add it to its parent's replies array
        const parent = commentMap[comment.parent_id];
        if (parent) {
          parent.replies!.push(comment);
        } else {
          // If parent doesn't exist, treat as a root comment
          rootComments.push(comment);
        }
      } else {
        // This is a root comment
        rootComments.push(comment);
      }
    });
    
    return { comments: rootComments, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getPostComments:', error);
    return { comments: [], error: error.message || 'An unexpected error occurred' };
  }
}

export async function createComment(postId: string, userId: string, content: string, parentId: string | null = null) {
  try {
    const supabase = getSupabase();
    
    console.log('Creating comment with:', { postId, userId, content, parentId });
    
    // Get current auth session to ensure RLS policies are properly applied
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return { comment: null, error: 'Authentication error. Please log in again.' };
    }
    
    if (!session) {
      console.error('No active session found');
      return { comment: null, error: 'No active session. Please log in again.' };
    }
    
    console.log('User session confirmed, proceeding with comment creation');
    
    // Verify parent comment exists if parentId is provided
    if (parentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('Comments')
        .select('id')
        .eq('id', parentId)
        .single();
        
      if (parentError || !parentComment) {
        console.error('Parent comment not found:', parentId);
        return { comment: null, error: 'The comment you are replying to does not exist or has been deleted.' };
      }
    }
    
    // Create the comment with explicitly listed columns
    const { data: comment, error } = await supabase
      .from('Comments')
      .insert([
        {
          content,
          user_id: userId,
          post_id: postId,
          parent_id: parentId,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating comment:', error);
      return { comment: null, error: error.message };
    }
    
    // Fetch the username separately
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', userId)
      .single();
    
    // Format the comment with username
    const formattedComment = {
      ...comment,
      username: userError ? null : userData?.username || null,
    };
    
    return { comment: formattedComment, error: null };
  } catch (error: any) {
    console.error('Unexpected error in createComment:', error);
    return { comment: null, error: error.message || 'An unexpected error occurred' };
  }
}

// Function to recursively delete a comment and all its replies
async function deleteCommentAndReplies(commentId: string) {
  try {
    console.log(`Starting deletion of comment ID: ${commentId}`);
    
    // Use the server-side Supabase client for better reliability
    const supabaseServer = getSupabase();
    
    // Find all replies to this comment
    const { data: replies, error: repliesError } = await supabaseServer
      .from('Comments')
      .select('id')
      .eq('parent_id', commentId);
      
    if (repliesError) {
      console.error('Error finding comment replies:', repliesError);
      return false;
    }
    
    // Log the found replies
    console.log(`Found ${replies?.length || 0} replies to delete for comment ${commentId}`);
    
    // Recursively delete all replies
    if (replies && replies.length > 0) {
      for (const reply of replies) {
        console.log(`Recursively deleting reply: ${reply.id}`);
        const success = await deleteCommentAndReplies(reply.id);
        if (!success) {
          console.error(`Failed to delete reply: ${reply.id}`);
          // Continue with other replies even if one fails
        }
      }
    }
    
    // After handling all replies, delete the comment itself using direct SQL for more reliability
    console.log(`Directly deleting comment from database: ${commentId}`);
    
    // First try the standard API
    const { error: deleteError } = await supabaseServer
      .from('Comments')
      .delete()
      .eq('id', commentId);
      
    if (deleteError) {
      console.error('Error deleting comment from database:', deleteError);
      
      // If the standard API fails, try raw SQL
      try {
        console.log(`Trying raw SQL to delete comment: ${commentId}`);
        await supabaseServer.rpc('execute_sql', {
          sql_query: `DELETE FROM "Comments" WHERE id = '${commentId}'`
        });
      } catch (sqlErr) {
        console.error('Error with raw SQL delete:', sqlErr);
        return false;
      }
    }
    
    // Verify the comment was deleted
    const { data: checkData, error: checkError } = await supabaseServer
      .from('Comments')
      .select('id')
      .eq('id', commentId)
      .single();
      
    if (checkError && checkError.code === 'PGRST116') {
      // PGRST116 means "no rows returned" which is what we want
      console.log(`Successfully verified comment ${commentId} was deleted`);
      return true;
    } else if (checkData) {
      console.error(`Comment ${commentId} still exists in database after deletion attempt`);
      // Try one more direct deletion attempt with raw SQL
      try {
        await supabaseServer.rpc('execute_sql', {
          sql_query: `DELETE FROM "Comments" WHERE id = '${commentId}' RETURNING id`
        });
        console.log(`Final SQL deletion attempt for comment ${commentId} completed`);
        return true;
      } catch (err) {
        console.error('Error in final SQL delete:', err);
        return false;
      }
    } else {
      console.log(`Successfully deleted comment: ${commentId}`);
      return true;
    }
  } catch (err) {
    console.error('Unexpected error in deleteCommentAndReplies:', err);
    return false;
  }
}

// Delete a comment - can be done by the comment author or post author
export async function deleteComment(commentId: string, userId: string) {
  if (!commentId || !userId) {
    return { success: false, message: 'Missing comment ID or user ID' };
  }

  try {
    console.log(`FORCEFUL DELETE: Attempting to delete comment ${commentId} by user ${userId}`);
    
    // Get a fresh supabase client instance with the server context
    const supabaseServer = getSupabase();
    
    // First verify the comment exists and get its post_id
    const { data: comment, error: commentError } = await supabaseServer
      .from('Comments')
      .select('post_id, user_id')
      .eq('id', commentId)
      .single();

    if (commentError) {
      console.error('Error fetching comment:', commentError);
      return { success: false, message: 'Comment not found' };
    }

    // Check if user is the comment author
    const isCommentAuthor = comment.user_id === userId;
    console.log(`User is comment author: ${isCommentAuthor}`);

    // If not the comment author, check if user is the post author
    let isPostAuthor = false;
    if (!isCommentAuthor) {
      const { data: post, error: postError } = await supabaseServer
        .from('Posts')
        .select('user_id')
        .eq('id', comment.post_id)
        .single();

      if (postError) {
        console.error('Error fetching post:', postError);
        return { success: false, message: 'Error verifying post ownership' };
      }

      isPostAuthor = post.user_id === userId;
      console.log(`User is post author: ${isPostAuthor}`);
    }

    // Only allow deletion if user is either comment author or post author
    if (!isCommentAuthor && !isPostAuthor) {
      return { 
        success: false, 
        message: 'You do not have permission to delete this comment' 
      };
    }

    console.log(`FORCEFUL DELETE: Permissions verified, proceeding with comment deletion for ${commentId}`);
    
    // Use the recursive deletion function first - this handles replies properly
    const success = await deleteCommentAndReplies(commentId);
    
    if (success) {
      console.log(`FORCEFUL DELETE: Comment ${commentId} and all its replies successfully deleted using recursive method`);
      return { success: true };
    }
    
    // If recursive deletion failed, try direct approach as backup
    console.log(`FORCEFUL DELETE: Recursive deletion failed, trying direct methods`);
    
    // First try the SQL approach to delete all replies
    try {
      console.log(`FORCEFUL DELETE: Attempting SQL delete for all replies of comment ${commentId}`);
      await supabase.rpc('execute_sql', { 
        sql_query: `DELETE FROM "Comments" WHERE parent_id = '${commentId}'`
      });
    } catch (sqlErr) {
      console.error('FORCEFUL DELETE: SQL delete for replies failed:', sqlErr);
    }
    
    // Then delete the parent comment
    const { error: directDeleteError } = await supabaseServer
      .from('Comments')
      .delete()
      .eq('id', commentId);
      
    if (directDeleteError) {
      console.error('FORCEFUL DELETE: Direct delete failed:', directDeleteError);
      
      // Final desperate attempt with raw SQL
      try {
        console.log(`FORCEFUL DELETE: Final attempt with raw SQL`);
        await supabaseServer.rpc('execute_sql', { 
          sql_query: `DELETE FROM "Comments" WHERE id = '${commentId}'`
        });
      } catch (finalErr) {
        console.error('FORCEFUL DELETE: Final SQL delete failed:', finalErr);
        return { success: false, message: 'Failed to delete comment after multiple attempts' };
      }
    }
    
    // Final verification that both the comment and its replies are gone
    const { data: checkParent } = await supabaseServer
      .from('Comments')
      .select('id')
      .eq('id', commentId);
      
    const { data: checkReplies } = await supabaseServer
      .from('Comments')
      .select('id')
      .eq('parent_id', commentId);
    
    if ((checkParent && checkParent.length > 0) || (checkReplies && checkReplies.length > 0)) {
      console.error(`FORCEFUL DELETE: Comment or replies still exist after all deletion attempts`);
      return { success: false, message: 'Failed to delete comment after multiple attempts' };
    }
    
    console.log(`FORCEFUL DELETE: Comment ${commentId} and all its replies successfully deleted`);
    return { success: true };
  } catch (err) {
    console.error('FORCEFUL DELETE: Unexpected error in deleteComment:', err);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

export async function deleteCommentAsPostAuthor(commentId: string, userId: string) {
  try {
    console.log(`[AUTH DELETE] Starting deletion of comment ${commentId} by user ${userId}`);
    
    // Use the createClient approach to get a fresh client with the correct auth
    const supabase = getSupabase();
    
    // Step 1: Get the comment and its post information
    const { data: commentData, error: commentError } = await supabase
      .from('Comments')
      .select('id, post_id, user_id, parent_id')
      .eq('id', commentId)
      .maybeSingle();
      
    if (commentError) {
      console.error('[AUTH DELETE] Error fetching comment:', commentError);
      return { success: false, error: 'Could not find comment' };
    }
    
    if (!commentData) {
      console.error('[AUTH DELETE] Comment not found:', commentId);
      return { success: false, error: 'Comment not found' };
    }
    
    console.log('[AUTH DELETE] Found comment:', commentData);
    
    // Step 2: Check if the user is the post owner
    const { data: postData, error: postError } = await supabase
      .from('Posts')
      .select('id, user_id')
      .eq('id', commentData.post_id)
      .maybeSingle();
      
    if (postError) {
      console.error('[AUTH DELETE] Error fetching post:', postError);
      return { success: false, error: 'Could not verify post ownership' };
    }
    
    if (!postData) {
      console.error('[AUTH DELETE] Post not found:', commentData.post_id);
      return { success: false, error: 'Post not found' };
    }
    
    console.log('[AUTH DELETE] Found post:', postData);
    
    // Check if the user is the post owner
    const isPostOwner = postData.user_id === userId;
    
    if (!isPostOwner) {
      console.error('[AUTH DELETE] User is not post owner. Post owner:', postData.user_id, 'User:', userId);
      return { success: false, error: 'You must be the post owner to delete this comment' };
    }
    
    console.log('[AUTH DELETE] User confirmed as post owner, proceeding with deletion');
    
    // Step 3: First find and store all replies to delete them separately
    // This is a backup approach in case cascade delete doesn't work
    const { data: repliesData, error: repliesError } = await supabase
      .from('Comments')
      .select('id')
      .eq('parent_id', commentId);
      
    const replyIds = repliesData?.map(reply => reply.id) || [];
    console.log(`[AUTH DELETE] Found ${replyIds.length} direct replies to delete:`, replyIds);
    
    // Step 4: Delete the replies first (if any)
    if (replyIds.length > 0) {
      for (const replyId of replyIds) {
        const { error: replyDeleteError } = await supabase
          .from('Comments')
          .delete()
          .eq('id', replyId);
          
        if (replyDeleteError) {
          console.error(`[AUTH DELETE] Error deleting reply ${replyId}:`, replyDeleteError);
          // Continue with other replies even if one fails
        } else {
          console.log(`[AUTH DELETE] Successfully deleted reply: ${replyId}`);
        }
      }
    }
    
    // Step 5: Delete the main comment
    const { error: deleteError } = await supabase
      .from('Comments')
      .delete()
      .eq('id', commentId);
      
    if (deleteError) {
      console.error('[AUTH DELETE] Error deleting main comment:', deleteError);
      return { success: false, error: 'Failed to delete comment' };
    }
    
    console.log(`[AUTH DELETE] Successfully deleted comment ${commentId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[AUTH DELETE] Unexpected error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Completely purges a comment and all its replies from the database
 * This function uses multiple deletion approaches to ensure the comment is removed
 * @param commentId The ID of the comment to delete
 * @param userId The ID of the user deleting the comment
 * @returns Object indicating success or failure with additional information
 */
export async function purgeCommentCompletely(commentId: string, userId: string) {
  try {
    console.log(`[PURGE DELETE] Starting complete deletion of comment ${commentId} by user ${userId}`);
    
    const supabase = getSupabase();
    
    // Call our improved SQL function to handle deletion properly
    const { data, error } = await supabase
      .rpc('delete_comment_completely', {
        comment_id: commentId,
        user_id: userId
      });
    
    if (error) {
      console.error('[PURGE DELETE] Error calling delete_comment_completely function:', error);
      return { success: false, error: error.message };
    }
    
    if (data === true) {
      console.log('[PURGE DELETE] Comment successfully deleted with SQL function');
      return { success: true, error: null };
    } else {
      console.log('[PURGE DELETE] Permission denied or comment not found');
      return { success: false, error: 'Permission denied or comment not found' };
    }
  } catch (error: any) {
    console.error('[PURGE DELETE] Unexpected error:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
} 