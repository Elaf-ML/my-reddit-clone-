"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabaseClient";
import Link from "next/link";
import Cookies from "js-cookie";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [debug, setDebug] = useState<string>("");
  const router = useRouter();

  // Check if user is already logged in - this runs on initial page load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Check for existing cookie first
        const existingToken = Cookies.get("auth-token");
        if (existingToken) {
          setDebug("Found existing token in cookies");
        }

        // Direct Supabase session check (uses its own storage mechanism)
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase session error:", error);
          setDebug(prev => prev + "\nSupabase session error: " + error.message);
          setIsPageLoading(false);
          return;
        }
        
        if (data.session) {
          console.log("Active session found:", data.session);
          setDebug(prev => prev + "\nActive session found with token");
          
          // Store current session token in cookies again for redundancy
          try {
            Cookies.set("auth-token", data.session.access_token, { 
              expires: 7,
              path: "/"
            });
            setDebug(prev => prev + "\nStored session token in cookies");
          } catch (cookieError) {
            console.error("Cookie setting error:", cookieError);
            setDebug(prev => prev + "\nCookie setting error: " + cookieError);
          }
          
          router.push("/posts");
          return;
        }
        
        // No active session found, show login page
        setDebug(prev => prev + "\nNo active session found, showing login page");
        setIsPageLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setDebug(prev => prev + "\nError checking auth: " + error);
        setIsPageLoading(false);
      }
    };
    
    checkAuthStatus();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setDebug("Attempting login...");
    
    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) {
        console.error("Login error:", error);
        setError(error.message);
        setDebug(prev => prev + "\nLogin error: " + error.message);
      } else if (data?.session) {
        setDebug(prev => prev + "\nLogin successful, session created");
        console.log("Session data:", data.session);
        
        // Store JWT in cookies as a backup (Supabase already stores in localStorage)
        try {
          const token = data.session.access_token;
          // Set the token directly with document.cookie for maximum browser compatibility
          document.cookie = `auth-token=${token}; path=/; max-age=${60*60*24*7}`; // 7 days
          
          // Also try with js-cookie as a fallback
          Cookies.set("auth-token", token, { 
            expires: 7,
            path: "/"
          });
          
          setDebug(prev => prev + "\nToken stored in cookies");
          
          // Check if cookie was actually set
          setTimeout(() => {
            const cookieCheck = Cookies.get("auth-token");
            if (cookieCheck) {
              setDebug(prev => prev + "\nCookie verification success");
            } else {
              setDebug(prev => prev + "\nCookie verification failed - cookie not found");
            }
          }, 100);
        } catch (cookieError) {
          console.error("Cookie setting error:", cookieError);
          setDebug(prev => prev + "\nCookie setting error: " + cookieError);
        }
        
        // Redirect to posts page
        router.push("/posts");
      } else {
        setError("Failed to create session. Please try again.");
        setDebug(prev => prev + "\nNo session data returned from Supabase");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An unexpected error occurred. Please try again.");
      setDebug(prev => prev + "\nUnexpected error: " + err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while checking auth status
  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="flex flex-grow items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Main Card */}
          <div className="bg-white rounded-lg border border-gray-300 p-8 mb-4">
            {/* Logo */}
            <div className="flex justify-center mb-8">
              <div className="text-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-12 h-12">
                  <path d="M10 0C4.48 0 0 4.48 0 10c0 5.52 4.48 10 10 10s10-4.48 10-10C20 4.48 15.52 0 10 0zm5.93 7.05c.24.41.07.93-.35 1.17-.41.24-.93.07-1.17-.35-.96-1.65-3.67-1.65-4.63 0-.24.41-.76.59-1.17.35-.41-.24-.59-.76-.35-1.17C9.7 4.41 13.3 4.41 15.93 7.05zm-10.16.53c0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74 0-.96-.78-1.74-1.74-1.74-.96 0-1.74.78-1.74 1.74zm8.32 0c0-.96-.78-1.74-1.74-1.74-.96 0-1.74.78-1.74 1.74 0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74z" />
                </svg>
              </div>
            </div>
            
            {/* Title */}
            <h1 className="text-xl font-bold text-center text-gray-800 mb-6">
              Sign in to Reddit
            </h1>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <div>
                <div className="relative">
                  <input
                    type="email"
                    id="email"
                    className="peer w-full px-3 py-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-0 placeholder-transparent"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <label 
                    htmlFor="email" 
                    className={`absolute left-3 transition-all duration-200 ${
                      email ? 'text-xs -top-2 bg-white px-1 text-gray-500' : 'text-gray-400 top-3 text-sm'
                    } ${email ? 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500' : 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500'}`}
                  >
                    Email
                  </label>
                </div>
              </div>
              
              <div>
                <div className="relative">
                  <input
                    type="password"
                    id="password"
                    className="peer w-full px-3 py-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-0 placeholder-transparent"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <label 
                    htmlFor="password" 
                    className={`absolute left-3 transition-all duration-200 ${
                      password ? 'text-xs -top-2 bg-white px-1 text-gray-500' : 'text-gray-400 top-3 text-sm'
                    } ${password ? 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500' : 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500'}`}
                  >
                    Password
                  </label>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className={`w-full py-2 rounded font-medium text-sm ${
                  loading 
                    ? 'bg-orange-300 text-white cursor-not-allowed' 
                    : 'bg-orange-500 text-white hover:bg-orange-600 transition-colors'
                }`}
              >
                {loading ? 'Signing in...' : 'Log In'}
              </button>
              
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-300"></div>
                <p className="mx-4 text-sm text-gray-500">OR</p>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
              
              <div className="text-center">
                <Link 
                  href="/forgot-password" 
                  className="text-sm text-blue-800 hover:text-blue-900"
                >
                  Forgot Password?
                </Link>
              </div>
            </form>
            
            {/* Debug info - can be removed in production */}
            {debug && (
              <div className="mt-4 p-2 bg-gray-100 rounded text-xs text-gray-600 whitespace-pre-line overflow-auto max-h-40">
                <strong>Debug Info:</strong>
                {debug}
              </div>
            )}
          </div>
          
          {/* Sign up Card */}
          <div className="bg-white rounded-lg border border-gray-300 p-6">
            <p className="text-center text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-orange-500 font-semibold hover:text-orange-600">
                Sign up
              </Link>
            </p>
          </div>
          
          {/* App Download */}
          <div className="mt-6">
            <p className="text-center text-sm mb-4">Get the app.</p>
            <div className="flex justify-center space-x-4">
              <a href="#" className="block">
                <div className="h-10 w-32 bg-black rounded flex items-center justify-center text-white text-xs p-1">
                  <div className="mr-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.77 1.16-.05 2.27-.83 3.48-.71 1.49.16 2.58.83 3.26 2.01-3.14 2.11-2.62 6.75.66 8.1-.7 1.94-1.68 3.89-2.48 4.8zM9.7 7.14c-.09-3.12 2.5-5.71 5.56-5.89.36 3.28-2.69 5.97-5.56 5.89z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[0.6rem] leading-none">Download on the</div>
                    <div className="text-sm font-semibold leading-tight">App Store</div>
                  </div>
                </div>
              </a>
              <a href="#" className="block">
                <div className="h-10 w-32 bg-black rounded flex items-center justify-center text-white text-xs p-1">
                  <div className="mr-1">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                      <path d="M3.61 1.814L13.75 12l-10.14 10.186c-.31-.298-.61-.72-.61-1.186V3c0-.466.3-.888.61-1.186zM14.5 12.75l2.92-2.92c.34-.34.58-.9.58-1.33 0-.83-.58-1.5-1.31-1.5-.27 0-.54.09-.77.31L12.75 11.5l1.75 1.25zM13.75 12l1.75 1.25-2.92 2.92c-.23.23-.5.31-.77.31-.73 0-1.31-.67-1.31-1.5 0-.43.24-.99.58-1.33L13.75 12z M16.5 5.25L5.25 16.5h10.99c.95 0 1.75-.8 1.75-1.75V7c0-.95-.8-1.75-1.75-1.75h-.24z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[0.6rem] leading-none">GET IT ON</div>
                    <div className="text-sm font-semibold leading-tight">Google Play</div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="py-4 text-center text-xs text-gray-500">
        <div className="container mx-auto px-4">
          <div className="space-x-4 mb-2">
            <a href="#" className="hover:underline">About</a>
            <a href="#" className="hover:underline">Help</a>
            <a href="#" className="hover:underline">Privacy</a>
            <a href="#" className="hover:underline">Terms</a>
          </div>
          <p>© 2023 Reddit Clone, Inc.</p>
        </div>
      </footer>
    </div>
  );
}
