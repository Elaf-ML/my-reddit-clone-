import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  try {
    // Create a new Supabase client directly in the API route
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    console.log('API route: Creating test post...');
    
    // Create test post
    const testPost = {
      title: `Test Post via API - ${new Date().toLocaleTimeString()}`,
      content: 'This is a test post created through the API route',
      user_id: 'test-user', 
      slug: `test-post-api-${Date.now()}`
    };
    
    const { data, error } = await supabase
      .from('Posts')
      .insert([testPost])
      .select();
      
    if (error) {
      console.error('API route: Error creating test post:', error);
      return NextResponse.json(
        { error: error.message }, 
        { status: 500 }
      );
    }
    
    console.log('API route: Test post created successfully:', data);
    return NextResponse.json(
      { success: true, post: data[0] }, 
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API route: Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' }, 
      { status: 500 }
    );
  }
} 