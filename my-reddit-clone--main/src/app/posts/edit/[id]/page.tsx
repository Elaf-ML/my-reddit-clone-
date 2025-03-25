'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '../../../../components/Navbar';
import { useToast } from '../../../../components/ToastContainer';
import { getPostById, updatePost, Post } from '../../../actions/postActions';
import { getCurrentUser } from '../../../actions/userActions';

const EditPostPage = () => {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const postId = params.id as string;
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);
  const [post, setPost] = useState<Post | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Check if user is logged in
        const { user: userData, error: userError } = await getCurrentUser();
        
        if (userError || !userData) {
          setError('You must be logged in to edit a post.');
          setIsLoading(false);
          setTimeout(() => {
            router.push('/login');
          }, 2000);
          return;
        }
        
        setUser(userData);
        
        // Fetch post data
        const { post: postData, error: postError } = await getPostById(postId);
        
        if (postError) {
          setError('Failed to fetch post data');
          setIsLoading(false);
          return;
        }
        
        if (!postData) {
          setError('Post not found');
          setIsLoading(false);
          return;
        }
        
        // Check if current user is the author of the post
        if (postData.user_id !== userData.id) {
          setError('You can only edit your own posts');
          setIsLoading(false);
          setTimeout(() => {
            router.push('/posts');
          }, 2000);
          return;
        }
        
        // Set post data to form
        setPost(postData);
        setTitle(postData.title);
        setContent(postData.content);
      } catch (err) {
        console.error('Error in fetchData:', err);
        setError('An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [postId, router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      toast.showToast('Title and content are required', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { post: updatedPost, error: updateError } = await updatePost(
        postId,
        title,
        content,
        user.id
      );
      
      if (updateError) {
        toast.showToast(`Error updating post: ${updateError}`, 'error');
        setIsLoading(false);
        return;
      }
      
      if (updatedPost) {
        toast.showToast('Post updated successfully!', 'success');
        router.push(`/posts/${updatedPost.slug}`);
      }
    } catch (err) {
      console.error('Error in handleSubmit:', err);
      toast.showToast('An unexpected error occurred', 'error');
    } finally {
      setIsLoading(false);
    }
  };
  
  if (isLoading) {
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
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
        <Navbar />
        <div className="container mx-auto px-4 pt-20 pb-10">
          <div className="max-w-2xl mx-auto mt-10 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Error</h2>
            <p className="text-gray-700 dark:text-gray-300">{error}</p>
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
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Edit Post
              </h1>
              
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter post title"
                    required
                  />
                </div>
                
                <div className="mb-6">
                  <label
                    htmlFor="content"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >
                    Content
                  </label>
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Write your post content..."
                    rows={10}
                    required
                  />
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"></div>
                    ) : (
                      'Update Post'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditPostPage; 