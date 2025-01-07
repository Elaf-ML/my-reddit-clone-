'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // Import useParams
import { supabase } from '../../../utils/supabaseClient'; // Adjust the import according to your project structure
import Navbar from '../../../components/Navbar'; // Adjust the import according to your project structure

interface Post {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url : string;
}
interface User{

id: string;
username: string;

}

const UserPostsPage = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<User[]>([]);

  const { userId } = useParams(); // Get userId from the URL params

  useEffect(() => {
    if (!userId) return; // If userId is not available, do nothing

    const fetchPosts = async () => {
      setLoading(true);
      setError('');

      const { data, error } = await supabase
        .from('Posts')
        .select('id, title, content, image_url ,created_at')
        .eq('user_id', userId); // Fetch posts for the specific user

      if (error) {
        console.error('Error fetching posts:', error.message);
        setError('Error fetching posts.');
      } else {
        setPosts(data || []); // Set the fetched posts
      }

      setLoading(false);
    };
    //-------------------------------------------------------------
    const fetchUsers = async () => {
      setLoading(true);
      setError('');

      const user = supabase.auth.getSession(); // Get logged-in user
      const loggedInUserId = (await user).data.session?.user.id; // Extract the logged-in user's ID

      // Fetch all users from the "users" table
      const { data, error } = await supabase
        .from('users')
        .select('id, username , avatar');

      if (error) {
        console.error('Error fetching users:', error.message);
        setError('Error fetching users.');
      } else {
    
        const filteredUsers = data?.filter((user: User) => user.id !== loggedInUserId);
        setUsers(filteredUsers || []); 
      }

      setLoading(false);
    };

    fetchUsers();
    fetchPosts();
  }, [userId]); // Re-run when userId changes

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <Navbar />

      {loading ? (
        <p className="text-center">Loading posts...</p>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : posts.length === 0 ? (
        <p className="text-center text-gray-600">No posts found.</p>
      ) : (
        <div className="space-y-6">
          {users.map((user)=>(
           <div key={user.id} className="flex flex-col items-center justify-center  mt-20 ">
           <h1 className="text-4xl font-bold text-gray-800 md:text-5xl lg:text-6xl">
             This is {user.username}s profile
           </h1>
         </div>
         

          ))}
          {posts.map((post) => (
     <div
     key={post.id}
     className="bg-white p-6 rounded-lg shadow-md border border-gray-200 max-w-2xl mx-auto my-6 hover:shadow-lg transition-shadow duration-300"
   >
     {post.image_url && (
       <div className="overflow-hidden rounded-t-lg">
         <img
           src={post.image_url}
           alt="Post Image"
           className="w-full h-auto object-contain"
         />
       </div>
     )}
     <div className="p-4">
       <h2 className="text-2xl font-semibold text-gray-800 mb-3">{post.title}</h2>
       <p className="text-gray-700 leading-relaxed mb-4">{post.content}</p>
       <p className="text-gray-500 text-sm italic">
         Posted on: {new Date(post.created_at).toLocaleString()}
       </p>
     </div>
   </div>
   
          ))}
        </div>
      )}
    </div>
  );
};

export default UserPostsPage;
