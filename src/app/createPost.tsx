import { useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get the session to access the user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      alert('Error fetching session');
      return;
    }

    const userId = session?.user?.id;

    if (!userId) {
      alert('User not logged in');
      return;
    }

    // Insert the new post
    const { error } = await supabase
      .from('posts')
      .insert([{ title, content, user_id: userId }]);

    if (error) {
      alert(error.message);
    } else {
      alert('Post created successfully');
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button type="submit">Create Post</button>
      </form>
    </div>
  );
};

export default CreatePost;
