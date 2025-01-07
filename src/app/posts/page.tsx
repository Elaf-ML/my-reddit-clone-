"use client"

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { Session } from '@supabase/supabase-js';

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  user_id: string;
}

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string;
}

const PostsPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError('');

      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        setError('You must be logged in to view your posts.');
        setLoading(false);
        return;
      }
      setSession(session);
      const { data, error } = await supabase
        .from('Posts')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error.message);
        setError('Error fetching posts.');
      } else {
        setPosts(data || []);
        fetchCommentsWithUsernames(data || []); // Fetch comments and usernames
      }

      setLoading(false);
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

    fetchPosts();
  }, []);

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
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <Navbar />
      <h1 className="text-4xl font-semibold text-black text-center mb-8 mt-20">My Posts</h1>

      {loading ? (
        <p className="text-center">Loading posts...</p>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-600">You have not created any posts yet.</p>
      ) : (
        <div className="space-y-6 w-full max-w-4xl">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white p-6 rounded-lg shadow-lg border border-gray-200"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{post.title}</h2>

              {post.image_url && (
                <div className="flex justify-center">
                  <img
                    src={post.image_url}
                    alt={post.title}
                    width={500}
                    height={400}
                    className="mb-4 rounded-md"
                  />
                </div>
              )}

              <p className="text-gray-600">{post.content}</p>

              {/* Comment Input */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                  className="w-full p-2 border text-black border-gray-300 rounded-md"
                />
                <button
                  onClick={() => handleAddComment(post.id)}
                  className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Add Comment
                </button>
              </div>

              {/* Display Comments */}
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold text-gray-800">Comments:</h3>
                {comments[post.id]?.length > 0 ? (
                  comments[post.id].map((comment) => (
                    <div
                      key={comment.id}
                      className="bg-gray-100 p-2 rounded-md border border-gray-300"
                    >
                      <p className="font-semibold text-gray-800">{comment.username}</p>
                      <p className="text-gray-700">{comment.content}</p>
                      <p className="text-sm text-gray-400">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                      {comment.user_id === session?.user.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id, post.id)}
                          className="mt-2 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                        >
                          Delete Comment
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500">No comments yet.</p>
                )}
              </div>

              <p className="text-sm text-gray-400 mt-4">
                Posted on {new Date(post.created_at).toLocaleDateString()}
              </p>

              <div className="mt-4">
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Delete Post
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PostsPage;