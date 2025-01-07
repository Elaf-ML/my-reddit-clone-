'use client';

import { useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Get the current user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      setError('You must be logged in to create a post.');
      setLoading(false);
      return;
    }

    let imageUrl = null;

    // Handle image upload to Supabase Storage
    if (image) {
      const fileName = `${session.user.id}/${Date.now()}_${image.name}`;
      const {error: uploadError } = await supabase.storage
        .from('image_url') // Ensure you are using the correct bucket name "image_url"
        .upload(fileName, image);

      if (uploadError) {
        console.error('Error uploading image:', uploadError.message);
        setError('Error uploading image.');
        setLoading(false);
        return;
      }

      // Image URL construction for accessing the image publicly
      imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/image_url/${fileName}`;
    }

    // Insert post into the database
    const { error: insertError } = await supabase.from('Posts').insert([
      {
        title,
        content,
        user_id: session.user.id,
        image_url: imageUrl, // Store the image URL in the database
      },
    ]);

    if (insertError) {
      console.error('Error creating post:', insertError.message);
      setError('Error creating post.');
    } else {
      setTitle('');
      setContent('');
      setImage(null);
      router.push('/posts');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-gray-100">
    <Navbar />
      <h1 className="text-4xl font-semibold text-center text-black mb-8 mt-10">Create a Post</h1>

      {error && <p className="text-red-500 text-center">{error}</p>}

      <form onSubmit={handleCreatePost} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-lg text-black font-medium">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border text-black border-gray-300 rounded-md"
            required
          />
        </div>

        <div>
          <label htmlFor="content" className="block text-black text-lg font-medium">Content</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full p-3 border text-black border-gray-300 rounded-md"
            rows={6}
            required
          />
        </div>

        <div>
          <label htmlFor="image" className="block text-lg text-black font-medium">Image</label>
          <input
            type="file"
            id="image"
            accept="image/*"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="w-full p-3 border text-black border-gray-300 rounded-md"
          />
        </div>

        <div className="text-center">
          <button
            type="submit"
            className={`px-6 py-2 rounded-lg ${loading ? 'bg-gray-400' : 'bg-blue-600'} text-white`}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
