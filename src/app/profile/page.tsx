'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';
import Navbar from '../../components/Navbar';
export default function ProfilePage() {
  const [userData, setUserData] = useState<any>(null); // Store user data
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Fetch user details when the component is mounted
    const fetchUserData = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(); // Use getUser() method

        if (user) {
          // Query the 'users' table using the user.id
          const { data, error } = await supabase
            .from('users')
            .select('username')
            .eq('id', user.id)
            .single(); // Expecting only one record

          if (error) {
            setError('Failed to fetch user data');
            console.error(error);
          } else {
            setUserData(data);
            setUsername(data.username); // Initialize the username field
          }
        } else {
          setError('User not logged in');
        }
      } catch (err) {
        setError('Error fetching user data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Handle username update
  const handleUpdate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); // Use getUser() method
      if (user) {
        const { error } = await supabase
          .from('users')
          .update({ username })
          .eq('id', user.id);

        if (error) {
          setError('Error updating username');
          console.error(error);
        } else {
          alert('Username updated successfully!');
        }
      }
    } catch (err) {
      setError('Error updating username');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Navbar />
      <div className="w-full max-w-md p-8 bg-white shadow-lg rounded">
        <h2 className="text-2xl font-bold mb-6 text-center">Profile</h2>

        {/* Display the current username */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            disabled
          />
        </div>

        {/* Error Message */}
        {error && <div className="text-red-500 mb-4">{error}</div>}

  

        {/* Add additional profile settings here */}
        <div className="mt-6">
          <h3 className="text-lg font-medium text-gray-700">Additional Settings</h3>
          {/* Add more settings components here */}
        </div>
      </div>
    </div>
  );
}