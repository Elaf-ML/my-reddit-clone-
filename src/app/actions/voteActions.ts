'use server';

import { supabase } from '../../utils/supabaseClient';

export interface VoteData {
  id: string;
  user_id: string;
  post_id: string;
  vote_value: number;
  created_at: string;
}

// Get user's current vote for a post
export async function getUserVote(userId: string, postId: string) {
  if (!userId || !postId) {
    return 0; // No vote if missing info
  }

  try {
    const { data, error } = await supabase
      .from('UserVotes')
      .select('vote_value')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();
    
    if (error) {
      // If error is PGRST116 (no results), return 0
      if (error.code === 'PGRST116') {
        return 0;
      }
      
      // For other errors, log and return 0
      console.error('Error getting user vote:', error);
      return 0;
    }
    
    // Return the vote value
    return data?.vote_value || 0;
  } catch (err) {
    console.error('Error in getUserVote:', err);
    return 0;
  }
}

// Get all user votes for posts
export async function getUserVotes(userId: string) {
  if (!userId) {
    return {};
  }

  try {
    const { data, error } = await supabase
      .from('UserVotes')
      .select('post_id, vote_value')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error getting user votes:', error);
      return {};
    }
    
    // Build a map of post_id -> vote_value
    const votesMap: Record<string, number> = {};
    data?.forEach(vote => {
      votesMap[vote.post_id] = vote.vote_value;
    });
    
    return votesMap;
  } catch (err) {
    console.error('Error in getUserVotes:', err);
    return {};
  }
}

// Get current vote count for a post
export async function getPostVotes(postId: string) {
  try {
    // First verify post exists
    const { count, error: countError } = await supabase
      .from('Posts')
      .select('*', { count: 'exact', head: true })
      .eq('id', postId);
      
    if (countError || !count) {
      console.error('Post not found or error checking post:', postId, countError);
      return 0;
    }
    
    const { data, error } = await supabase
      .from('Posts')
      .select('votes')
      .eq('id', postId)
      .single();
    
    if (error) {
      console.error('Error getting post votes:', error);
      return 0;
    }
    
    return data.votes || 0;
  } catch (err) {
    console.error('Error in getPostVotes:', err);
    return 0;
  }
}

// Increment or decrement post votes
export async function voteOnPost(userId: string, postId: string, voteValue: number) {
  if (!userId || !postId) {
    return { success: false, message: 'Missing user ID or post ID' };
  }
  
  if (![1, -1].includes(voteValue)) {
    return { success: false, message: 'Invalid vote value. Must be 1 or -1' };
  }
  
  try {
    // Use a transaction to make operations atomic
    const { data, error } = await supabase.rpc('vote_on_post', {
      p_user_id: userId,
      p_post_id: postId,
      p_vote_value: voteValue
    });
    
    if (error) {
      // Handle specific errors
      if (error.message.includes('post not found') || error.code === 'PGRST116') {
        console.error('Post not found:', postId);
        return { success: false, message: `Post not found: ${postId}` };
      }
      
      console.error('Error voting on post:', error);
      return { success: false, message: `Database error: ${error.message}` };
    }
    
    // Get the user's new vote status
    const userVote = await getUserVote(userId, postId);
    
    // If successful, data should contain the new vote total
    return { 
      success: true, 
      message: 'Vote recorded', 
      newTotal: data,
      userVote: userVote
    };
  } catch (err: any) {
    console.error('Error in voteOnPost:', err);
    return { success: false, message: `An unexpected error occurred: ${err.message}` };
  }
} 