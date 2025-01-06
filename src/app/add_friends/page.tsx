'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { useRouter } from 'next/navigation'; // Import useRouter to handle navigation

interface User {
  avatar: string;
  id: string;
  username: string;
}

const FindFriendsPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter(); // Initialize the router to navigate

  useEffect(() => {
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
        } else if (data) {
          const filteredUsers = data.filter((user: User) => user.id !== loggedInUserId);
          setUsers(filteredUsers);
        } else {
          setUsers([]);
        }
  
        setLoading(false);
      };
  
      fetchUsers();
    }, []);
  const handleUserClick = (userId: string) => {
    
    router.push(`/user/${userId}`); 
  };

  return (
    <div className="max-w-4xl mx-auto mt-10 p-4">
      <Navbar />
      <h1 className="text-4xl font-semibold text-center mb-8 mt-10">Find Friends</h1>

      {loading ? (
        <p className="text-center">Loading users...</p>
      ) : error ? (
        <p className="text-center text-red-500">{error}</p>
      ) : users.length === 0 ? (
        <p className="text-center text-gray-600">No users found.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-white p-4 rounded-lg shadow-lg border border-gray-200 text-center cursor-pointer"
              onClick={() => handleUserClick(user.id)} // Handle click
            >
              <div className="flex justify-center mb-4">
                <img
                  src={user.avatar || ''}
                  alt={user.username}
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
                />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">{user.username}</h3>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FindFriendsPage;
