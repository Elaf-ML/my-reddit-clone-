"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabaseClient";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Add username state
  const [profilePicture, setProfilePicture] = useState<File | null>(null); // State for profile picture
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Check if email exists in the users table
      const { data: existingUsers, error: checkError } = await supabase
        .from("users")
        .select("email")
        .eq("email", email);

      if (checkError) throw checkError;

      if (existingUsers && existingUsers.length > 0) {
        alert("Email is already registered. Please try another email.");
        setLoading(false);
        return;
      }

      // Step 2: Register user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        alert("Error during registration: " + authError.message);
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
          console.log("Generated file path:", filePath); // Log the generated file path

          const { data, error: uploadError } = await supabase.storage
            .from("avatars") // Ensure the bucket is 'avatars'
            .upload(filePath, profilePicture);

          if (uploadError) {
            console.error("Error uploading profile picture:", uploadError);
            alert("Error uploading profile picture: " + uploadError.message);
            setLoading(false);
            return;
          }

          console.log("Upload result:", data); // Log upload result

          // Verify if we received a valid path
          if (data?.path) {
            // Generate the public URL for the uploaded image
            profilePicUrl = supabase.storage
              .from("avatars")
              .getPublicUrl(data.path).data.publicUrl;

            // Log the URL to check if it's valid
            console.log("Generated profile picture URL:", profilePicUrl);

          } else {
            console.error("Error: No path found in uploaded data.");
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
          alert("Error saving user data: " + insertError.message);
        } else {
          console.log("User inserted successfully:", insertedUser); // Log the inserted user data
          alert("Account created successfully! Please log in.");
          router.push("/login");
        }
      } else {
        console.error("Error: No user ID found in authData.");
        alert("An error occurred while creating your account.");
      }
    } catch (err) {
      console.error("Error during registration:", err);
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form
        onSubmit={handleRegister}
        className="w-full max-w-md p-8 bg-white shadow-lg rounded"
      >
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>

        {/* Username Input */}
        <div className="mb-4">
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700"
          >
            Username
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Email Input */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Password Input */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Profile Picture Input */}
        <div className="mb-4">
          <label
            htmlFor="profile-picture"
            className="block text-sm font-medium text-gray-700"
          >
            Profile Picture
          </label>
          <input
            type="file"
            id="profile-picture"
            onChange={(e) => setProfilePicture(e.target.files ? e.target.files[0] : null)}
            className="w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
    </div>
  );
}
