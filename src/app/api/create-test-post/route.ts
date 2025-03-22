import { NextResponse } from 'next/server';
import { supabase } from '../../../utils/supabaseClient';
import { createSlug } from '../../../utils/helpers';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, title, content } = body;
    
    if (!userId || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Generate a slug from the title
    const slug = createSlug(title);
    
    console.log('Creating test post with:', { userId, title, content, slug });
    
    // Create the post directly using Supabase
    const { data, error } = await supabase
      .from('Posts')
      .insert([
        {
          title,
          content,
          user_id: userId,
          image_url: null,
          slug,
          votes: 0 // Initialize votes to 0
        },
      ])
      .select();
      
    if (error) {
      console.error('Error creating test post:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ success: true, post: data[0] });
  } catch (error: any) {
    console.error('Unexpected error creating test post:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 