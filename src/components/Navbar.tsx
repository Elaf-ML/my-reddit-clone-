'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);

    const fetchSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error('Error fetching session:', error);
      } else {
        setUser(session?.user ?? null);
      }
    };

    fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    router.push('/login');
  };

  if (!isClient) return null;

  return (
    <nav className="bg-blue-600 shadow-md w-screen fixed top-0 left-0 z-50">
      <div className="flex justify-between items-center px-4 py-3">
        {/* Logo Section */}
        <div>
          <Link href="/" className="text-white text-2xl font-bold hover:text-gray-200">
            SocialApp
          </Link>
        </div>

        {/* Navigation Links */}
        <div className="hidden md:flex space-x-6 items-center">
          <Link href="/posts" className="text-white hover:text-gray-300 transition">
            Home
          </Link>
          <Link href="/add_friends" className="text-white hover:text-gray-300 transition">
            Add Friends
          </Link>
          {user && (
            <>
              <Link href="/createpost" className="text-white hover:text-gray-300 transition">
                Create Post
              </Link>
              <Link href="/profile" className="text-white hover:text-gray-300 transition">
                Profile
              </Link>
            </>
          )}
        </div>

        {/* User Actions */}
        <div className="flex items-center space-x-4">
          {user ? (
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 mx-10 py-2 rounded-md hover:bg-red-600 transition"
            >
              Logout
            </button>
          ) : (
            <>
              <Link href="/login" className="text-white hover:text-gray-300 transition">
                Login
              </Link>
              <Link
                href="/register"
                className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 transition"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center">
          <button
            className="text-white focus:outline-none"
            onClick={() => console.log('Toggle mobile menu')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 6h18M3 12h18m-6 6h6"
              />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
