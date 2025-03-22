'use server';

import { supabase } from '../../utils/supabaseClient';
import { Post } from './postActions';

// Get all saved posts for a user
export async function getSavedPosts(userId: string): Promise<{ savedPosts: Post[]; error: string | null }> {
  try {
    // First get the saved post IDs
    const { data: savedData, error: savedError } = await supabase
      .from('SavedPosts')
      .select('post_id') 
      .eq('user_id', userId);
      
    if (savedError) {
      console.error('Error fetching saved posts:', savedError);
      return { savedPosts: [], error: savedError.message };
    }
    
    if (!savedData || savedData.length === 0) {
      return { savedPosts: [], error: null };
    }
    
    // Extract post IDs
    const postIds = savedData.map(item => item.post_id);
    
    // Fetch the actual posts
    const { data: postsData, error: postsError } = await supabase
      .from('Posts')
      .select(`
        *,
        votes:Votes(vote_value)
      `)
      .in('id', postIds);
      
    if (postsError) {
      console.error('Error fetching saved post data:', postsError);
      return { savedPosts: [], error: postsError.message };
    }
    
    // Process posts to add user info and calculate votes
    const processedPosts = await Promise.all((postsData || []).map(async (post) => {
      // Calculate vote total
      const voteTotal = post.votes 
        ? post.votes.reduce((sum: number, vote: any) => sum + (vote.vote_value || 0), 0) 
        : 0;
        
      // Get username for post
      let username = 'Anonymous';
      if (post.user_id) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('username')
          .eq('id', post.user_id)
          .single();
          
        if (!userError && userData) {
          username = userData.username;
        }
      }
      
      return {
        ...post,
        votes: voteTotal,
        username
      };
    }));
    
    return { savedPosts: processedPosts, error: null };
  } catch (err: any) {
    console.error('Unexpected error in getSavedPosts:', err);
    return { savedPosts: [], error: 'An unexpected error occurred' };
  }
}

// Save a post
export async function savePost(
  userId: string, 
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if already saved
    const { data: existingSave, error: checkError } = await supabase
      .from('SavedPosts')
      .select('*')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();
      
    if (checkError) {
      console.error('Error checking if post is saved:', checkError);
      return { success: false, error: checkError.message };
    }
    
    if (existingSave) {
      // Already saved, do nothing
      return { success: true, error: null };
    }
    
    // Insert new saved post
    const { error: insertError } = await supabase
      .from('SavedPosts')
      .insert([
        { user_id: userId, post_id: postId }
      ]);
      
    if (insertError) {
      console.error('Error saving post:', insertError);
      return { success: false, error: insertError.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error in savePost:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Unsave a post
export async function unsavePost(
  userId: string, 
  postId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('SavedPosts')
      .delete()
      .eq('user_id', userId)
      .eq('post_id', postId);
      
    if (error) {
      console.error('Error unsaving post:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, error: null };
  } catch (err: any) {
    console.error('Unexpected error in unsavePost:', err);
    return { success: false, error: 'An unexpected error occurred' };
  }
}

// Check if a post is saved
export async function isPostSaved(
  userId: string, 
  postId: string
): Promise<{ saved: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('SavedPosts')
      .select('*')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .maybeSingle();
      
    if (error) {
      console.error('Error checking if post is saved:', error);
      return { saved: false, error: error.message };
    }
    
    return { saved: !!data, error: null };
  } catch (err: any) {
    console.error('Unexpected error in isPostSaved:', err);
    return { saved: false, error: 'An unexpected error occurred' };
  }
} 