'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
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
  username: string; // Updated to include username
}

const PostsPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

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
        if (!acc[user.id]) {
          acc[user.id] = user.username; // Use the first match for each user_id
        } else {
          console.warn(`Duplicate user found for user_id: ${user.id}. Ignoring additional entries.`);
        }
        return acc;
      }, {} as Record<string, string>);

      const groupedComments = commentsData.reduce((acc, comment) => {
        const { post_id } = comment;
        if (!acc[post_id]) {
          acc[post_id] = [];
        }
        acc[post_id].push({
          ...comment,
          username: userIdToUsername[comment.user_id] || 'Unknown', // Attach username
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
      } else if (userData.length > 1) {
        console.warn(`Multiple users found for user_id: ${newComment.user_id}. Using the first match.`);
        newComment.username = userData[0].username;
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
//------------------------------

  
const handleDeletePost = async (postId: string) => {
  if (!confirm('Are you sure you want to delete this post and its comments?')) {
    return;
  }

  setLoading(true);
  setError('');

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      setError('You must be logged in to delete a post.');
      return;
    }

  
    // Step 1: Delete comments related to the post
    console.log('Deleting comments for post ID:', postId);

    const { error: commentsError } = await supabase
      .from('Comments')
      .delete()
      .eq('post_id', postId);

    if (commentsError) {
      console.error('Error deleting comments:', commentsError.message);
      setError('Error deleting comments.');
      setLoading(false);
      return;
    }

    console.log('Comments deleted successfully.');

    // Step 2: Delete the post after the comments are removed
    console.log('Deleting post ID:', postId);

    const { error: postError } = await supabase
      .from('Posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', session.user.id);

    if (postError) {
      console.error('Error deleting post:', postError.message);
      setError('Error deleting post.');
    } else {
      // Step 3: Update the UI state to reflect the deletion
      console.log('Post deleted successfully.');

      setPosts((prevPosts) => prevPosts.filter((post) => post.id !== postId));
      setComments((prevComments) => {
        const {...remainingComments } = prevComments;
        return remainingComments;
      });
    }
  } catch (error) {
    console.error('Unexpected error during post deletion:', error);
    setError('Unexpected error occurred.');
  }

  setLoading(false);
};


  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <Navbar />
      <h1 className="text-4xl font-semibold text-center mb-8 mt-10">My Posts</h1>

      {loading ? (
        <p className="text-center">Loading posts...</p>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-600">You have not created any posts yet.</p>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <div
              key={post.id}
              className="bg-white p-6 rounded-lg shadow-lg border border-gray-200"
            >
              <h2 className="text-2xl font-bold text-gray-800 mb-4">{post.title}</h2>

              {post.image_url && (
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="w-full h-auto mb-4 rounded-md"
                />
              )}

              <p className="text-gray-600">{post.content}</p>

              {/* Comment Input */}
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  value={commentInputs[post.id] || ''}
                  onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-md"
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
                      </p>
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
