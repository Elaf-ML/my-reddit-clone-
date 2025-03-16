'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../utils/supabaseClient';
import Cookies from 'js-cookie';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const redirectUser = async () => {
      try {
        // Check if user is logged in
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // If user has an active session, redirect to posts
          router.push('/posts');
        } else {
          // If no session, redirect to login
          router.push('/login');
        }
      } catch (error) {
        console.error('Error checking auth:', error);
        // If any error occurs, redirect to login as fallback
        router.push('/login');
      }
    };

    redirectUser();
  }, [router]);

  // Return a loading state while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
    </div>
  );
}
