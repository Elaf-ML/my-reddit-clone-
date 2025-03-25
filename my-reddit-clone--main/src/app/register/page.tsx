"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabaseClient";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  
  // Check if user is already logged in
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Supabase session error:", error);
          setIsPageLoading(false);
          return;
        }
        
        if (data.session) {
          router.push("/posts");
          return;
        }
        
        setIsPageLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        setIsPageLoading(false);
      }
    };
    
    checkAuthStatus();
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      // Step 1: Check if email exists in the users table
      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email);

      if (checkError) throw checkError;

      if (existingUsers && existingUsers.length > 0) {
        setError("Email is already registered. Please try another email.");
        setLoading(false);
        return;
      }

      // Step 2: Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        setError("Error during registration: " + authError.message);
        setLoading(false);
        return;
      }

      // Step 3: Wait for the user ID to be generated in authData
      if (authData?.user?.id) {
        const userId = authData.user.id; // Get the generated user ID from Supabase Auth
        let profilePicUrl = ""; // Initialize profilePicUrl

        // Step 4: Upload profile picture to Supabase storage
        if (profilePicture) {
          const fileExt = profilePicture.name.split(".").pop();
          const filePath = `avatars/${userId}.${fileExt}`; // Store file with userId as part of filename

          const { data, error: uploadError } = await supabase.storage
            .from("avatars") // Ensure the bucket is 'avatars'
            .upload(filePath, profilePicture);

          if (uploadError) {
            console.error("Error uploading profile picture:", uploadError);
            setError("Error uploading profile picture: " + uploadError.message);
            setLoading(false);
            return;
          }

          // Verify if we received a valid path
          if (data?.path) {
            // Generate the public URL for the uploaded image
            profilePicUrl = supabase.storage
              .from("avatars")
              .getPublicUrl(data.path).data.publicUrl;
          }
        }

        // Step 5: Insert user data into the `users` table with the generated user ID and profile picture URL
        const { data: insertedUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: userId,
            username,
            email,
            password,
            avatar: profilePicUrl || "", // Store the image URL here in the avatar field
            created_at: new Date().toISOString(), // Automatically set created_at timestamp
          })
          .select();

        if (insertError) {
          console.error("Error inserting user into database:", insertError);
          setError("Error saving user data: " + insertError.message);
        } else {
          console.log("User inserted successfully:", insertedUser); // Log the inserted user data
          router.push("/login?registered=true");
        }
      } else {
        console.error("Error: No user ID found in authData.");
        setError("An error occurred while creating your account.");
      }
    } catch (err) {
      console.error("Error during registration:", err);
      setError("An unexpected error occurred.");
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
              Create a Reddit account
            </h1>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              {/* Username input */}
              <div>
                <div className="relative">
                  <input
                    type="text"
                    id="username"
                    className="peer w-full px-3 py-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-0 placeholder-transparent"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                  <label 
                    htmlFor="username" 
                    className={`absolute left-3 transition-all duration-200 ${
                      username ? 'text-xs -top-2 bg-white px-1 text-gray-500' : 'text-gray-400 top-3 text-sm'
                    } ${username ? 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500' : 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500'}`}
                  >
                    Username
                  </label>
                </div>
              </div>
              
              {/* Email input */}
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
              
              {/* Password input */}
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
              
              {/* Confirm Password input */}
              <div>
                <div className="relative">
                  <input
                    type="password"
                    id="confirmPassword"
                    className="peer w-full px-3 py-3 border border-gray-300 rounded bg-gray-50 text-sm text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-0 placeholder-transparent"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <label 
                    htmlFor="confirmPassword" 
                    className={`absolute left-3 transition-all duration-200 ${
                      confirmPassword ? 'text-xs -top-2 bg-white px-1 text-gray-500' : 'text-gray-400 top-3 text-sm'
                    } ${confirmPassword ? 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500' : 'peer-focus:text-xs peer-focus:-top-2 peer-focus:bg-white peer-focus:px-1 peer-focus:text-gray-500'}`}
                  >
                    Confirm Password
                  </label>
                </div>
              </div>
              
              {/* Profile Picture input */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1 ml-1">Profile Picture</label>
                <input
                  type="file"
                  id="profile-picture"
                  onChange={(e) => setProfilePicture(e.target.files ? e.target.files[0] : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm text-gray-900 focus:outline-none focus:border-gray-400 focus:ring-0 file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded file:text-sm file:bg-orange-500 file:text-white hover:file:bg-orange-600"
                />
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
                {loading ? 'Creating account...' : 'Sign Up'}
              </button>
              
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-300"></div>
                <p className="mx-4 text-sm text-gray-500">OR</p>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
            </form>
          </div>
          
          {/* Sign In Card */}
          <div className="bg-white rounded-lg border border-gray-300 p-4 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-orange-500 hover:text-orange-600 font-medium">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
