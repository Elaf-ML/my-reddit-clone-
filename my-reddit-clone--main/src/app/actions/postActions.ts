import { createSlug } from '../../utils/helpers';
import { supabase } from '../../utils/supabaseClient';

export interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  user_id: string;
  username?: string;
  slug: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

// Get all posts (for public viewing)
export async function getAllPosts(): Promise<{ posts: Post[]; error: string | null }> {
  try {
    console.log('Fetching all posts...');
    
    // Force cache refresh by adding timestamp parameter
    const { data: postsData, error: postsError } = await supabase
      .from('Posts')
      .select('*')
      .order('created_at', { ascending: false });
        
    if (postsError) {
      console.error('Error fetching posts:', postsError.message);
      console.log('Response status:', postsError.code, postsError.details, postsError.hint);
      return { posts: [], error: postsError.message };
    }
    
    console.log(`Retrieved ${postsData?.length || 0} posts`);

    if (!postsData || postsData.length === 0) {
      console.log('No posts found');
      return { posts: [], error: null };
    }

    // Get all user IDs for posts that don't have a username
    const userIds = [...new Set(postsData
      .filter(post => !post.username)
      .map(post => post.user_id)
    )];
    
    console.log(`Need to fetch usernames for ${userIds.length} users`);

    let userProfiles: Record<string, string> = {};

    // Only fetch profiles if we have user IDs that need usernames
    if (userIds.length > 0) {
      // Only use uppercase 'Users' table name
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError.message);
      } else {
        console.log(`Retrieved ${usersData?.length || 0} user profiles`);
        // Create a map of user_id to username
        userProfiles = (usersData || []).reduce((acc: Record<string, string>, user) => {
          acc[user.id] = user.username;
          return acc;
        }, {});
      }
    }

    // Process posts to ensure all have usernames
    const processedPosts = postsData.map(post => ({
      ...post,
      // Use existing username if available, otherwise use the one from userProfiles
      username: post.username || userProfiles[post.user_id] || 'Unknown user'
    }));

    return { posts: processedPosts, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getAllPosts:', error);
    return { posts: [], error: 'An unexpected error occurred fetching posts' };
  }
}

// Get posts by the current user
export async function getUserPosts(userId: string): Promise<{ posts: Post[]; error: string | null }> {
  try {
    const { data: postsData, error: postsError } = await supabase
      .from('Posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('Error fetching posts:', postsError.message);
      return { posts: [], error: postsError.message };
    }

    // Get all user IDs for posts that don't have a username
    const userIds = [...new Set(postsData
      .filter(post => !post.username)
      .map(post => post.user_id)
    )];

    let userProfiles: Record<string, string> = {};

    // Only fetch profiles if we have user IDs that need usernames
    if (userIds.length > 0) {
      // Fetch profile information for those users
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError.message);
      } else {
        // Create a map of user_id to username
        userProfiles = (usersData || []).reduce((acc: Record<string, string>, user) => {
          acc[user.id] = user.username;
          return acc;
        }, {});
      }
    }

    // Process posts to ensure all have usernames
    const processedPosts = postsData.map(post => ({
      ...post,
      // Use existing username if available, otherwise use the one from userProfiles
      username: post.username || userProfiles[post.user_id] || 'Unknown user'
    }));

    return { posts: processedPosts, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getUserPosts:', error);
    return { posts: [], error: 'An unexpected error occurred.' };
  }
}

// Get a post by ID
export async function getPostById(postId: string): Promise<{ post: Post | null; error: string | null }> {
  try {
    const { data: post, error } = await supabase
      .from('Posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (error) {
      console.error('Error fetching post:', error.message);
      return { post: null, error: error.message };
    }

    // Fetch user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', post.user_id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError.message);
    } else if (userData) {
      post.username = userData.username;
    }

    return { post, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getPostById:', error);
    return { post: null, error: 'An unexpected error occurred.' };
  }
}

// Get a post by slug
export async function getPostBySlug(slug: string): Promise<{ post: Post | null; error: string | null }> {
  try {
    console.log('Fetching post with slug:', slug);
    
    // Only use uppercase 'Posts' table name
    const { data: post, error } = await supabase
      .from('Posts')
      .select('*')
      .eq('slug', slug)
      .single();
      
    if (error) {
      console.error('Error fetching post by slug:', error.message);
      return { post: null, error: error.message };
    }
    
    if (!post) {
      return { post: null, error: 'Post not found' };
    }

    // Fetch user info - only use uppercase 'Users' table name
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', post.user_id)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError.message);
    } else if (userData) {
      post.username = userData.username;
    }
    
    console.log('Post found:', post);

    return { post, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getPostBySlug:', error);
    return { post: null, error: 'An unexpected error occurred.' };
  }
}

