import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set');

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Self-executing function to test the connection
(async () => {
  try {
    // Test the connection to Supabase
    const { data, error } = await supabase.from('Posts').select('id').limit(1);
    
    if (error) {
      console.error('Error connecting to Supabase:', error.message);
    } else {
      console.log('Successfully connected to Supabase!');
    }
  } catch (error) {
    console.error('Error testing Supabase connection:', error);
  }

  // Test connection to each table
  console.log("Testing Supabase connection to Posts table...");
  const { data: postsData, error: postsError } = await supabase
    .from('Posts')
    .select('id')
    .limit(1);
  
  console.log(postsError ? 
    `Error connecting to Posts table: ${postsError.message}` : 
    `Successfully connected to Posts table. Found: ${postsData?.length || 0} records`);

  console.log("Testing Supabase connection to Comments table...");
  const { data: commentsData, error: commentsError } = await supabase
    .from('Comments')
    .select('id')
    .limit(1);
  
  console.log(commentsError ? 
    `Error connecting to Comments table: ${commentsError.message}` : 
    `Successfully connected to Comments table. Found: ${commentsData?.length || 0} records`);

  console.log("Testing Supabase connection to users table...");
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('id')
    .limit(1);
  
  console.log(usersError ? 
    `Error connecting to users table: ${usersError.message}` : 
    `Successfully connected to users table. Found: ${usersData?.length || 0} records`);
})();