'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { Session } from '@supabase/supabase-js';
import Link from 'next/link';
import { FaComment, FaChevronUp, FaChevronDown, FaTrash } from 'react-icons/fa';
import { BiEdit, BiPlus } from 'react-icons/bi';
import { useRouter } from 'next/navigation';
import CreatePostModal from '../../components/CreatePostModal';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  user_id: string;
  username?: string;
  profiles?: {
    username: string;
    avatar_url?: string;
  };
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
}

const CommunityPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  
  const [session, setSession] = useState<Session | null>(null);
  const [activePost, setActivePost] = useState<number | null>(null);
  const [commentLoading, setCommentLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    fetchPosts();
  }, []);
  
  const fetchPosts = async () => {
    setLoading(true);
    setError('');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setError('You must be logged in to view community posts.');
        setLoading(false);
        return;
      }
      setSession(session);
      
      // Get ALL posts, no user_id filter
      const { data: postsData, error: postsError } = await supabase
        .from('Posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('Error fetching posts:', postsError.message);
        setError('Error fetching community posts.');
        setLoading(false);
        return;
      }
      
      // If no posts are found, set empty array but don't show error
      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setComments({});
        setLoading(false);
        return;
      }
      
      // Get all user IDs for posts that don't have a username
      const userIds = [...new Set(postsData
        .filter(post => !post.username)
        .map(post => post.user_id)
      )];
      
      // Define type for the user profiles map
      interface UserProfileMap {
        [key: string]: string;
      }
      
      let userProfiles: UserProfileMap = {};
      
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
          userProfiles = (usersData || []).reduce((acc: UserProfileMap, user) => {
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
      
      setPosts(processedPosts);
      fetchCommentsWithUsernames(processedPosts);
    } catch (error) {
      console.error('Unexpected error in fetchPosts:', error);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCommentsWithUsernames = async (posts: Post[]) => {
    const postIds = posts.map((post) => post.id);
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
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
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

    setLoading(false);
  };

  const handleDeleteComment = async (commentId: string, postId: string) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setError('You must be logged in to delete a comment.');
      return;
    }

    setLoading(true);
    setError('');

    const { data: commentData, error: commentError } = await supabase
      .from('Comments')
      .select('user_id')
      .eq('id', commentId)
      .single();

    if (commentError || !commentData) {
      console.error('Error fetching comment:', commentError?.message);
      setError('Error fetching comment.');
      setLoading(false);
      return;
    }

    if (commentData.user_id !== session.user.id) {
      setError('You can only delete your own comments.');
      setLoading(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from('Comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Error deleting comment:', deleteError.message);
      setError('Error deleting comment.');
    } else {
      setComments((prev) => ({
        ...prev,
        [postId]: prev[postId].filter((comment) => comment.id !== commentId),
      }));
    }

    setLoading(false);
  };

  const handleDeletePost = async (postId: string) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setError('You must be logged in to delete a post.');
      return;
    }

    setLoading(true);
    setError('');

    const { error: deleteError } = await supabase
      .from('Posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('Error deleting post:', deleteError.message);
      setError('Error deleting post.');
    } else {
      setPosts((prev) => prev.filter((post) => post.id !== postId));
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="max-w-4xl mx-auto pt-20 pb-10 px-4">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-800">Community Posts</h1>
          <div className="flex gap-4 w-full md:w-auto">
            <button 
              onClick={() => setIsCreatePostModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-6 rounded-lg shadow-md hover:shadow-lg transition-all w-full md:w-auto"
            >
              <BiPlus className="text-lg" />
              Create Post
            </button>
            <div className="relative flex-1 md:w-64">
              <input
                type="text"
                placeholder="Search community posts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        {/* Add link to view your own posts */}
        <div className="mb-6">
          <Link 
            href="/posts" 
            className="inline-flex items-center text-purple-600 hover:text-purple-800 font-medium"
          >
            <span>View my posts</span>
            <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
            </svg>
          </Link>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
            <p>{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-lg shadow-md p-6 text-center">
            <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No community posts yet</h2>
            <p className="text-gray-600 mb-4">Be the first to create a post!</p>
            <button 
              onClick={() => setIsCreatePostModalOpen(true)}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-6 rounded-lg shadow transition-colors hover:from-purple-600 hover:to-pink-600"
            >
              Create a Post
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {posts
              .filter(post => 
                post.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                post.content?.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(post => (
                <div key={post.id} className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                        {post.username ? post.username[0].toUpperCase() : 'U'}
                      </div>
                      <div>
                        <p className="font-semibold">{post.username || 'Unknown user'}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                    <p className="text-gray-700">{post.content}</p>
                    
                    {post.image_url && (
                      <div className="mt-3 rounded-lg overflow-hidden">
                        <img 
                          src={post.image_url} 
                          alt={post.title} 
                          className="w-full object-cover max-h-96"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Post actions */}
                  <div className="px-4 py-2 flex items-center justify-between border-b border-gray-200">
                    <div className="flex items-center space-x-4">
                      <button className="flex items-center space-x-1 text-gray-600 hover:text-blue-500">
                        <FaComment className="text-lg" />
                        <span>
                          {comments[post.id]?.length || 0} {comments[post.id]?.length === 1 ? 'Comment' : 'Comments'}
                        </span>
                      </button>
                    </div>
                    
                    {session?.user?.id === post.user_id && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Comments section */}
                  <div className="p-4">
                    {/* Add comment form */}
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddComment(post.id);
                      }}
                      className="mb-4 flex"
                    >
                      <input
                        type="text"
                        value={commentInputs[post.id] || ''}
                        onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 border border-gray-300 rounded-l-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="submit"
                        disabled={!commentInputs[post.id]?.trim()}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-r-lg disabled:opacity-50"
                      >
                        Post
                      </button>
                    </form>
                    
                    {/* Comments list */}
                    <div className="space-y-3">
                      {comments[post.id]?.map((comment) => (
                        <div key={comment.id} className="flex space-x-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold text-sm">
                            {comment.username ? comment.username[0].toUpperCase() : 'U'}
                          </div>
                          <div className="flex-1">
                            <div className="bg-gray-100 rounded-lg p-3">
                              <p className="font-semibold text-sm">{comment.username || 'Unknown'}</p>
                              <p className="text-gray-700">{comment.content}</p>
                            </div>
                            <div className="flex items-center mt-1 text-xs text-gray-500 space-x-2">
                              <span>
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                              {session?.user?.id === comment.user_id && (
                                <button
                                  onClick={() => handleDeleteComment(comment.id, post.id)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
      
      <CreatePostModal 
        isOpen={isCreatePostModalOpen} 
        onClose={() => setIsCreatePostModalOpen(false)} 
        onPostCreated={() => {
          fetchPosts();
        }}
      />
    </div>
  );
};

export default CommunityPage; 