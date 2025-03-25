'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import Link from 'next/link';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Cookies from 'js-cookie';

const Navbar = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchResultsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
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

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      authListener.subscription.unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Close search results when clicking outside
    const handleClickOutsideSearch = (event: MouseEvent) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutsideSearch);

    return () => {
      document.removeEventListener('mousedown', handleClickOutsideSearch);
    };
  }, []);

  // Handle search query change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Show dropdown results
    if (value.trim().length > 0) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
      
      // If on posts page and search is cleared, reset posts
      if (window.location.pathname.includes('/posts')) {
        // Clear search params and reset
        const url = new URL(window.location.href);
        url.searchParams.delete('search');
        window.history.pushState({}, '', url);
        
        // Trigger reset event
        window.dispatchEvent(new CustomEvent('searchQueryChanged', { 
          detail: { query: '' } 
        }));
      }
    }
    
    // Real-time filtering: Update URL parameter as user types
    // Only if we're on the posts page
    if (window.location.pathname.includes('/posts')) {
      // Debounce URL updates to avoid too many history states
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
      
      searchDebounceTimerRef.current = setTimeout(() => {
        // Get current URL
        const url = new URL(window.location.href);
        
        if (value.trim()) {
          // Set search parameter
          url.searchParams.set('search', value);
        } else {
          // Remove search parameter if empty
          url.searchParams.delete('search');
        }
        
        // Update URL without full page reload
        window.history.pushState({}, '', url);
        
        // Dispatch a custom event to notify the posts page
        window.dispatchEvent(new CustomEvent('searchQueryChanged', { 
          detail: { query: value } 
        }));
      }, 300); // Debounce for 300ms
    }
  };
  
  // Search for posts based on title
  const searchPosts = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    
    try {
      console.log('[Navbar] Searching for posts with query:', query);
      const { data, error } = await supabase
        .from('Posts')
        .select('id, title, slug')
        .ilike('title', `%${query}%`)
        .limit(5);
        
      if (error) {
        console.error('[Navbar] Error searching posts:', error);
        return;
      }
      
      console.log('[Navbar] Search results:', data);
      setSearchResults(data || []);
    } catch (err) {
      console.error('[Navbar] Unexpected error during search:', err);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Debounce search function
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim()) {
        searchPosts(searchQuery);
      }
    }, 300);
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);
  
  // Only keep this for direct button clicks
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    console.log('[Navbar] Submitting search, navigating to results page:', searchQuery);
    
    // If not already on posts page, navigate there
    if (!window.location.pathname.includes('/posts')) {
      // Close search results dropdown
      setShowSearchResults(false);
      
      // Navigate to search results page
      router.push(`/posts?search=${encodeURIComponent(searchQuery)}`);
    }
  };
  
  // Navigate to a search result
  const navigateToPost = (slug: string) => {
    router.push(`/posts/${slug}`);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleLogout = async () => {
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      // Clear cookies
      Cookies.remove("auth-token", { path: "/" });
      
      // Also try to clear with document.cookie as a fallback
      document.cookie = "auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0";
      
      // Update local state
      setUser(null);
      setUserDropdownOpen(false);
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!isClient) return null;

  return (
    <header className="bg-white dark:bg-[#1A1A1B] border-b border-gray-200 dark:border-gray-800 fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Home */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center">
              <div className="text-orange-500 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-8 h-8">
                  <path d="M10 0C4.48 0 0 4.48 0 10c0 5.52 4.48 10 10 10s10-4.48 10-10C20 4.48 15.52 0 10 0zm5.93 7.05c.24.41.07.93-.35 1.17-.41.24-.93.07-1.17-.35-.96-1.65-3.67-1.65-4.63 0-.24.41-.76.59-1.17.35-.41-.24-.59-.76-.35-1.17C9.7 4.41 13.3 4.41 15.93 7.05zm-10.16.53c0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74 0-.96-.78-1.74-1.74-1.74-.96 0-1.74.78-1.74 1.74zm8.32 0c0-.96-.78-1.74-1.74-1.74-.96 0-1.74.78-1.74 1.74 0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74zM2.58 9.83c0-.17.04-.33.12-.5.17-.33.51-.56.9-.56.21 0 .41.08.58.21 1.51 1.44 3.49 2.14 5.55 2.14 2.06 0 4.04-.7 5.55-2.14.16-.14.36-.21.58-.21.39 0 .74.23.9.56.08.17.12.33.12.5 0 .28-.12.55-.32.75-1.28 1.27-3.19 2.09-5.1 2.36.36.28.75.55 1.18.83 1.95 1.32 3.08 2.2 3.08 2.2.33.24.4.71.16 1.03-.14.19-.35.32-.6.32-.15 0-.29-.05-.42-.13 0 0-1.13-.86-3.01-2.13-1-.67-2-1.22-2.66-1.52-.66.3-1.65.85-2.66 1.52-1.88 1.27-3.01 2.13-3.01 2.13-.13.08-.28.13-.42.13-.25 0-.46-.13-.6-.32-.24-.33-.17-.79.16-1.03 0 0 1.12-.88 3.08-2.2.43-.29.82-.56 1.18-.83-1.91-.27-3.82-1.09-5.1-2.36-.2-.2-.32-.47-.32-.75z" />
                </svg>
              </div>
              <span className="text-black dark:text-white font-bold text-xl ml-1 hidden sm:block">reddit</span>
            </Link>

            {/* Community dropdown (desktop only) */}
            <div className="hidden md:block ml-5">
              <button className="flex items-center space-x-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 py-1 px-3 rounded-md">
                <span className="max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-black dark:text-white">Home</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-500">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mx-4 flex-1 max-w-xl hidden sm:block relative">
            <form onSubmit={handleSearchSubmit}>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search Reddit"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="block w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full py-2 pl-10 pr-3 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchResults(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 hover:text-gray-600">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </form>
            
            {/* Search Results Dropdown */}
            {showSearchResults && (
              <div 
                ref={searchResultsRef} 
                className="absolute w-full mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
              >
                {isSearching ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
                    Searching...
                  </div>
                ) : searchResults.length > 0 ? (
                  <div>
                    {/* 
                    
                      {searchResults.map((post) => (
                      <button
                        key={post.id}
                        onClick={() => navigateToPost(post.slug)}
                        className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{post.title}</p>
                      </button>
                    ))}
                    
                    
                    */}
                  
                    <button
                      onClick={handleSearchSubmit}
                      className="w-full p-2 text-sm text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-center"
                    >
                      See all results for "{searchQuery}"
                    </button>
                  </div>
                ) : searchQuery ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No posts found matching "{searchQuery}"
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Right Nav Items */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            {/* Main Navigation Links (medium screens and up) */}
            <div className="hidden md:flex items-center space-x-1">
              <Link href="/posts" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-500">
                  <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z" />
                  <path d="M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                </svg>
              </Link>
              
              <Link href="/add_friends" className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-500">
                  <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75zM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 01-1.875-1.875V8.625zM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 013 19.875v-6.75z" />
                </svg>
              </Link>

         
            </div>

            {/* User Actions */}
            {user ? (
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center space-x-2 rounded-md py-1 px-3 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="hidden md:flex items-center">
                    <span className="text-xs text-gray-700 dark:text-gray-300 max-w-[100px] truncate">{user.email?.split('@')[0]}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-500">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </button>

                {/* User Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Signed in as</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Profile</Link>
                      <Link href="/posts/new" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Create Post</Link>
                      <Link href="/saved" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Saved</Link>
                      <Link href="/settings" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">Settings</Link>
                    </div>
                    <div className="py-1 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login" className="hidden sm:block text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 px-4 py-1.5 rounded-full">
                  Log In
                </Link>
                <Link href="/register" className="hidden sm:block text-sm font-medium border border-blue-500 text-blue-500 hover:bg-blue-50 dark:hover:bg-gray-800 px-4 py-1.5 rounded-full">
                  Sign Up
                </Link>
                <div className="sm:hidden">
                  <Link href="/login" className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500 text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-gray-500">
                {mobileMenuOpen ? (
                  <path fillRule="evenodd" d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z" clipRule="evenodd" />
                ) : (
                  <path fillRule="evenodd" d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search - Always visible below main navbar on small screens */}
      <div className="sm:hidden border-t border-gray-200 dark:border-gray-800 px-4 py-2">
        <form onSubmit={handleSearchSubmit}>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search Reddit"
              value={searchQuery}
              onChange={handleSearchChange}
              className="block w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full py-2 pl-10 pr-3 text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 hover:text-gray-600">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
              </button>
            )}
          </div>
        </form>
        
        {/* Mobile Search Results Dropdown */}
        {showSearchResults && (
          <div 
            ref={searchResultsRef} 
            className="w-full mt-1 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50"
          >
            {isSearching ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <div className="inline-block w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"></div>
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              <div>
                {searchResults.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => navigateToPost(post.slug)}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-0"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{post.title}</p>
                  </button>
                ))}
                <button
                  onClick={handleSearchSubmit}
                  className="w-full p-2 text-sm text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800 text-center"
                >
                  See all results for "{searchQuery}"
                </button>
              </div>
            ) : searchQuery ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No posts found matching "{searchQuery}"
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link href="/posts" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
              Home
            </Link>
            <Link href="./add_friends" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
              Add Friends
            </Link>
            {user && (
              <>
                <Link href="/posts/new" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Create Post
                </Link>
                <Link href="/profile" className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
