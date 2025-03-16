'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { FaUser, FaCamera, FaEdit, FaCog, FaBell, FaLock, FaSignOutAlt, FaUserFriends, FaRegComment, FaImages } from 'react-icons/fa';
import Link from 'next/link';

export default function ProfilePage() {
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);
          
          // Fetch user profile data
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('username, avatar')
            .eq('id', user.id)
            .single();

          if (userError) {
            setError('Failed to fetch user data');
            console.error(userError);
          } else {
            setUsername(userData.username);
            setAvatar(userData.avatar);
          }
          
          // Fetch post count
          const { count: postsCount, error: postsError } = await supabase
            .from('Posts')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id);
            
          if (postsError) {
            console.error('Error fetching post count:', postsError);
          } else {
            setPostCount(postsCount || 0);
          }
          
          // Fetch comment count
          const { count: commentsCount, error: commentsError } = await supabase
            .from('comments')
            .select('id', { count: 'exact' })
            .eq('user_id', user.id);
            
          if (commentsError) {
            console.error('Error fetching comment count:', commentsError);
          } else {
            setCommentCount(commentsCount || 0);
          }
        } else {
          setError('User not logged in');
        }
      } catch (err) {
        setError('Error fetching user data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleUpdateProfile = async () => {
    try {
      setError(null);
      setSuccessMessage(null);
      
      if (!userId) return;
      
      const { error } = await supabase
        .from('users')
        .update({ username })
        .eq('id', userId);

      if (error) {
        setError('Failed to update profile');
        console.error(error);
      } else {
        setSuccessMessage('Profile updated successfully');
        setEditMode(false);
      }
    } catch (err) {
      setError('Error updating profile');
      console.error(err);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = e.target.files?.[0];
      if (!file || !userId) return;

      setIsUploading(true);
      setError(null);

      // Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) {
        setError('Error uploading avatar');
        console.error(uploadError);
        return;
      }

      // Get public URL
      const { data } = supabase.storage.from('images').getPublicUrl(filePath);
      const avatarUrl = data.publicUrl;

      // Update user profile with new avatar URL
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar: avatarUrl })
        .eq('id', userId);

      if (updateError) {
        setError('Error updating avatar');
        console.error(updateError);
      } else {
        setAvatar(avatarUrl);
        setSuccessMessage('Avatar updated successfully');
      }
    } catch (err) {
      setError('Error processing avatar');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error signing out:', error);
        setError('Failed to sign out');
      } else {
        window.location.href = '/login';
      }
    } catch (err) {
      console.error('Unexpected error during sign out:', err);
      setError('An unexpected error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-4xl mx-auto pt-20 pb-12 px-4 sm:px-6">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md animate-fadeIn">
            <p>{successMessage}</p>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md">
            <p>{error}</p>
          </div>
        )}
        
        {/* Profile Header */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-indigo-600 to-pink-500 h-40 relative">
            <div className="absolute inset-0 bg-black opacity-20"></div>
          </div>
          
          <div className="px-6 py-6 md:flex md:items-center md:justify-between -mt-16 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center">
              <div className="relative group mx-auto md:mx-0">
                <div 
                  className="w-32 h-32 rounded-full border-4 border-white bg-white overflow-hidden shadow-xl cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt={username} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <FaUser className="text-gray-400 text-4xl" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 flex items-center justify-center transition-all duration-200 rounded-full">
                    <FaCamera className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden" 
                />
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              
              <div className="md:ml-6 mt-4 md:mt-0 text-center md:text-left">
                {editMode ? (
                  <div className="flex items-center mb-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="text-2xl font-bold text-gray-800 bg-gray-100 px-3 py-1 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button 
                      onClick={handleUpdateProfile}
                      className="ml-2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                    <button 
                      onClick={() => setEditMode(false)}
                      className="ml-2 p-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center md:justify-start mb-2">
                    <h1 className="text-3xl font-bold text-gray-800">{username}</h1>
                    <button 
                      onClick={() => setEditMode(true)} 
                      className="ml-2 p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                    >
                      <FaEdit />
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap justify-center md:justify-start gap-4 text-gray-600">
                  <div className="flex items-center px-3 py-1 bg-indigo-50 rounded-full">
                    <span className="font-semibold text-indigo-700 mr-1">{postCount}</span>
                    <span className="text-indigo-600">Posts</span>
                  </div>
                  <div className="flex items-center px-3 py-1 bg-pink-50 rounded-full">
                    <span className="font-semibold text-pink-700 mr-1">{commentCount}</span>
                    <span className="text-pink-600">Comments</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 md:mt-0 flex justify-center md:justify-end">
              <Link href="/posts" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md inline-flex items-center">
                <FaImages className="mr-2" />
                <span>My Posts</span>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Profile Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Navigation Sidebar */}
          <div className="col-span-1">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="font-semibold text-gray-800">Account</h2>
              </div>
              <ul className="divide-y divide-gray-100">
                <li>
                  <button 
                    className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FaUser className="mr-3 text-indigo-500" />
                    <span>Edit Profile</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FaLock className="mr-3 text-indigo-500" />
                    <span>Password & Security</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FaBell className="mr-3 text-indigo-500" />
                    <span>Notifications</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FaUserFriends className="mr-3 text-indigo-500" />
                    <span>Friends & Connections</span>
                  </button>
                </li>
                <li>
                  <button 
                    className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <FaCog className="mr-3 text-indigo-500" />
                    <span>Settings</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <FaSignOutAlt className="mr-3" />
                    <span>Sign Out</span>
                  </button>
                </li>
              </ul>
            </div>
          </div>
          
          {/* Activity Overview */}
          <div className="col-span-1 md:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="font-semibold text-gray-800">Activity Overview</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg p-4 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Recent Posts</h3>
                      <FaImages className="text-white text-xl opacity-80" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{postCount}</div>
                    <div className="text-indigo-100">Total posts created</div>
                    <Link href="/posts" className="mt-4 inline-block text-white border border-white border-opacity-50 rounded-md px-3 py-1 text-sm hover:bg-white hover:bg-opacity-20 transition-colors">
                      View All
                    </Link>
                  </div>
                  
                  <div className="bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg p-4 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Comments</h3>
                      <FaRegComment className="text-white text-xl opacity-80" />
                    </div>
                    <div className="text-3xl font-bold mb-1">{commentCount}</div>
                    <div className="text-pink-100">Total comments made</div>
                    <Link href="/community" className="mt-4 inline-block text-white border border-white border-opacity-50 rounded-md px-3 py-1 text-sm hover:bg-white hover:bg-opacity-20 transition-colors">
                      View Community
                    </Link>
                  </div>
                </div>
                
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <Link href="/Createpost" className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                        <FaEdit className="text-indigo-600" />
                      </div>
                      <span className="text-sm text-gray-700">Create Post</span>
                    </Link>
                    
                    <Link href="/add_friends" className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                        <FaUserFriends className="text-indigo-600" />
                      </div>
                      <span className="text-sm text-gray-700">Find Friends</span>
                    </Link>
                    
                    <Link href="/community" className="flex flex-col items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                        <FaRegComment className="text-indigo-600" />
                      </div>
                      <span className="text-sm text-gray-700">Community</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
