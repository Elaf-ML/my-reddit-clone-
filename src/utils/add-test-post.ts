import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const createTestPost = async () => {
  console.log('Starting test post creation...');
  console.log('Supabase URL:', supabaseUrl);

  try {
    const testPost = {
      title: `Test Post ${new Date().toISOString()}`,
      content: 'This is a test post created for debugging',
      user_id: 'test-user',
      slug: `test-post-${Date.now()}`
    };

    console.log('Attempting to insert test post:', testPost);

    const { data, error } = await supabase
      .from('Posts')
      .insert([testPost])
      .select();

    if (error) {
      console.error('Error creating test post:', error);
    } else {
      console.log('Test post created successfully:', data);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
};

// Execute the function
createTestPost();

// To run this script:
// 1. Make sure .env.local has the Supabase URL and anon key
// 2. Run: npx ts-node -r dotenv/config src/utils/add-test-post.ts 