// Create a new post
export async function createPost(title: string, content: string, userId: string, imageUrl: string | null = null): Promise<{ post: Post | null; error: string | null }> {
  try {
    // Generate a slug from the title
    const slug = createSlug(title);
    
    const { data, error } = await supabase
      .from('Posts')
      .insert([
        {
          title,
          content,
          user_id: userId,
          image_url: imageUrl,
          slug
        },
      ])
      .select();

    if (error) {
      console.error('Error creating post:', error.message);
      return { post: null, error: error.message };
    }

    return { post: data[0], error: null };
  } catch (error: any) {
    console.error('Unexpected error in createPost:', error);
    return { post: null, error: 'An unexpected error occurred.' };
  }
}

// Update an existing post
export async function updatePost(postId: string, title: string, content: string, imageUrl: string | null = null): Promise<{ post: Post | null; error: string | null }> {
  try {
    // Generate a new slug if title has changed
    const slug = createSlug(title);
    
    const { data, error } = await supabase
      .from('Posts')
      .update({
        title,
        content,
        image_url: imageUrl,
        slug
      })
      .eq('id', postId)
      .select();

    if (error) {
      console.error('Error updating post:', error.message);
      return { post: null, error: error.message };
    }

    return { post: data[0], error: null };
  } catch (error: any) {
    console.error('Unexpected error in updatePost:', error);
    return { post: null, error: 'An unexpected error occurred.' };
  }
}

// Delete a post
export async function deletePost(postId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.user?.id) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const userId = session.session.user.id;
    
    // First attempt: Try using our new SQL function that handles everything with proper permissions
    try {
      const { data, error } = await supabase.rpc('delete_post_completely', {
        post_id: postId,
        user_id: userId
      });
      
      if (!error) {
        if (data === true) {
          return { success: true, error: null };
        } else {
          return { success: false, error: 'Permission denied or post not found' };
        }
      }
      
      // If the function call failed, log the error and fall back to manual deletion
      console.error('SQL function error:', error);
    } catch (sqlError) {
      console.error('Error calling delete_post_completely:', sqlError);
    }
    
    // Fallback: Manual deletion (this shouldn't be needed if our SQL function exists)
    
    // Verify the user is the post owner
    const { data: post, error: postError } = await supabase
      .from('Posts')
      .select('user_id')
      .eq('id', postId)
      .single();
      
    if (postError) {
      return { success: false, error: postError.message };
    }
    
    if (post.user_id !== userId) {
      return { success: false, error: 'You can only delete your own posts' };
    }
    
    // Delete the post (comments should be deleted by cascade constraint)
    const { error } = await supabase
      .from('Posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('Error deleting post:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Unexpected error in deletePost:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

// Search posts by title
export async function searchPosts(query: string): Promise<{ posts: Post[]; error: string | null }> {
  try {
    console.log('[searchPosts] Starting search with query:', query);
    
    if (!query || query.trim() === '') {
      console.error('[searchPosts] Empty search query provided');
      return { posts: [], error: 'Search query cannot be empty' };
    }

    // Execute the simplest possible query - no relationships
    const { data: postsData, error: postsError } = await supabase
      .from('Posts')
      .select()
      .ilike('title', `%${query}%`)
      .order('created_at', { ascending: false });
        
    if (postsError) {
      console.error('[searchPosts] Error searching posts:', postsError);
      return { posts: [], error: postsError.message };
    }
    
    console.log(`Retrieved ${postsData?.length || 0} posts`);

    if (!postsData || postsData.length === 0) {
      console.log('No posts found');
      return { posts: [], error: null };
    }

    // Get all user IDs for posts that don't have a username
    const userIds = [...new Set(postsData
      .filter(post => !post.username)
      .map(post => post.user_id)
    )];
    
    console.log(`Need to fetch usernames for ${userIds.length} users`);

    let userProfiles: Record<string, { username: string; avatar: string | null }> = {};

    // Only fetch profiles if we have user IDs that need usernames
    if (userIds.length > 0) {
      // Only use uppercase 'Users' table name
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, avatar')
        .in('id', userIds);

      if (usersError) {
        console.error('Error fetching users:', usersError.message);
      } else {
        console.log(`Retrieved ${usersData?.length || 0} user profiles`);
        // Create a map of user_id to username and avatar_url
        userProfiles = (usersData || []).reduce((acc: Record<string, { username: string; avatar: string | null }>, user) => {
          acc[user.id] = {
            username: user.username,
            avatar: user.avatar
          };
          return acc;
        }, {});
      }
    }

    // Process posts to ensure all have usernames and avatar_urls
    const processedPosts = postsData.map(post => ({
      ...post,
      // Use existing username if available, otherwise use the one from userProfiles
      username: post.username || userProfiles[post.user_id]?.username || 'Unknown user',
      avatar: post.avatar || userProfiles[post.user_id]?.avatar|| null
    }));

    return { posts: processedPosts, error: null };
  } catch (error: any) {
    console.error('Unexpected error in searchPosts:', error);
    return { posts: [], error: 'An unexpected error occurred.' };
  }
}