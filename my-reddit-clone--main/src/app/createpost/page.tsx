'use client';

import { useState, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { motion } from 'framer-motion';
import { FiImage, FiX } from 'react-icons/fi';
import toast, { Toaster } from 'react-hot-toast';

const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const loadingToast = toast.loading('Creating your post...');

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        toast.error('You must be logged in to create a post.');
        return;
      }

      let imageUrl = null;

      if (image) {
        const fileName = `${session.user.id}/${Date.now()}_${image.name}`;
        const { error: uploadError } = await supabase.storage
          .from('image_url')
          .upload(fileName, image);

        if (uploadError) {
          throw new Error('Error uploading image');
        }

        imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/image_url/${fileName}`;
      }

      const { error: insertError } = await supabase.from('Posts').insert([
        {
          title,
          content,
          user_id: session.user.id,
          image_url: imageUrl,
          votes: 0
        },
      ]);

      if (insertError) throw new Error('Error creating post');

      toast.success('Post created successfully!', { id: loadingToast });
      router.push('/posts');
    } catch (error) {
      toast.error('Something went wrong. Please try again.', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br mt-20 from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Navbar />
      <Toaster position="top-right" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="container mx-auto px-4 py-8 max-w-3xl"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 md:p-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Create a Post
          </h1>

          <form onSubmit={handleCreatePost} className="space-y-6">
            {/* Title Input */}
            <div className="relative">
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="peer w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-transparent focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 bg-transparent transition-colors"
                placeholder="Title"
                required
              />
              <label
                htmlFor="title"
                className="absolute left-4 -top-2.5 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-1 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-blue-500"
              >
                Title
              </label>
            </div>

            {/* Content Textarea */}
            <div className="relative">
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="peer w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-transparent focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 bg-transparent transition-colors resize-none"
                placeholder="Content"
                required
              />
              <label
                htmlFor="content"
                className="absolute left-4 -top-2.5 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 px-1 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-blue-500"
              >
                Content
              </label>
            </div>

            {/* Image Upload */}
            <div className="relative">
              <input
                type="file"
                id="image"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
              
              {!imagePreview ? (
                <label
                  htmlFor="image"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors group"
                >
                  <div className="text-center">
                    <FiImage className="mx-auto h-8 w-8 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    <span className="mt-2 block text-sm text-gray-600 dark:text-gray-400">
                      Click to upload an image
                    </span>
                  </div>
                </label>
              ) : (
                <div className="relative w-full h-48 rounded-lg overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full py-3 px-6 rounded-lg text-white font-medium transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Creating Post...
                </div>
              ) : (
                'Create Post'
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default CreatePost;
