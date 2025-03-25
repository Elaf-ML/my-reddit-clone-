'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
import { useRouter } from 'next/navigation';
import { FaUserPlus, FaSearch, FaUser } from 'react-icons/fa';

interface User {
  avatar: string;
  id: string;
  username: string;
}

const FindFriendsPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      setError('');

      const user = supabase.auth.getSession();
      const loggedInUserId = (await user).data.session?.user.id;

      const { data, error } = await supabase
        .from('users')
        .select('id, username, avatar');

      if (error) {
        console.error('Error fetching users:', error.message);
        setError('Error fetching users.');
      } else if (data) {
        const filteredUsers = data.filter((user: User) => user.id !== loggedInUserId);
        setUsers(filteredUsers);
        setFilteredUsers(filteredUsers);
      } else {
        setUsers([]);
        setFilteredUsers([]);
      }

      setLoading(false);
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const handleUserClick = (userId: string) => {
    router.push(`/user/${userId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-6xl mx-auto pt-20 pb-12 px-4 sm:px-6">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-indigo-600 to-pink-500 mb-4 shadow-lg">
            <FaUserPlus className="text-white text-2xl" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Find Friends</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Connect with other users to see their posts and share your thoughts
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="max-w-md mx-auto mb-10">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mx-auto max-w-md">
            <p>{error}</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-md p-8 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <FaSearch className="text-indigo-400 text-xl" />
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No users found</h2>
            <p className="text-gray-600 text-center">
              {searchTerm ? 'Try a different search term' : 'There are no other users registered yet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-lg hover:transform hover:scale-105 hover:border-indigo-200 cursor-pointer group"
                onClick={() => handleUserClick(user.id)}
              >
                <div className="h-2 bg-gradient-to-r from-indigo-500 to-pink-500"></div>
                <div className="p-5">
                  <div className="flex justify-center mb-4">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md group-hover:border-indigo-50 transition-all"
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-4 border-white shadow-md">
                        <FaUser className="text-gray-400 text-3xl" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-center text-gray-800 group-hover:text-indigo-600 transition-colors">
                    {user.username}
                  </h3>
                  <div className="mt-4 text-center">
                    <button className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors">
                      <FaUserPlus className="mr-1" />
                      <span>View Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FindFriendsPage;
