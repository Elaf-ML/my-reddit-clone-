'use server';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { supabase } from '../../utils/supabaseClient';
import { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  username: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
}

// Initialize Supabase client
const getSupabase = () => {
  const cookieStore = cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: any) {
          cookieStore.delete(name);
        },
      },
    }
  );
};

export async function getCurrentUser() {
  try {
    const supabase = getSupabase();
    
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error getting session:', sessionError);
      return { user: null, error: sessionError.message };
    }
    
    if (!session) {
      console.log('No session found');
      return { user: null, error: null };
    }
    
    console.log('Session found:', session.user.id);
    
    // Try both 'profiles' and 'Profiles' to handle case sensitivity
    let userData = null;
    let userError = null;

    // First try with lowercase
    const profilesResult = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    
    userData = profilesResult.data;
    userError = profilesResult.error;
    
    // If error, try with uppercase
    if (userError) {
      console.log('Error with lowercase profiles, trying uppercase Profiles');
      const profilesUpperResult = await supabase
        .from('Profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      userData = profilesUpperResult.data;
      userError = profilesUpperResult.error;
    }
    
    if (userError) {
      console.error('Error fetching user profile:', userError);
      // Return the user anyway, just with auth data
      const user = {
        ...session.user,
      };
      console.log('Returning user with just auth data:', user);
      return { user, error: null };
    }
    
    // Combine auth user and profile data
    const user = {
      ...session.user,
      ...(userData || {}),
    };
    
    console.log('User data retrieved successfully:', user);
    return { user, error: null };
  } catch (error: any) {
    console.error('Unexpected error in getCurrentUser:', error);
    return { user: null, error: error.message || 'An unexpected error occurred' };
  }
}

// Get user profile by ID
export async function getUserProfile(userId: string): Promise<{ profile: UserProfile | null; error: string | null }> {
  try {
    // Try with lowercase first
    let { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    // If error, try with uppercase
    if (error) {
      console.log('Error with lowercase users, trying uppercase Users');
      const result = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error fetching user profile:', error.message);
      return { profile: null, error: error.message };
    }

    return { profile: data as UserProfile, error: null };
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return { profile: null, error: 'An unexpected error occurred.' };
  }
}

// Add a friend
export async function addFriend(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if friendship already exists
    const { data: existingFriendship, error: checkError } = await supabase
      .from('Friendships')
      .select('*')
      .match({ user_id: userId, friend_id: friendId });

    if (checkError) {
      console.error('Error checking friendship:', checkError.message);
      return { success: false, error: checkError.message };
    }

    if (existingFriendship && existingFriendship.length > 0) {
      return { success: false, error: 'You are already friends with this user.' };
    }

    // Add friend
    const { error } = await supabase
      .from('Friendships')
      .insert([
        { user_id: userId, friend_id: friendId }
      ]);

    if (error) {
      console.error('Error adding friend:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error in addFriend:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

// Remove a friend
export async function removeFriend(userId: string, friendId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('Friendships')
      .delete()
      .match({ user_id: userId, friend_id: friendId });

    if (error) {
      console.error('Error removing friend:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('Unexpected error in removeFriend:', error);
    return { success: false, error: 'An unexpected error occurred.' };
  }
}

// Get user's friends
export async function getUserFriends(userId: string): Promise<{ friends: UserProfile[]; error: string | null }> {
  try {
    // Try with lowercase first
    let { data, error } = await supabase
      .from('Friendships')
      .select('friend_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching friends:', error.message);
      return { friends: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { friends: [], error: null };
    }

    const friendIds = data.map((f: { friend_id: string }) => f.friend_id);
    
    // Try with lowercase first
    let { data: friendProfiles, error: profilesError } = await supabase
      .from('users')
      .select('*')
      .in('id', friendIds);
      
    // If error, try with uppercase
    if (profilesError) {
      console.log('Error with lowercase users, trying uppercase Users');
      const result = await supabase
        .from('users')
        .select('*')
        .in('id', friendIds);
      
      friendProfiles = result.data;
      profilesError = result.error;
    }

    if (profilesError) {
      console.error('Error fetching friend profiles:', profilesError.message);
      return { friends: [], error: profilesError.message };
    }

    return { friends: friendProfiles as UserProfile[], error: null };
  } catch (error) {
    console.error('Unexpected error in getUserFriends:', error);
    return { friends: [], error: 'An unexpected error occurred.' };
  }
}

// Search for users by username or email
export async function searchUsers(searchText: string): Promise<{ users: UserProfile[]; error: string | null }> {
  try {
    // Get user by username or email in lowercase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .or(`username.ilike.${searchText},email.ilike.${searchText}`);

    if (userError) {
      console.error('Error searching users:', userError.message);
      return { users: [], error: userError.message };
    }

    return { users: userData as UserProfile[], error: null };
  } catch (error) {
    console.error('Unexpected error in searchUsers:', error);
    return { users: [], error: 'An unexpected error occurred.' };
  }
}

// Get all users
export async function getAllUsers(): Promise<{ users: UserProfile[]; error: string | null }> {
  try {
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('*');
    
    if (usersError) {
      console.error('Error getting all users:', usersError.message);
      return { users: [], error: usersError.message };
    }

    return { users: usersData as UserProfile[], error: null };
  } catch (error) {
    console.error('Unexpected error in getAllUsers:', error);
    return { users: [], error: 'An unexpected error occurred.' };
  }
} 