"use client"

import { useEffect, useState } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import Navbar from '../../../components/Navbar';
import { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { FaComment, FaTrash, FaUser, FaCalendarAlt, FaHeart } from 'react-icons/fa';
import { BiPlus, BiShare } from 'react-icons/bi';
import { useRouter, useParams } from 'next/navigation';
import showToast from '../../../components/Toast';
import { deleteComment, getPostComments, Comment as ApiComment } from '../../../app/actions/commentActions';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  user_id: string;
  username?: string;
}

interface Comment extends Omit<ApiComment, 'username'> {
  username: string;
}

interface UserProfile {
  id: string;
  username: string;
  avatar: string | null;
  email?: string;
  created_at?: string;
}

const UserProfilePage = () => {
  const params = useParams();
  const userId = params.userId as string;
  const router = useRouter();

  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  
  const [session, setSession] = useState<Session | null>(null);
  const [currentUser, setCurrentUser] = useState<string | null>(null);

  useEffect(() => {
    fetchUserProfile();
    fetchUserPosts();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      // Get current user session
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
      
      if (sessionData.session) {
        setCurrentUser(sessionData.session.user.id);
      }

      // Fetch user profile data
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching user profile:', profileError.message);
        setError('User not found');
        setLoading(false);
        return;
      }

      setUserProfile(profileData);

      // Count total posts by user
      const { count: postsCount, error: postsCountError } = await supabase
        .from('Posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!postsCountError && postsCount !== null) {
        setPostCount(postsCount);
      }

      // Count total comments by user
      const { count: commentsCount, error: commentsCountError } = await supabase
        .from('Comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (!commentsCountError && commentsCount !== null) {
        setCommentCount(commentsCount);
      }
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      setError('Failed to load user profile');
    }
  };

  const fetchUserPosts = async () => {
    setLoading(true);
    setError('');

    try {
      // Get posts for this specific user
      const { data: postsData, error: postsError } = await supabase
        .from('Posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching posts:', postsError.message);
        setError('Error fetching posts for this user.');
        setLoading(false);
        return;
      }
      
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setComments({});
        setLoading(false);
        return;
      }
      
      // Add username to posts
      const processedPosts = postsData.map(post => ({
        ...post,
        username: userProfile?.username || 'Unknown user'
      }));
      
      setPosts(processedPosts);
      fetchCommentsForPosts(processedPosts);
    } catch (error) {
      console.error('Unexpected error in fetchUserPosts:', error);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentsForPosts = async (posts: Post[]) => {
    const postIds = posts.map((post) => post.id);
    
    if (postIds.length === 0) return;
    
    const { data: commentsData, error: commentsError } = await supabase
      .from('Comments')
      .select('*')
      .in('post_id', postIds)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Error fetching comments:', commentsError.message);
      return;
    }

    const userIds = [...new Set(commentsData.map((comment) => comment.user_id))];
    
    if (userIds.length === 0) {
      setComments({});
      return;
    }
    
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, username')
      .in('id', userIds);

    if (usersError) {
      console.error('Error fetching users:', usersError.message);
      return;
    }

    const userIdToUsername = usersData.reduce((acc, user) => {
      acc[user.id] = user.username;
      return acc;
    }, {} as Record<string, string>);

    const groupedComments = commentsData.reduce((acc, comment) => {
      const { post_id } = comment;
      if (!acc[post_id]) {
        acc[post_id] = [];
      }
      acc[post_id].push({
        ...comment,
        username: userIdToUsername[comment.user_id] || 'Unknown',
      });
      return acc;
    }, {} as Record<string, Comment[]>);

    setComments(groupedComments);
  };

  const handleCommentInputChange = (postId: string, value: string) => {
    setCommentInputs((prev) => ({ ...prev, [postId]: value }));
  };

  const handleAddComment = async (postId: string) => {
    if (!session) {
      setError('You must be logged in to add a comment.');
      return;
    }

    const comment = commentInputs[postId]?.trim();
    if (!comment) {
      alert('Comment cannot be empty!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('Comments')
        .insert({
          post_id: postId,
          user_id: session.user.id,
          content: comment,
        })
        .select('*');

      if (error) {
        console.error('Error adding comment:', error.message);
        setError('Error adding comment.');
      } else if (data && data.length > 0) {
        const newComment = data[0];
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('username')
          .eq('id', newComment.user_id);

        if (userError || !userData || userData.length === 0) {
          console.warn(`No user found for user_id: ${newComment.user_id}`);
          newComment.username = 'Unknown';
        } else {
          newComment.username = userData[0].username;
        }

        setComments((prev) => ({
          ...prev,
          [postId]: [...(prev[postId] || []), newComment],
        }));
        setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      }
    } catch (error) {
      console.error('Error in handleAddComment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    if (!currentUser) {
      return;
    }

    if (window.confirm('Are you sure you want to delete this comment?')) {
      const { success, message } = await deleteComment(commentId, currentUser);
      
      if (!success) {
      } else {
        // Refresh comments for this post
        const { comments: updatedComments } = await getPostComments(postId);
        setComments(prev => ({
          ...prev,
          [postId]: updatedComments.map(comment => ({
            ...comment,
            username: comment.username || 'Unknown user'
          }))
        }));
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto pt-20 pb-10 px-4">
        {/* User Profile Header */}
        {userProfile ? (
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 transform transition-all hover:shadow-lg">
            <div className="bg-gradient-to-r from-indigo-600 to-pink-500 h-40 relative">
              <div className="absolute inset-0 bg-black opacity-20"></div>
            </div>
            <div className="px-6 py-4 flex flex-col md:flex-row items-center md:items-end -mt-20 relative z-10">
              <div className="w-36 h-36 rounded-full border-4 border-white bg-white overflow-hidden shadow-xl">
                {userProfile.avatar ? (
                  <img 
                    src={userProfile.avatar} 
                    alt={userProfile.username} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <FaUser className="text-gray-400 text-5xl" />
                  </div>
                )}
              </div>
              <div className="md:ml-8 mt-6 md:mt-0 text-center md:text-left pb-4 flex-1">
                <h1 className="text-3xl font-bold text-black">{userProfile.username}</h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-6 mt-3 text-gray-600">
                  <div className="flex items-center group">
                    <FaCalendarAlt className="mr-2 text-indigo-500 group-hover:text-indigo-600 transition-colors" />
                    <span>Joined {new Date(userProfile.created_at || Date.now()).toLocaleDateString()}</span>
                  </div>
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
              <div className="mt-4 md:mt-0">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-md">
                  Follow
                </button>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded">
            <p>{error}</p>
          </div>
        ) : (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        )}

        {/* User's Posts */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            {userProfile ? (
              <>
                <span className="mr-2">{userProfile.username}'s Posts</span>
                <span className="text-sm px-2 py-1 bg-indigo-100 text-indigo-800 rounded-md font-normal">
                  {postCount}
                </span>
              </>
            ) : 'Posts'}
          </h2>
          
          {loading && !posts.length ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : error && !userProfile ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
              <p>{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-md p-8 text-center transform transition-all hover:shadow-lg">
              <svg className="w-20 h-20 text-indigo-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
              </svg>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No posts yet</h2>
              <p className="text-gray-600 max-w-sm">{userProfile ? `${userProfile.username} hasn't created any posts yet.` : 'This user has not created any posts yet.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {posts.map(post => (
                <div key={post.id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transform transition-all hover:shadow-lg hover:translate-y-[-2px]">
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center justify-center text-white font-bold shadow-md">
                        {userProfile ? userProfile.username[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-lg">{userProfile?.username || post.username || 'Unknown user'}</p>
                        <p className="text-xs text-gray-500 flex items-center">
                          <FaCalendarAlt className="mr-1 text-indigo-400" />
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-3 text-gray-800">{post.title}</h2>
                    <p className="text-gray-600 mb-4 leading-relaxed">{post.content}</p>
                    
                    {post.image_url && (
                      <div className="mt-4 rounded-lg overflow-hidden shadow-md">
                        <img 
                          src={post.image_url} 
                          alt={post.title} 
                          className="w-full object-cover max-h-96 transform transition-transform hover:scale-105"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Post actions */}
                  <div className="px-6 py-3 flex items-center justify-between border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center space-x-6">
                      <button className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors">
                        <FaHeart className="text-lg" />
                        <span>Like</span>
                      </button>
                      <button className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors">
                        <FaComment className="text-lg" />
                        <span>
                          {comments[post.id]?.length || 0} {comments[post.id]?.length === 1 ? 'Comment' : 'Comments'}
                        </span>
                      </button>
                    </div>
                    <button className="text-gray-500 hover:text-indigo-600 transition-colors">
                      <BiShare className="text-xl" />
                    </button>
                  </div>
                  
                  {/* Comments section */}
                  <div className="p-6">
                    {/* Add comment form */}
                    {session && (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleAddComment(post.id);
                        }}
                        className="mb-6 flex"
                      >
                        <input
                          type="text"
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                          placeholder="Add a comment..."
                          className="flex-1 border border-gray-300 rounded-l-lg py-3 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          type="submit"
                          disabled={!commentInputs[post.id]?.trim()}
                          className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 px-6 rounded-r-lg disabled:opacity-50 hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-md"
                        >
                          Post
                        </button>
                      </form>
                    )}
                    
                    {/* Comments list */}
                    <div className="space-y-4">
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex space-x-3 group">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-700 font-semibold text-sm shadow-sm">
                            {comment.username ? comment.username[0].toUpperCase() : 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-50 rounded-2xl p-4 shadow-sm">
                              <div className="flex justify-between items-start">
                                <p className="font-semibold text-sm text-gray-800">{comment.username || 'Unknown'}</p>
                                <div className="text-xs text-gray-500">
                                  {new Date(comment.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              <p className="text-gray-700 mt-1">{comment.content}</p>
                            </div>
                            <div className="flex items-center mt-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="text-gray-500 hover:text-indigo-600 text-sm mr-4 transition-colors">
                                Reply
                              </button>
                              {currentUser === comment.user_id && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                  className="text-gray-500 hover:text-red-600 text-sm transition-colors"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      
                      {comments[post.id]?.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          No comments yet. Be the first to comment!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Back button */}
        <div className="mt-10">
          <Link 
            href="/add_friends" 
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 font-medium transition-colors group"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2 group-hover:bg-indigo-200 transition-colors">
              <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
              </svg>
            </div>
            <span>Back to Find Friends</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;