'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { FaComment, FaChevronUp, FaChevronDown, FaTrash, FaEdit } from 'react-icons/fa';
import { useToast } from '../../../components/ToastContainer';
import { formatDate } from '../../../utils/helpers';
import { getPostBySlug, deletePost, Post } from '../../actions/postActions';
import { getPostComments, createComment, deleteComment, deleteCommentAsPostAuthor, Comment } from '../../actions/commentActions';
import { getCurrentUser } from '../../actions/userActions';

const SinglePostPage = () => {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const slug = params.slug as string;
  
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [user, setUser] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  
  useEffect(() => {
    fetchPost();
    checkUser();
  }, [slug]);
  
  const checkUser = async () => {
    const { user, error } = await getCurrentUser();
    if (user) {
      setUser(user);
    } else if (error) {
      console.error('Error checking user:', error);
    }
  };
  
  const fetchPost = async () => {
    setLoading(true);
    
    try {
      console.log('Fetching post with slug:', slug); // Debug log
      const { post: postData, error: postError } = await getPostBySlug(slug);
      
      if (postError) {
        console.error('Error fetching post:', postError);
        setError('Error fetching post.');
        setLoading(false);
        return;
      }
      
      if (!postData) {
        console.error('Post not found for slug:', slug);
        setError('Post not found.');
        setLoading(false);
        return;
      }
      
      console.log('Post data received:', postData); // Debug log
      setPost(postData);
      
      // Fetch comments for the post
      const { comments: commentsData, error: commentsError } = await getPostComments(postData.id);
      
      if (commentsError) {
        console.error('Error fetching comments:', commentsError);
      } else {
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Unexpected error in fetchPost:', error);
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.showToast('You must be logged in to add a comment.', 'error');
      router.push('/login');
      return;
    }
    
    if (!commentInput.trim()) {
      toast.showToast('Comment cannot be empty!', 'error');
      return;
    }
    
    const parentId = replyingTo;
    setLoading(true);
    
    const { comment: newComment, error } = await createComment(
      post?.id || '',
      user.id,
      commentInput,
      parentId
    );
    
    if (error) {
      toast.showToast(`Error adding comment: ${error}`, 'error');
    } else if (newComment) {
      // Reset comment input and reply state
      setCommentInput('');
      setReplyingTo(null);
      
      // Refresh comments
      if (post) {
        const { comments: updatedComments } = await getPostComments(post.id);
        setComments(updatedComments);
      }
      
      toast.showToast('Comment added successfully!', 'success');
    }
    
    setLoading(false);
  };
  
  const handleDeleteComment = async (commentId: string) => {
    if (!user) {
      toast.showToast('You must be logged in to delete a comment.', 'error');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this comment?')) {
      const { success, message } = await deleteComment(commentId, user.id);
      
      if (!success) {
        toast.showToast(`Error deleting comment: ${message}`, 'error');
      } else {
        // Refresh comments
        if (post) {
          const { comments: updatedComments } = await getPostComments(post.id);
          setComments(updatedComments);
          toast.showToast('Comment deleted successfully!', 'success');
        }
      }
    }
  };
  
  const handleDeleteCommentAsAuthor = async (commentId: string) => {
    if (!user || !post) {
      toast.showToast('You must be logged in to delete a comment.', 'error');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this comment?')) {
      const { success, error } = await deleteCommentAsPostAuthor(commentId, user.id);
      
      if (error) {
        toast.showToast(`Error deleting comment: ${error}`, 'error');
      } else if (success) {
        // Refresh comments
        const { comments: updatedComments } = await getPostComments(post.id);
        setComments(updatedComments);
        toast.showToast('Comment deleted successfully!', 'success');
      }
    }
  };
  
  const handleDeletePost = async () => {
    if (!user || !post) {
      toast.showToast('You must be logged in to delete a post.', 'error');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this post?')) {
      const { success, error } = await deletePost(post.id);
      
      if (error) {
        toast.showToast(`Error deleting post: ${error}`, 'error');
      } else if (success) {
        toast.showToast('Post deleted successfully!', 'success');
        router.push('/posts');
      }
    }
  };
  
  const handleEditPost = () => {
    if (!user || !post) {
      toast.showToast('You must be logged in to edit a post.', 'error');
      return;
    }
    
    router.push(`/posts/edit/${post.id}`);
  };
  
  const handleReplyToComment = (commentId: string) => {
    if (!user) {
      toast.showToast('You must be logged in to reply to a comment.', 'error');
      router.push('/login');
      return;
    }
    
    setReplyingTo(commentId);
    setCommentInput(`Replying to comment: `);
    
    // Scroll to comment form
    const commentForm = document.getElementById('comment-form');
    if (commentForm) {
      commentForm.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  const renderComments = (commentsToRender: Comment[], level = 0) => {
    return (
      <div className={`space-y-4 ${level > 0 ? 'ml-6 mt-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
        {commentsToRender.map((comment) => (
          <div key={comment.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="flex justify-between items-start">
              <div className="font-medium text-sm text-gray-700 dark:text-gray-300">
                {comment.username || 'Unknown user'}
              </div>
              <div className="flex space-x-1">
                {user && (user.id === comment.user_id || (post && user.id === post.user_id)) && (
                  <button
                    onClick={() => user.id === comment.user_id 
                      ? handleDeleteComment(comment.id)
                      : handleDeleteCommentAsAuthor(comment.id)
                    }
                    className="text-red-500 hover:text-red-700 p-1"
                    title={user.id === comment.user_id ? "Delete your comment" : "Delete as post author"}
                  >
                    <FaTrash className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">
              {comment.content}
            </div>
            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatDate(comment.created_at)}</span>
              <button 
                onClick={() => handleReplyToComment(comment.id)}
                className="hover:text-gray-700 dark:hover:text-gray-300"
              >
                Reply
              </button>
            </div>
            
            {/* Render replies */}
            {comment.replies && comment.replies.length > 0 && (
              renderComments(comment.replies, level + 1)
            )}
          </div>
        ))}
      </div>
    );
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 pb-10">
          <div className="flex justify-center mt-20">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (error || !post) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 pb-10">
          <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error</h2>
            <p className="text-gray-700 dark:text-gray-300">{error || 'Post not found'}</p>
            <button
              onClick={() => router.push('/posts')}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Go back to posts
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <Navbar />
      <div className="container mx-auto px-4 pt-20 pb-10">
        <div className="max-w-3xl mx-auto">
          {/* Post card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            {/* Post header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-700 dark:text-gray-300 font-bold">
                    {post.username ? post.username[0].toUpperCase() : 'U'}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-gray-800 dark:text-white">{post.username || 'Unknown user'}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(post.created_at)}</p>
                  </div>
                </div>
                
                {user && user.id === post.user_id && (
                  <div className="flex space-x-2">
                    <button
                      onClick={handleEditPost}
                      className="text-blue-500 hover:text-blue-700 p-1"
                      title="Edit post"
                    >
                      <FaEdit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={handleDeletePost}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Delete post"
                    >
                      <FaTrash className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                {post.title}
              </h1>
              
              <div className="prose dark:prose-invert max-w-none">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">
                  {post.content}
                </p>
              </div>
              
              {post.image_url && (
                <div className="mt-6">
                  <img
                    src={post.image_url}
                    alt={post.title}
                    className="w-full rounded-lg max-h-[500px] object-contain"
                  />
                </div>
              )}
            </div>
            
            {/* Post actions */}
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between items-center">
              <div className="flex items-center text-gray-600 dark:text-gray-400">
                <FaComment className="h-4 w-4 mr-1" />
                <span>
                  {comments.length} {comments.length === 1 ? 'Comment' : 'Comments'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <button className="hover:text-gray-800 dark:hover:text-gray-200">
                  <FaChevronUp className="h-4 w-4" />
                </button>
                <span>0</span>
                <button className="hover:text-gray-800 dark:hover:text-gray-200">
                  <FaChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Comment form */}
            <div id="comment-form" className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {replyingTo ? 'Reply to comment' : 'Add a comment'}
              </h3>
              
              {replyingTo && (
                <div className="mb-4 flex items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                    Replying to comment
                  </span>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setCommentInput('');
                    }}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    Cancel reply
                  </button>
                </div>
              )}
              
              <form onSubmit={handleCommentSubmit}>
                <textarea
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={user ? "Write your comment..." : "Please login to comment"}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  rows={4}
                  disabled={!user}
                ></textarea>
                
                <div className="mt-3 flex justify-end space-x-2">
                  {replyingTo && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingTo(null);
                        setCommentInput('');
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={!user || !commentInput.trim() || loading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : (
                      replyingTo ? 'Reply' : 'Comment'
                    )}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Comments list */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Comments ({comments.length})
              </h3>
              
              {comments.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-gray-500 dark:text-gray-400">
                    No comments yet. Be the first to comment!
                  </p>
                </div>
              ) : (
                renderComments(comments)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SinglePostPage; 