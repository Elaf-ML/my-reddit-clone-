'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { FiImage, FiX, FiSmile, FiVideo, FiTag, FiMapPin } from 'react-icons/fi';
import { BsEmojiSmile } from 'react-icons/bs';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import toast from 'react-hot-toast';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose, onPostCreated }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
      setIsVisible(true);
      fetchUserProfile();
    } else {
      // Restore scrolling when modal is closed
      document.body.style.overflow = 'auto';
      setIsVisible(false);
    }

    // Cleanup function to restore scrolling when component unmounts
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  const fetchUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        return;
      }

      setUsername(data?.username || 'User');
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

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
  
  const resetForm = () => {
    setTitle('');
    setContent('');
    setImage(null);
    setImagePreview(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreatePost = async () => {
    if (!title.trim() && !content.trim() && !image) {
      toast.error('Please add text or an image to your post');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        toast.error('You must be logged in to create a post.');
        return;
      }

      let imageUrl = null;

      if (image) {
        // Sanitize file name to avoid special characters issues
        const fileExt = image.name.split('.').pop();
        // Use a simple file name pattern: userId_timestamp.extension
        const safeFileName = `${session.user.id.replace(/-/g, '')}_${Date.now()}.${fileExt}`;
        
        console.log('Attempting to upload file:', safeFileName);
        
        // First check if the bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        console.log('Available buckets:', buckets);
        
        const { error: uploadError, data: uploadData } = await supabase.storage
          .from('image_url')
          .upload(safeFileName, image, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          throw new Error(`Error uploading image: ${uploadError.message}`);
        }

        // Get the public URL
        const { data: urlData } = supabase.storage
          .from('image_url')
          .getPublicUrl(safeFileName);
        
        imageUrl = urlData.publicUrl;
        console.log('Image uploaded successfully, URL:', imageUrl);
      }

      // Fetch the username from users table based on the user_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (userError) {
        console.error('Error fetching user data:', userError);
        // Continue with post creation even if username fetch fails
      }

      // Use the fetched username or fallback to the one we already have
      const userUsername = userData?.username || username;
      
      console.log('Saving post with username:', userUsername);

      const { error: insertError } = await supabase.from('Posts').insert([
        {
          title,
          content,
          user_id: session.user.id,
          image_url: imageUrl,
          username: userUsername, // Save the username we fetched from users table
          votes: 0 // Initialize votes to 0
        },
      ]);

      if (insertError) {
        console.error('Error inserting post:', insertError);
        throw new Error(`Error creating post: ${insertError.message}`);
      }

      toast.success('Post created successfully!');
      resetForm();
      onClose();
      onPostCreated();
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addEmoji = (emoji: any) => {
    setContent(prev => prev + emoji.native);
    setShowEmojiPicker(false);
  };

  const closeModal = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Dark overlay */}
      <div 
        className={`fixed inset-0 transition-all duration-300 ${
          isVisible ? 'bg-black bg-opacity-70 backdrop-blur-sm' : 'bg-black bg-opacity-0'
        }`}
        onClick={closeModal}
      ></div>
      
      <div 
        className="flex items-center justify-center min-h-screen p-4 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal panel */}
        <div 
          className={`bg-white rounded-lg text-left overflow-hidden shadow-2xl border border-gray-200 w-full max-w-lg relative z-10 transition-all duration-300 ${
            isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
        >
          {/* Header */}
          <div className="bg-white px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Create Post</h3>
              <button
                onClick={closeModal}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {username ? username[0].toUpperCase() : 'U'}
              </div>
              <div className="font-medium">{username}</div>
            </div>
          </div>

          {/* Content */}
          <div className="bg-white p-4 relative">
            {/* Title input */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full border-0 text-xl focus:ring-0 p-2 mb-2 placeholder-gray-400"
            />
            
            {/* Content textarea */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full border-0 focus:ring-0 text-lg p-2 resize-none h-32 placeholder-gray-400"
            />

            {/* Image preview */}
            {imagePreview && (
              <div className="relative mt-3 border rounded-lg overflow-hidden">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage();
                  }}
                  className="absolute top-2 right-2 bg-gray-800 rounded-full p-1 text-white"
                >
                  <FiX className="w-5 h-5" />
                </button>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full object-contain max-h-64"
                />
              </div>
            )}

            {/* Emoji picker */}
            {showEmojiPicker && (
              <div 
                className="absolute z-[110] mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Picker 
                  data={data} 
                  onEmojiSelect={addEmoji} 
                  theme="light"
                />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 bg-gray-50 space-y-4">
            <div className="border rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">Add to your post</div>
              </div>
              <div className="flex items-center justify-start space-x-4 mt-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="text-green-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <FiImage className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  className="text-yellow-500 hover:bg-gray-100 p-2 rounded-full transition-colors"
                >
                  <BsEmojiSmile className="w-6 h-6" />
                </button>
                <button className="text-red-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <FiVideo className="w-6 h-6" />
                </button>
                <button className="text-blue-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <FiTag className="w-6 h-6" />
                </button>
                <button className="text-orange-500 hover:bg-gray-100 p-2 rounded-full transition-colors">
                  <FiMapPin className="w-6 h-6" />
                </button>
              </div>
            </div>

            <input
              type="file"
              id="image"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCreatePost();
              }}
              disabled={loading}
              className={`w-full py-2 px-4 rounded-lg font-medium ${
                loading || (!title.trim() && !content.trim() && !image)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePostModal; 