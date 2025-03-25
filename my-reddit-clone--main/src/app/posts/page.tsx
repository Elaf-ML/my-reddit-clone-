"use client"

import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import { useToast } from '../../components/ToastContainer';
import { useRouter } from 'next/navigation';
import { supabase } from '../../utils/supabaseClient';
import { FaRegComment, FaArrowUp, FaArrowDown, FaShare, FaBookmark, FaRegBookmark, FaEllipsisH, FaRegUser, 
         FaFire, FaClock, FaSortAmountDown, FaTrash, FaSearch } from 'react-icons/fa';
import Link from 'next/link';
import TimeAgo from 'react-timeago';
import SafeDiv from '../../components/SafeDiv';
import { getPostVotes, getUserVotes, voteOnPost } from '../actions/voteActions';
import { deleteComment, deleteCommentAsPostAuthor, purgeCommentCompletely } from '../actions/commentActions';
import { getAllPosts, getUserPosts, deletePost, searchPosts, Post as ApiPost } from '../actions/postActions';

// Custom formatter function for TimeAgo
const timeAgoFormatter = (value: number, unit: string, suffix: string): string => {
  // Special case for seconds - consider "just now" for the first minute
  if (unit === 'second') {
    if (value < 60) {
      return 'just now';
    }
    return `${value} seconds ago`;
  }
  
  // Handle minutes - consider very recent minutes as "just now" as well
  if (unit === 'minute') {
    if (value === 1) {
      return 'just now'; // Consider 1 minute ago as "just now" too
    }
    return `${value} minutes ago`;
  }
  
  // Check for negative time differences (future dates or timezone issues)
  if (value < 0) {
    return 'just now';
  }
  
  // Handle hours
  if (unit === 'hour') {
    if (value === 1) {
      return '1 hour ago';
    }
    return `${value} hours ago`;
  }
  
  // Handle days
  if (unit === 'day') {
    if (value === 1) {
      return 'yesterday';
    }
    if (value < 7) {
      return `${value} days ago`;
    }
    // For older than a week, show "X weeks ago"
    const weeks = Math.floor(value / 7);
    if (weeks === 1) {
      return '1 week ago';
    }
    if (weeks < 4) {
      return `${weeks} weeks ago`;
    }
    // For older than a month, show the actual date
    return formatDate(new Date(Date.now() - value * 24 * 60 * 60 * 1000).toISOString());
  }
  
  // Handle months and years
  if (unit === 'month' || unit === 'year') {
    const date = new Date(Date.now() - (value * (unit === 'month' ? 30 : 365) * 24 * 60 * 60 * 1000));
    return formatDate(date.toISOString());
  }
  
  // Default case - properly format unit name (singular/plural)
  const unitStr = value === 1 ? unit : `${unit}s`;
  return `${value} ${unitStr} ${suffix}`;
};

// Helper to format a date in a more readable way (e.g., Oct 15, 2023)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

interface Post extends Omit<ApiPost, 'image_url'> {
  image_url?: string;  // Change from string | null to string | undefined
  votes?: number;
  comment_count?: number;
  avatar?: string | null;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  post_id: string;
  user_id: string;
  username: string;
  parent_id?: string;
  replies?: Comment[];
  avatar?: string;
}

interface User {
  id: string;
  username?: string;
  email?: string;
  avatar?: string;
}

// Define sorting options
type SortOption = 'votes' | 'newest' | 'oldest';

const RedditPosts = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [replyTo, setReplyTo] = useState<Record<string, string | null>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [votingInProgress, setVotingInProgress] = useState<Record<string, boolean>>({});
  const [missingTables, setMissingTables] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('votes');
  const [commentToDelete, setCommentToDelete] = useState<{id: string, postId: string} | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editPostTitle, setEditPostTitle] = useState('');
  const [editPostContent, setEditPostContent] = useState('');
  const [updatingPost, setUpdatingPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    // Only fetch all posts if we're not searching
    if (!searchQuery) {
      console.log('Initial load or sort changed - fetching all posts');
      fetchPosts();
    }
    
    checkUserSession();
  }, [sortBy]); // Re-fetch posts when sort option changes

  // Separate effect for URL search parameter - runs on initial mount
  useEffect(() => {
    // Check for search parameter in URL
    const searchParams = new URLSearchParams(window.location.search);
    const searchTerm = searchParams.get('search');
    
    if (searchTerm) {
      console.log('[PostsPage] Found search parameter in URL:', searchTerm);
      setSearchQuery(searchTerm);
      handleSearch(undefined , searchTerm);
    }
    
    // Listen for real-time search events from Navbar
    const handleSearchEvent = (event: any) => {
      try {
        const { query } = event.detail;
        console.log('[PostsPage] Received search event with query:', query);
        setSearchQuery(query);
        
        if (query.trim()) {
          handleSearch(undefined , query);
        } else {
          console.log('[PostsPage] Empty search query, resetting to all posts');
          fetchPosts(); // Reset to all posts if search is empty
        }
      } catch (err) {
        console.error('[PostsPage] Error handling search event:', err);
      }
    };
    
    // Add event listener for search query changes
    console.log('[PostsPage] Adding searchQueryChanged event listener');
    window.addEventListener('searchQueryChanged', handleSearchEvent);
    
    // Clean up event listener
    return () => {
      console.log('[PostsPage] Removing searchQueryChanged event listener');
      window.removeEventListener('searchQueryChanged', handleSearchEvent);
    };
  }, []); // Only run on initial mount

  const checkUserSession = async () => {
    try {
      // Check if user is logged in
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error checking session:', error);
        return;
      }
      
      if (session) {
      setSession(session);
      
        // Fetch complete user data including avatar
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, avatar')
          .eq('id', session.user.id)
          .single();
        
        if (userError) {
          console.error('Error fetching user data:', userError);
        } else if (userData) {
          // Simply use the avatar directly from users collection
          setUser(userData);
        } else {
          // Basic user object from session
          setUser(session.user);
        }
        
        // Fetch user votes if logged in
        fetchUserVotes(session.user.id);
      }
    } catch (err) {
      console.error('Error checking session:', err);
    }
  };

  const fetchUserVotes = async (userId: string) => {
    try {
      const votesMap = await getUserVotes(userId);
      setUserVotes(votesMap);
    } catch (err) {
      console.error('Error in fetchUserVotes:', err);
    }
  };

  const fetchPosts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session?.user) {
        // Fetch user details
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id, username, avatar')
          .eq('id', session.user.id)
          .single();
          
        if (userError) {
          console.error('Error fetching user data:', userError);
        } else if (userData) {
          // Simply use the avatar directly from users collection
          setUser(userData);
        } else {
          // Basic user object from session
          setUser(session.user);
        }
      }
      
      // Check for missing tables/columns
      const { data: hasPosts, error: postsError } = await supabase.from('Posts').select('votes').limit(1);
      const { data: hasComments, error: commentsError } = await supabase.from('Comments').select('parent_id').limit(1);
      const { data: hasUserVotes, error: userVotesError } = await supabase.from('UserVotes').select('vote_value').limit(1);
      
      const missingList: string[] = [];
      if (postsError && postsError.message.includes('column "votes"')) {
        missingList.push('Posts.votes');
      }
      if (commentsError && commentsError.message.includes('column "parent_id"')) {
        missingList.push('Comments.parent_id');
      }
      if (userVotesError && userVotesError.message.includes('relation "UserVotes" does not exist')) {
        missingList.push('UserVotes table');
      }
      setMissingTables(missingList);
      
      // Fetch posts without trying to join users
      let query = supabase
        .from('Posts')
        .select('*')
        .order(sortBy === 'votes' ? 'votes' : 'created_at', { 
          ascending: sortBy === 'oldest' 
        });
        
      const { data: postsData, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (postsData) {
        // Get unique user IDs from posts
        const userIds = [...new Set(postsData.map((post: any) => post.user_id))];
       
        // Fetch user profiles separately
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, avatar')
          .in('id', userIds);
          
        if (usersError) {
          console.error('Error fetching user profiles:', usersError);
        }
        
        // Create a map of user profiles by ID
        const userMap: Record<string, { username: string, avatar: string | null, id: string }> = {};
        if (usersData) {
          usersData.forEach((user: any) => {
            userMap[user.id] = {
              id: user.id,
              username: user.username || 'anonymous',
              avatar: user.avatar // Use avatar directly from the users collection
            };
          });
        }
        
        // Map post data to include username and avatar from user map
        const postsWithUserData = postsData.map((post: any) => {
          const userData = userMap[post.user_id] || { username: 'anonymous', avatar: null, id: null };
          return {
            ...post,
            username: userData.username,
            avatar: userData.avatar // Add the avatar to each post
          };
        });
        
        // Count comments for each post individually
        const postsWithCounts = [...postsWithUserData];
        
        // Use Promise.all to perform all count operations in parallel
        await Promise.all(
          postsWithCounts.map(async (post) => {
            try {
              const { count, error } = await supabase
                .from('Comments')
                .select('*', { count: 'exact', head: true })
                .eq('post_id', post.id);
                
              if (!error) {
                post.comment_count = count || 0;
              } else {
                console.error(`Error counting comments for post ${post.id}:`, error);
                post.comment_count = 0;
              }
            } catch (err) {
              console.error(`Error in comment count for post ${post.id}:`, err);
              post.comment_count = 0;
            }
          })
        );
        
        setPosts(postsWithCounts);
        
        // Fetch user votes if logged in
        if (session?.user) {
          const { data: userVotesData, error: votesError } = await supabase
            .from('UserVotes')
            .select('post_id, vote_value')
            .eq('user_id', session.user.id);
            
          if (!votesError && userVotesData) {
            const votesMap: Record<string, number> = {};
            userVotesData.forEach((vote: { post_id: string; vote_value: number }) => {
              votesMap[vote.post_id] = vote.vote_value;
            });
            setUserVotes(votesMap);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching posts:', err);
      setError(`Error fetching posts: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      console.log(`Fetching comments for post ${postId}...`);
      
      // Get all comments for this post
      const { data, error } = await supabase
      .from('Comments')
      .select('*')
        .eq('post_id', postId)
      .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
      return;
    }

      if (data && data.length > 0) {
        // Get unique user IDs from comments
        const userIds = [...new Set(data.map((comment: any) => comment.user_id))];
        
        // Fetch user profiles separately
    const { data: usersData, error: usersError } = await supabase
      .from('users')
          .select('id, username, avatar')
      .in('id', userIds);

    if (usersError) {
          console.error('Error fetching user profiles for comments:', usersError);
        }
        
        // Create a map of user profiles by ID
        const userMap: Record<string, { username: string, avatar: string | null }> = {};
        if (usersData) {
          usersData.forEach((user: any) => {
            userMap[user.id] = {
              username: user.username || 'anonymous',
              avatar: user.avatar
            };
          });
        }
        
        // Process comments to include username and avatar
        const commentsWithUserData = data.map((comment: any) => {
          const userData = userMap[comment.user_id] || { username: 'anonymous', avatar: null };
          return {
        ...comment,
            username: userData.username,
            avatar: userData.avatar,
            replies: []
          };
        });

        // Check if parent_id exists in the schema
        const hasParentId = 'parent_id' in data[0];
        
        if (hasParentId) {
          // Organize comments into tree structure
          const rootComments: Comment[] = [];
          const commentMap: Record<string, Comment> = {};
          
          // First, create a map of all comments
          commentsWithUserData.forEach((comment: any) => {
            commentMap[comment.id] = { ...comment, replies: [] };
          });
          
          // Then, organize into parent-child relationships
          commentsWithUserData.forEach((comment: any) => {
            if (comment.parent_id && commentMap[comment.parent_id]) {
              // This is a reply, add to parent's replies
              commentMap[comment.parent_id].replies = [
                ...(commentMap[comment.parent_id].replies || []),
                commentMap[comment.id]
              ];
            } else {
              // This is a root comment
              rootComments.push(commentMap[comment.id]);
            }
          });
          
          console.log(`Organized ${rootComments.length} root comments with their replies`);
          
          // Set comments directly instead of merging with previous state
          setComments(prev => ({
            ...prev,
            [postId]: rootComments
          }));
        } else {
          // If parent_id doesn't exist, just show flat comments list
          setComments(prev => ({
            ...prev,
            [postId]: commentsWithUserData.map((comment: any) => ({
              ...comment,
              replies: []
            }))
          }));
        }
      } else {
        // No comments found, set an empty array
        console.log(`No comments found for post ${postId}`);
        setComments(prev => ({
          ...prev,
          [postId]: []
        }));
      }
    } catch (err) {
      console.error(`Error processing comments for post ${postId}:`, err);
    }
  };

  const toggleExpandComments = (postId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [postId]: !prev[postId]
    }));
    
    // If expanding and we don't have comments yet, fetch them
    // This prevents re-fetching if we've already emptied the comments through deletion
    if (!expandedComments[postId] && (!comments[postId] || comments[postId].length === 0)) {
      // Check if we actually have no comments, or if we have an empty array from deletion
      if (!comments[postId]) {
        console.log(`Fetching comments for post ${postId} on expand`);
        fetchComments(postId);
      } else {
        console.log(`Post ${postId} has no comments or all comments were deleted`);
      }
    }
  };

  const handleVote = async (postId: string, voteValue: number) => {
    if (!user) {
      toast.showToast('You must be logged in to vote', 'info');
      return;
    }
    
    // Check if Posts.votes exists
    if (missingTables.includes('Posts.votes') || missingTables.includes('UserVotes')) {
      toast.showToast('Voting system needs to be set up. Please run the SQL schema first.', 'error');
      return;
    }

    // Check if already voting on this post
    if (votingInProgress[postId]) {
      return;
    }

    try {
      // Set voting in progress
      setVotingInProgress(prev => ({
        ...prev,
        [postId]: true
      }));
      
      // Find the post we're voting on
      const post = posts.find(p => p.id === postId);
      if (!post) {
        toast.showToast('Post not found', 'error');
        setVotingInProgress(prev => ({
          ...prev,
          [postId]: false
        }));
        return;
      }
      
      // Get current user vote from state
      const currentUserVote = userVotes[postId] || 0;
      
      // Optimistically update UI - handle adding vote or toggle
      let newUserVote;
      let totalVoteChange;
      
      if (currentUserVote === voteValue) {
        // User is clicking the same button - toggle off
        newUserVote = 0;
        totalVoteChange = -voteValue;
      } else if (currentUserVote === 0) {
        // New vote
        newUserVote = voteValue;
        totalVoteChange = voteValue;
      } else {
        // Switching vote (e.g., from upvote to downvote)
        newUserVote = voteValue;
        totalVoteChange = voteValue * 2; // Remove old and add new
      }
      
      // Update posts state with new vote total
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, votes: (p.votes || 0) + totalVoteChange } 
          : p
      ));
      
      // Update userVotes state with new user vote
      setUserVotes(prev => ({
        ...prev,
        [postId]: newUserVote
      }));
      
      // Send the vote to the server
      const result = await voteOnPost(user.id, postId, voteValue);
      
      if (!result.success) {
        // Revert optimistic updates on error
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, votes: post.votes || 0 } 
            : p
        ));
        setUserVotes(prev => ({
          ...prev,
          [postId]: currentUserVote
        }));
        toast.showToast(`Error: ${result.message}`, 'error');
      } else {
        // Update with the server's calculated total if different
        if (result.newTotal !== undefined) {
          setPosts(prev => prev.map(p => 
            p.id === postId 
              ? { ...p, votes: result.newTotal } 
              : p
          ));
        }
        
        // Update with the server's calculated user vote if returned
        if (result.userVote !== undefined) {
          setUserVotes(prev => ({
            ...prev,
            [postId]: result.userVote
          }));
        }
      }
    } catch (err: any) {
      console.error('Error processing vote:', err);
      toast.showToast('An unexpected error occurred while voting', 'error');
      // Refresh posts on error
      fetchPosts();
      if (user) {
        fetchUserVotes(user.id);
      }
    } finally {
      // Clear voting in progress
      setVotingInProgress(prev => ({
        ...prev,
        [postId]: false
      }));
    }
  };

  const handleAddComment = async (postId: string, content: string, parentId: string | null = null) => {
    if (!user) {
      toast.showToast('You must be logged in to comment', 'info');
      return;
    }

    if (!content || content.trim() === '') {
      toast.showToast('Comment cannot be empty', 'error');
      return;
    }
    
    try {
      // First check if the parent_id column exists
      const { error: schemaError } = await supabase
      .from('Comments')
        .select('parent_id')
        .limit(1);
        
      if (schemaError && schemaError.message.includes("'parent_id' column")) {
        toast.showToast('The Comments table needs to be updated. Please run the SQL schema first.', 'error');
        return;
      }

      // Create comment object conditionally based on parentId
      const newComment = parentId 
        ? {
            post_id: postId,
            user_id: user.id,
            content: content.trim(),
            parent_id: parentId
          }
        : {
            post_id: postId,
            user_id: user.id,
            content: content.trim()
          };
      
      const { data, error } = await supabase
      .from('Comments')
        .insert([newComment])
        .select();
        
      if (error) {
        console.error('Error adding comment:', error);
        toast.showToast(`Error: ${error.message}`, 'error');
        return;
      }
      
      if (data && data.length > 0) {
        // Clear input
        if (parentId) {
          setCommentInputs(prev => ({ ...prev, [`${postId}-${parentId}`]: '' }));
          setReplyTo(prev => ({ ...prev, [postId]: null }));
        } else {
          setCommentInputs(prev => ({ ...prev, [postId]: '' }));
        }
        
        // Update comment count
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, comment_count: (post.comment_count || 0) + 1 } 
            : post
        ));
        
        // Refresh comments
        fetchComments(postId);
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      toast.showToast('An unexpected error occurred', 'error');
    }
  };

  const handleReply = (postId: string, commentId: string) => {
    setReplyTo(prev => ({ ...prev, [postId]: commentId }));
    setCommentInputs(prev => ({ ...prev, [`${postId}-${commentId}`]: '' }));
  };

  const cancelReply = (postId: string) => {
    setReplyTo(prev => ({ ...prev, [postId]: null }));
  };

  const confirmDeleteComment = (commentId: string, postId: string) => {
    setCommentToDelete({ id: commentId, postId });
    setShowDeleteModal(true);
  };
  
  const cancelDeleteComment = () => {
    setCommentToDelete(null);
    setShowDeleteModal(false);
  };
  
  // Add a function to count comments and replies recursively
  const countCommentsRecursively = (comments: Comment[]): number => {
    let count = comments.length;
    
    // Add count of all nested replies
    for (const comment of comments) {
      if (comment.replies && comment.replies.length > 0) {
        count += countCommentsRecursively(comment.replies);
      }
    }
    
    return count;
  };

  // Add a function to clean up orphaned comments (replies with deleted parents)
  const cleanOrphanedComments = (commentsTree: Comment[]): Comment[] => {
    return commentsTree.filter(comment => comment !== null).map(comment => {
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: cleanOrphanedComments(comment.replies)
        };
      }
      return comment;
    });
  };

  // Update the proceedWithDelete function to make comment deletion instant without page refreshes
  const proceedWithDelete = async () => {
    if (!commentToDelete) return;
    
    try {
      // Get comment to be deleted 
      const postId = commentToDelete.postId;
      const commentId = commentToDelete.id;
      
      console.log(`CLEAN DELETE: Starting comment deletion for comment ID: ${commentId} in post: ${postId}`);
      
      // Set deleting state
      setDeletingCommentId(commentId);
      
      // Store the current comments state to revert in case of error
      const previousComments = { ...comments };
      
      // Optimistically remove the comment from UI - also removes all nested replies
      const removeCommentFromTree = (commentsArray: Comment[]): Comment[] => {
        // Filter out the deleted comment and all its replies
        const filtered = commentsArray.filter(c => {
          // Remove the comment itself
          if (c.id === commentId) {
            return false;
          }
          
          // Keep all other comments
          return true;
        });
        
        // Process other comments' replies recursively
        return filtered.map(comment => {
          if (comment.replies && comment.replies.length > 0) {
            return {
              ...comment,
              // Filter out any reply that has the deleted comment as parent
              replies: removeCommentFromTree(comment.replies)
            };
          }
          return comment;
        });
      };
      
      // Make a copy of the current comments for the post
      const currentPostComments = comments[postId] ? [...comments[postId]] : [];
      
      // Calculate how many comments (including replies) will be deleted
      let commentCountBefore = countCommentsRecursively(currentPostComments);
      
      // Update comments state optimistically
      if (comments[postId]) {
        console.log(`CLEAN DELETE: Optimistically removing comment ${commentId} from UI`);
        const updatedComments = removeCommentFromTree(comments[postId] || []);
        
        // Also clean up any orphaned comments (those with parent_id that no longer exists)
        const cleanedComments = cleanOrphanedComments(updatedComments);
        
        // Instantly update the UI
        setComments(prev => ({
        ...prev,
          [postId]: cleanedComments
        }));
        
        // Calculate new comment count
        let commentCountAfter = countCommentsRecursively(cleanedComments);
        let deletedCount = commentCountBefore - commentCountAfter;
        
        console.log(`CLEAN DELETE: Comment counts - Before: ${commentCountBefore}, After: ${commentCountAfter}, Deleted: ${deletedCount}`);
        
        // Update comment count optimistically
        setPosts(prev => prev.map(post => 
          post.id === postId 
            ? { ...post, comment_count: Math.max(0, (post.comment_count || 0) - deletedCount) } 
            : post
        ));
      }
      
      // Close the modal immediately
      setCommentToDelete(null);
      setShowDeleteModal(false);
      
      // Send delete request to server in the background
      console.log(`CLEAN DELETE: Sending delete request to server for comment: ${commentId}`);
      
      if (!user || !user.id) {
        console.error('CLEAN DELETE: User ID is missing');
        toast.showToast('Authentication error', 'error');
        return;
      }

      // Use the new robust purgeCommentCompletely function for better deletion reliability
      const result = await purgeCommentCompletely(commentId, user.id);
      
      console.log(`CLEAN DELETE: Server response for comment deletion:`, result);
      
      // Clear deleting state
      setDeletingCommentId(null);
      
      if (!result.success) {
        // Revert to previous state if there's an error
        console.error(`CLEAN DELETE: Error deleting comment: ${result.error || 'Unknown error'}`);
        toast.showToast(`Failed to delete comment: ${result.error}`, 'error');
        setComments(previousComments);
        
        // Revert comment count by setting back to original state
        setPosts(prev => prev.map(post => {
          if (post.id === postId) {
            const originalComments = previousComments[postId] || [];
            const originalCount = countCommentsRecursively(originalComments);
            return { ...post, comment_count: originalCount };
          }
          return post;
        }));

        return;
      }
      
      toast.showToast('Comment deleted successfully', 'success');
    } catch (err) {
      console.error('CLEAN DELETE: Error deleting comment:', err);
      toast.showToast('An unexpected error occurred', 'error');
      
      // Clear deleting state
      setDeletingCommentId(null);
      
      // Don't auto-refresh in case of error, just clear state
      setCommentToDelete(null);
      setShowDeleteModal(false);
    }
  };

  const renderComments = (comments: Comment[], postId: string, level: number = 0) => {
    return comments.map(comment => {
      const isDeleting = deletingCommentId === comment.id;
      const isReplyingTo = replyTo[postId] === comment.id;
      const inputKey = `${postId}-${comment.id}`;
      const inputValue = commentInputs[inputKey] || '';
      
      return (
        <div key={comment.id} className={`border-l-2 ${level === 0 ? 'border-blue-500' : 'border-gray-300'} pl-4 mb-3`}>
          <div className="bg-gray-800 rounded-md p-3 mb-1">
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center">
                <span className="font-semibold text-purple-400">
                  {comment.username || 'Anonymous'}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              
              {user && (user.id === comment.user_id || isPostAuthor(postId)) && (
                <button 
                  onClick={() => confirmDeleteComment(comment.id, postId)}
                  disabled={isDeleting}
                  className="text-gray-400 hover:text-red-500"
                >
                  {isDeleting ? (
                    <span className="text-xs">Deleting...</span>
                  ) : (
                    <FaTrash size={12} />
                  )}
                </button>
              )}
            </div>
            
            <div className="text-gray-200 mb-2 whitespace-pre-wrap">
              {comment.content}
            </div>
            
            <div className="flex space-x-4 text-xs text-gray-400">
              <button 
                onClick={() => handleReply(postId, comment.id)}
                className="hover:text-blue-500 flex items-center space-x-1"
              >
                <FaRegComment size={12} />
                <span>Reply</span>
              </button>
            </div>
          </div>
          
          {/* Show reply input if user is replying to this comment */}
          {isReplyingTo && user && (
            <div className="ml-2 mb-3">
              <div className="flex items-start space-x-2">
                <textarea
                  value={inputValue}
                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                  placeholder="Write a reply..."
                  className="bg-gray-700 text-white w-full rounded-md p-2 text-sm"
                  rows={2}
                />
              </div>
              <div className="flex justify-end mt-1 space-x-2">
                <button
                  onClick={() => cancelReply(postId)}
                  className="text-xs text-gray-400 hover:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddComment(postId, inputValue, comment.id)}
                  disabled={!inputValue.trim()}
                  className={`text-xs px-2 py-1 rounded ${
                    !inputValue.trim() 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Reply
                </button>
              </div>
            </div>
          )}
          
          {/* Render nested replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="ml-2">
              {renderComments(comment.replies, postId, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const checkRequiredTables = async () => {
    const missing: string[] = [];
    
    // Check if Posts table has votes column
    try {
      const { data, error } = await supabase
      .from('Posts')
        .select('votes')
        .limit(1);
      
      if (error && error.message.includes("'votes' column")) {
        missing.push('Posts.votes');
      }
    } catch (err) {
      console.error('Error checking Posts schema:', err);
    }
    
    // Check if Comments table has parent_id column
    try {
      const { data, error } = await supabase
        .from('Comments')
        .select('parent_id')
        .limit(1);
      
      if (error && error.message.includes("'parent_id' column")) {
        missing.push('Comments.parent_id');
      }
    } catch (err) {
      console.error('Error checking Comments schema:', err);
    }
    
    // Check if UserVotes table exists
    try {
      const { data, error } = await supabase
        .from('UserVotes')
        .select('*')
        .limit(1);
      
      if (error && error.code === '42P01') {
        missing.push('UserVotes');
      }
    } catch (err) {
      console.error('Error checking UserVotes schema:', err);
    }
    
    setMissingTables(missing);
  };

  const copySchemaToClipboard = () => {
    const schemaText = `
-- Make sure Posts table has a votes column
ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;

-- Make sure Comments table has a parent_id column for nested replies
ALTER TABLE "Comments" ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES "Comments"(id) NULL;

-- Create UserVotes table to track individual user votes
CREATE TABLE IF NOT EXISTS "UserVotes" (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES "users"(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES "Posts"(id) ON DELETE CASCADE,
  vote_value INTEGER NOT NULL CHECK (vote_value IN (-1, 1)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Add Row Level Security (RLS) to UserVotes
ALTER TABLE "UserVotes" ENABLE ROW LEVEL SECURITY;

-- Create policies for UserVotes
CREATE POLICY "Users can manage their own votes" 
ON "UserVotes" FOR ALL TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read votes" 
ON "UserVotes" FOR SELECT TO anon, authenticated 
USING (true);

-- Create stored procedure for atomic vote operations
CREATE OR REPLACE FUNCTION vote_on_post(
  p_user_id UUID,
  p_post_id UUID,
  p_vote_value INTEGER
) RETURNS INTEGER AS $$
DECLARE
  current_votes INTEGER;
  new_votes INTEGER;
  post_exists BOOLEAN;
  existing_vote INTEGER;
BEGIN
  -- Check if post exists
  SELECT EXISTS(SELECT 1 FROM "Posts" WHERE id = p_post_id) INTO post_exists;
  
  IF NOT post_exists THEN
    RAISE EXCEPTION 'post not found: %', p_post_id;
  END IF;
  
  -- Check if user already voted on this post
  SELECT vote_value INTO existing_vote 
  FROM "UserVotes" 
  WHERE user_id = p_user_id AND post_id = p_post_id;
  
  -- Get current total votes for post
  SELECT votes INTO current_votes FROM "Posts" WHERE id = p_post_id;
  
  -- Set default value if null
  IF current_votes IS NULL THEN
    current_votes := 0;
  END IF;
  
  -- Handle vote logic
  IF existing_vote IS NULL THEN
    -- No previous vote, add new vote
    INSERT INTO "UserVotes" (user_id, post_id, vote_value)
    VALUES (p_user_id, p_post_id, p_vote_value);
    
    -- Update total
    new_votes := current_votes + p_vote_value;
  ELSIF existing_vote = p_vote_value THEN
    -- Same vote, remove it (toggle off)
    DELETE FROM "UserVotes" 
    WHERE user_id = p_user_id AND post_id = p_post_id;
    
    -- Update total
    new_votes := current_votes - p_vote_value;
  ELSE
    -- Different vote (switching from up to down or vice versa)
    UPDATE "UserVotes" 
    SET vote_value = p_vote_value
    WHERE user_id = p_user_id AND post_id = p_post_id;
    
    -- Update total (subtract old vote and add new vote)
    new_votes := current_votes - existing_vote + p_vote_value;
  END IF;
  
  -- Update post total
  UPDATE "Posts" SET votes = new_votes WHERE id = p_post_id;
  
  -- Return new vote count
  RETURN new_votes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- This will create a powerful server-side function to delete comments
CREATE OR REPLACE FUNCTION delete_comment_with_replies(comment_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Delete all replies recursively
  WITH RECURSIVE comment_tree AS (
    SELECT id FROM "Comments" WHERE id = comment_id
    UNION ALL
    SELECT c.id FROM "Comments" c
    JOIN comment_tree ct ON c.parent_id = ct.id
  )
  DELETE FROM "Comments" WHERE id IN (SELECT id FROM comment_tree);
  
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
    `;
    
    navigator.clipboard.writeText(schemaText)
      .then(() => {
        toast.showToast('SQL schema copied to clipboard!', 'success');
      })
      .catch((err) => {
        console.error('Could not copy schema:', err);
        toast.showToast('Failed to copy schema', 'error');
      });
  };

  const confirmDeletePost = (postId: string) => {
    setPostToDelete(postId);
    setShowDeletePostModal(true);
  };

  const cancelDeletePost = () => {
    setPostToDelete(null);
    setShowDeletePostModal(false);
  };

  const deletePost = async (postId: string) => {
    try {
      // First attempt: Use our improved SQL function
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session?.user?.id) {
          return { success: false, message: 'Not authenticated' };
        }
        
        const userId = session.session.user.id;
        
        // Call our improved SQL function
        const { data, error } = await supabase.rpc('delete_post_completely', {
          post_id: postId,
          user_id: userId
        });
        
        if (!error) {
          if (data === true) {
            return { success: true };
          } else {
            return { success: false, message: 'Permission denied or post not found' };
          }
        }
        
        // If our function call fails, try the fallback methods
        console.log('delete_post_completely error, trying fallback:', error);
      } catch (sqlErr) {
        console.log('delete_post_completely error, trying fallback:', sqlErr);
      }
      
      // Second attempt: Try the older RPC function
      try {
        const { data, error } = await supabase.rpc('delete_post_with_comments', {
          post_id: postId
        });
        
        if (!error) {
          return { success: true };
        }
        
        console.log('delete_post_with_comments not available, trying manual deletion');
      } catch (rpcErr) {
        console.log('RPC function error, falling back to manual deletion', rpcErr);
      }
      
      // Third attempt: Manual deletion as last resort
      // Delete all comments first
      const { error: commentsError } = await supabase
        .from('Comments')
        .delete()
        .eq('post_id', postId);
        
      if (commentsError) {
        console.error('Error deleting comments:', commentsError);
        return { success: false, message: `Error deleting comments: ${commentsError.message}` };
      }
      
      // Delete any user votes
      try {
        const { error: votesError } = await supabase
          .from('UserVotes')
          .delete()
          .eq('post_id', postId);
          
        if (votesError && votesError.code !== '42P01') { // Ignore error if table doesn't exist
          console.error('Error deleting votes:', votesError);
        }
      } catch (votesErr) {
        // Ignore errors with votes
        console.log('Error deleting votes (non-critical):', votesErr);
      }
      
      // Finally delete the post
      const { error } = await supabase
        .from('Posts')
        .delete()
        .eq('id', postId);
        
      if (error) {
        console.error('Error deleting post:', error);
        return { success: false, message: `Error deleting post: ${error.message}` };
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting post:', error);
      return { success: false, message: error.message || 'Unknown error' };
    }
  };

  const proceedWithDeletePost = async () => {
    if (!postToDelete) return;
    
    try {
      setDeletingPostId(postToDelete);
      
      // Get the post before deleting it
      const postToRemove = posts.find(p => p.id === postToDelete);
      
      if (!postToRemove) {
        setDeletingPostId(null);
        setPostToDelete(null);
        setShowDeletePostModal(false);
        return;
      }
      
      // Close the modal
      setPostToDelete(null);
      setShowDeletePostModal(false);
      
      // Delete from database - don't update UI until we know it worked
      const result = await deletePost(postToDelete);
      
      if (!result.success) {
        toast.showToast(`Failed to delete post: ${result.message || 'Unknown error'}`, 'error');
      } else {
        // Only remove the post from UI if deletion was successful
        setPosts(posts.filter(p => p.id !== postToDelete));
        toast.showToast('Post deleted successfully', 'success');
        
        // Force a re-fetch if needed to ensure our state is in sync with the database
        fetchPosts();
      }
    } catch (err: any) {
      console.error('Error in proceedWithDeletePost:', err);
      toast.showToast('An unexpected error occurred', 'error');
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleCreatePost = async () => {
    if (!user) {
      toast.showToast('You must be logged in to create a post', 'info');
      return;
    }
    
    if (!newPostTitle.trim()) {
      toast.showToast('Post title is required', 'error');
      return;
    }
    
    try {
      setCreatingPost(true);
      
      // Generate a slug from the title
      const slug = newPostTitle.toLowerCase()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '-')
        .substring(0, 60);

      let image_url = null;
      
      // Upload image if one is selected
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `post-images/${fileName}`;
        
        // Upload the image to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('image_url')
          .upload(filePath, selectedImage);
          
        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          toast.showToast(`Error uploading image: ${uploadError.message}`, 'error');
          return;
        }
        
        // Get the public URL for the uploaded image
        const { data: { publicUrl } } = supabase.storage
          .from('image_url')
          .getPublicUrl(filePath);
          
        image_url = publicUrl;
      }
      
      // Create the new post
      const { data, error } = await supabase
        .from('Posts')
        .insert([
          {
            title: newPostTitle.trim(),
            content: newPostContent.trim(),
            user_id: user.id,
            slug: `${slug}-${Date.now().toString().substring(9)}`,
            votes: 0,
            image_url
          }
        ])
        .select();
      
      if (error) {
        throw error;
      }
      
      // Clear form
      setNewPostTitle('');
      setNewPostContent('');
      setSelectedImage(null);
      setImagePreview(null);
      
      // Show success message
      toast.showToast('Post created successfully!', 'success');
      
      // Refresh the posts list
      fetchPosts();
      
    } catch (err: any) {
      console.error('Error creating post:', err);
      toast.showToast(`Error creating post: ${err.message}`, 'error');
    } finally {
      setCreatingPost(false);
    }
  };

  const handleEditPost = (post: Post) => {
    setEditingPostId(post.id);
    setEditPostTitle(post.title);
    setEditPostContent(post.content);
  };

  const cancelEditPost = () => {
    setEditingPostId(null);
    setEditPostTitle('');
    setEditPostContent('');
  };

  const updatePost = async () => {
    if (!user || !editingPostId) {
      toast.showToast('You must be logged in to update a post', 'info');
      return;
    }
    
    if (!editPostTitle.trim()) {
      toast.showToast('Post title is required', 'error');
      return;
    }
    
    try {
      setUpdatingPost(true);
      
      // Update the post
      const { data, error } = await supabase
        .from('Posts')
        .update({
          title: editPostTitle.trim(),
          content: editPostContent.trim()
        })
        .eq('id', editingPostId)
        .select();
      
      if (error) {
        throw error;
      }
      
      // Update the post in local state
      setPosts(prev => prev.map(post => 
        post.id === editingPostId 
          ? { ...post, title: editPostTitle.trim(), content: editPostContent.trim() } 
          : post
      ));
      
      // Reset edit state
      setEditingPostId(null);
      setEditPostTitle('');
      setEditPostContent('');
      
      // Show success message
      toast.showToast('Post updated successfully!', 'success');
      
    } catch (err: any) {
      console.error('Error updating post:', err);
      toast.showToast(`Error updating post: ${err.message}`, 'error');
    } finally {
      setUpdatingPost(false);
    }
  };

  // Function to check if the current user is the post author
  const isPostAuthor = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    return post?.user_id === user?.id;
  };

  // Handle search with optional event and term parameter
  const handleSearch = async (e?: React.FormEvent<HTMLFormElement>, searchTerm?: string) => {
    try {
      // Prevent form submission if event is provided
      if (e) e.preventDefault();
      
      // Get the search term from the event or from the passed parameter
      const term = searchTerm || (e?.currentTarget?.elements?.namedItem('search') as HTMLInputElement)?.value || searchQuery;
      console.log('Searching for term:', term);
      
      if (!term.trim()) {
        console.log('Empty search term, showing all posts');
        // If search is cleared, show all posts
        setSearchQuery('');
        const url = new URL(window.location.href);
        url.searchParams.delete('search');
        window.history.pushState({}, '', url);
        fetchPosts();
        return;
      }
      
      // Update search query state and URL
      setSearchQuery(term);
      
      // Set loading state
      const showLoadingTimeout = setTimeout(() => {
        setLoading(true);
      }, 300); // Only show loading after 300ms for better UX on fast searches
      
      setIsSearching(true);
      
      // Update URL with search parameter
      const url = new URL(window.location.href);
      url.searchParams.set('search', term);
      window.history.pushState({}, '', url);
      
      console.log('Calling searchPosts with term:', term);
      const { posts: searchResults, error } = await searchPosts(term);
      
      // Clear loading timeout if search is fast
      clearTimeout(showLoadingTimeout);
      
      console.log(`Search returned ${searchResults?.length || 0} results`, searchResults);
      
      if (error) {
        console.error('Search error:', error);
        toast.showToast(`Error searching posts: ${error}`, 'error');
        setIsSearching(false);
        setLoading(false);
        return;
      }
      
      // Process the search results
      const typedPosts: Post[] = searchResults.map(post => {
        // Create a typed post with proper fields
        return {
          ...post,
          image_url: post.image_url || undefined
        };
      });
      
      console.log('Setting posts state with search results:', typedPosts);
      
      // Update posts state with search results
      setPosts(typedPosts);
      
      if (searchResults.length === 0 && term.trim()) {
        toast.showToast('No posts found matching your search', 'info');
      }
    } catch (err: any) {
      console.error('Error in search:', err);
      toast.showToast('An unexpected error occurred during search', 'error');
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  };

  // Function to clear search and reset to all posts
  const clearSearch = () => {
    console.log('Clearing search and resetting to all posts');
    setSearchQuery('');
    
    // Update URL to remove search parameter
    const url = new URL(window.location.href);
    url.searchParams.delete('search');
    window.history.pushState({}, '', url);
    
    // Fetch all posts again
    fetchPosts();
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setSelectedImage(file);
      // Create a preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <main>
        <SafeDiv className="max-w-4xl mx-auto px-4 pt-16 pb-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center mt-20">
              <h1 className="text-xl font-bold mb-2 sm:mb-0">
                {searchQuery ? `Search Results: "${searchQuery}"` : 'All Posts'}
              </h1>
              <div className="relative ml-0 sm:ml-4">
                <div className="inline-flex shadow-sm rounded-md">
                  <button 
                    onClick={() => setSortBy('votes')}
                    className={`px-3 py-2 text-sm font-medium flex items-center rounded-l-md ${
                      sortBy === 'votes' 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FaArrowUp className={`mr-1 ${sortBy === 'votes' ? 'text-white' : 'text-gray-500'}`} />
                    Top
                  </button>
                  <button
                    onClick={() => setSortBy('newest')}
                    className={`px-3 py-2 text-sm font-medium flex items-center ${
                      sortBy === 'newest' 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FaClock className="mr-2" />
                    New
                  </button>
                  <button
                    onClick={() => setSortBy('oldest')}
                    className={`px-3 py-2 text-sm font-medium flex items-center rounded-r-md ${
                      sortBy === 'oldest' 
                        ? 'bg-blue-500 text-white hover:bg-blue-600' 
                        : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <FaSortAmountDown className="mr-2" />
                    Old
                  </button>
                </div>
              </div>
            </div>
            
            {/* Search info and clear button - only shown when there's a search query */}
            {searchQuery && (
              <div className="w-full md:w-auto mt-4 md:mt-0">
                <div className="flex items-center text-sm text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
                  <span>
                    {isSearching ? (
                      <span className="flex items-center">
                        <div className="w-3 h-3 mr-2 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        Searching...
                      </span>
                    ) : (
                      <span>Showing results for "{searchQuery}" ({posts.length} found)</span>
                    )}
                  </span>
                  <button 
                    onClick={clearSearch}
                    className="ml-2 text-blue-500 hover:text-blue-700"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Show message when no search results found */}
          {searchQuery && posts.length === 0 && !loading && (
            <div className="bg-white rounded-lg shadow p-6 mb-6 text-center">
              <div className="text-gray-500 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-medium mb-2">No posts found</h3>
                <p>We couldn't find any posts matching "{searchQuery}"</p>
              </div>
              <button 
                onClick={clearSearch}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                View All Posts
              </button>
            </div>
          )}
          
          {/* Create Post Form */}
          {!searchQuery && user ? (
            <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center mb-4">
                  <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold mr-3 overflow-hidden">
                    {user.avatar ? (
                      <img 
                        src={user.avatar} 
                        alt={user.username || 'User'} 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user.username ? user.username.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="flex-1">
                    <span className="font-medium text-gray-800">{user.username || 'You'}</span>
                    <p className="text-xs text-gray-500">Post to everyone</p>
                  </div>
                </div>
                
                <div className="mb-3">
              <input
                type="text"
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder="Write a title..."
                    className="w-full px-0 py-2 text-lg font-medium placeholder-gray-400 border-0 border-b border-gray-200 focus:outline-none focus:border-blue-300 focus:ring-0"
              />
            </div>
                
                <div className="mb-4">
                  <textarea
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full px-0 py-2 border-0 focus:outline-none focus:ring-0 resize-none placeholder-gray-400 text-gray-700"
                    rows={4}
                  />
                </div>
                
                {/* Image Preview */}
                {imagePreview && (
                  <div className="mb-4 relative">
                    <div className="relative rounded-lg overflow-hidden border border-gray-200">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="w-full max-h-64 object-contain"
                      />
                      <button 
                        onClick={removeSelectedImage}
                        className="absolute top-2 right-2 p-1 bg-gray-800 bg-opacity-70 rounded-full text-white hover:bg-red-600"
                        title="Remove image"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-50 -mx-4 px-4 py-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex space-x-2">
                      {/* Replace the static button with a functional file input */}
                      <label className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer">
                        <input 
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="hidden"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                      </label>
                      <button className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" />
                        </svg>
                      </button>
        </div>
                    <button
                      onClick={handleCreatePost}
                      disabled={creatingPost || !newPostTitle.trim()}
                      className="px-6 py-2 bg-blue-500 text-white font-medium rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      {creatingPost ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Creating...
                        </>
                      ) : (
                        'Post'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : !searchQuery ? (
            <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <FaRegUser className="text-gray-500" />
                  </div>
                  <div 
                    className="flex-1 bg-gray-100 hover:bg-gray-200 transition-colors rounded-full py-3 px-4 cursor-pointer text-gray-500"
                    onClick={() => router.push('/login')}
                  >
                    What's on your mind?
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-4 flex justify-center">
                  <Link href="/login" className="px-5 py-2 bg-blue-500 hover:bg-blue-600 transition-colors text-white rounded-md font-medium">
                    Log In to Create a Post
                  </Link>
                </div>
              </div>
            </div>
          ) : null}

          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {/* Database setup warning - only show when not searching */}
          {!searchQuery && missingTables.length > 0 && (
            <div className="mb-6 p-6 bg-red-50 border-2 border-red-200 text-red-800 rounded-lg">
              <h3 className="text-xl font-bold mb-2">⚠️ Database Setup Required</h3>
              <p className="mb-2">
                The following database fields are missing: {missingTables.join(', ')}
              </p>
              <div className="mb-4 p-3 bg-white rounded-md">
                <pre className="text-gray-800 text-sm overflow-x-auto">

                </pre>
              </div>
              <p className="mb-3 font-medium">
                You need to run this SQL to enable voting and nested replies.
              </p>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={copySchemaToClipboard}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
                  Copy SQL Schema
                </button>
                <a 
                  href="https://supabase.com/dashboard" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" />
                  </svg>
                  Open Supabase Dashboard
                </a>
        </div>
            </div>
          )}
        
        {loading ? (
            <div className="flex justify-center my-12">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          ) : (
            <div className="space-y-4">
              {posts.map(post => (
                <div key={post.id} className="bg-white rounded-lg shadow">
                  {/* Vote sidebar */}
                  <div className="flex">
                    <div className="w-10 bg-gray-50 p-2 flex flex-col items-center rounded-l-lg">
                      <button 
                        className={`hover:bg-gray-200 rounded w-6 h-6 flex items-center justify-center ${
                          userVotes[post.id] === 1 ? 'text-orange-500' : ''
                        }`}
                        onClick={() => handleVote(post.id, 1)}
                      >
                        <FaArrowUp />
                      </button>
                      <div className={`text-xs font-bold my-1 ${
                        (post.votes || 0) > 0 ? 'text-orange-500' : 
                        (post.votes || 0) < 0 ? 'text-blue-500' : 
                        'text-gray-700'
                      }`}>
                        {post.votes || 0}
          </div>
            <button 
                        className={`hover:bg-gray-200 rounded w-6 h-6 flex items-center justify-center ${
                          userVotes[post.id] === -1 ? 'text-blue-500' : ''
                        }`}
                        onClick={() => handleVote(post.id, -1)}
                      >
                        <FaArrowDown />
            </button>
          </div>
                    
                    {/* Main content */}
                    <div className="flex-1 p-3">
                      {/* Post header */}
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center mr-1 overflow-hidden">
                          {post.avatar ? (
                            <img 
                              src={post.avatar} 
                              alt={post.username || 'User'} 
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FaRegUser className="text-gray-500" size={10} />
                          )}
                      </div>
                        <span className="mr-1">Posted by u/<span className="font-medium text-gray-700">{post.username || 'anonymous'}</span></span>
                        <span className="text-gray-400">
                          <TimeAgo date={post.created_at} formatter={timeAgoFormatter} />
                        </span>
                      </div>
                      
                      {/* Post title & content */}
                      {editingPostId === post.id ? (
                        <div className="mb-4 bg-gray-50 p-3 rounded-md">
                          <div className="mb-3">
                            <label htmlFor="edit-title" className="block text-xs font-medium text-gray-500 mb-1">Title</label>
                            <input
                              id="edit-title"
                              type="text"
                              value={editPostTitle}
                              onChange={(e) => setEditPostTitle(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                    </div>
                          <div className="mb-3">
                            <label htmlFor="edit-content" className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                            <textarea
                              id="edit-content"
                              value={editPostContent}
                              onChange={(e) => setEditPostContent(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={4}
                            />
                          </div>
                          <div className="flex justify-end space-x-2">
                            <button 
                              onClick={cancelEditPost}
                              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                              disabled={updatingPost}
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={updatePost}
                              disabled={updatingPost || !editPostTitle.trim()}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                            >
                              {updatingPost ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></div>
                                  Saving...
                                </>
                              ) : (
                                'Save Changes'
                              )}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="text-lg font-medium mb-2">{post.title}</h2>
                          <div className="text-sm text-gray-800 mb-3 whitespace-pre-line">
                            {post.content}
                          </div>
                        </>
                      )}
                      
                      {/* Post image if any */}
                    {post.image_url && (
                        <div className="mb-3 flex justify-center">
                        <img 
                          src={post.image_url} 
                          alt={post.title} 
                            className="rounded-md shadow-sm object-contain max-w-full sm:max-w-[85%] md:max-w-[80%] max-h-64 sm:max-h-72 md:max-h-80 hover:shadow-md transition-shadow duration-200" 
                            loading="lazy"
                        />
                      </div>
                    )}
                  
                  {/* Post actions */}
                      <div className="flex text-gray-500 text-xs border-t border-gray-200 pt-2 mt-2">
                        <button 
                          className="flex items-center space-x-1 hover:bg-gray-100 p-1 rounded"
                          onClick={() => toggleExpandComments(post.id)}
                        >
                          <FaRegComment />
                          <span>{post.comment_count || 0} Comments</span>
                      </button>
                        
                        <button className="flex items-center space-x-1 ml-2 hover:bg-gray-100 p-1 rounded">
                          <FaShare />
                          <span>Share</span>
                        </button>
                        
                        {/* Post owner actions */}
                        {user && post.user_id === user.id && (
                          <>
                        <button
                              onClick={() => handleEditPost(post)}
                              className="flex items-center space-x-1 ml-2 hover:bg-gray-100 p-1 rounded text-blue-500"
                        >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span>Edit</span>
                        </button>
                            <button 
                              onClick={() => confirmDeletePost(post.id)}
                              className="flex items-center space-x-1 ml-2 hover:bg-gray-100 p-1 rounded text-red-500"
                            >
                              <FaTrash size={12} />
                              <span>Delete</span>
                            </button>
                          </>
                        )}
                        
                        <button className="flex items-center ml-2 hover:bg-gray-100 p-1 rounded">
                          <FaEllipsisH />
                        </button>
                  </div>
                  
                  {/* Comments section */}
                      {expandedComments[post.id] && (
                        <div className="mt-4 border-t border-gray-200 pt-4">
                          {missingTables.includes('Comments.parent_id') && (
                            <div className="mb-4 p-3 bg-yellow-50 text-yellow-800 rounded-md text-sm">
                              <div className="font-medium mb-1">Database update required</div>
                              <p className="mb-2">
                                Your Comments table needs to be updated to support replies.
                              </p>
                              <button
                                onClick={copySchemaToClipboard}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                              >
                                Copy SQL Schema
                              </button>
                            </div>
                          )}
                          
                          {/* Comment input */}
                          {user ? (
                            <div className="mb-4">
                              <textarea
                        value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs(prev => ({ ...prev, [post.id]: e.target.value }))}
                                placeholder="What are your thoughts?"
                                className="w-full p-3 text-sm border border-gray-300 rounded-md"
                                rows={3}
                              />
                              <div className="flex justify-end mt-2">
                      <button
                                  className={`text-xs text-white px-2 py-1 rounded ${
                                    !commentInputs[post.id]?.trim() 
                                      ? 'bg-blue-300 cursor-not-allowed' 
                                      : 'bg-blue-500 hover:bg-blue-600'
                                  }`}
                                  disabled={!commentInputs[post.id]?.trim()}
                                  onClick={() => handleAddComment(post.id, commentInputs[post.id] || '')}
                      >
                                  Comment
                      </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-md p-3 mb-4 text-center">
                              <p className="text-sm text-gray-600">
                                Log in or sign up to leave a comment
                              </p>
                              <div className="mt-2 space-x-3">
                                <Link href="/login" className="text-sm text-blue-500 font-medium">Log In</Link>
                                <Link href="/signup" className="text-sm text-blue-500 font-medium">Sign Up</Link>
                              </div>
                            </div>
                          )}
                    
                    {/* Comments list */}
                          {comments[post.id] && comments[post.id].length > 0 ? (
                            <div>
                              {renderComments(comments[post.id], post.id)}
                          </div>
                          ) : (
                            <div className="text-center p-4 text-gray-500 text-sm">
                              No comments yet. Be the first to share what you think!
                            </div>
                          )}
                        </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
          )}
        </SafeDiv>
      </main>
      
      {/* Delete Comment Confirmation Modal */}
      {showDeleteModal && commentToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Delete Comment</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this comment? This action cannot be undone.
              {user && posts.find(p => p.id === commentToDelete.postId)?.user_id === user.id && 
                " As the post author, you can delete any comments on your post."}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeleteComment}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={deletingCommentId !== null}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 flex items-center"
                disabled={deletingCommentId !== null}
              >
                {deletingCommentId === commentToDelete.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
                  </div>
                </div>
          </div>
        )}
   
      {/* Delete Post Confirmation Modal */}
      {showDeletePostModal && postToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Delete Post</h3>
            <p className="mb-6 text-gray-600">
              Are you sure you want to delete this post? This action cannot be undone and will delete the post along with all comments.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDeletePost}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                disabled={deletingPostId !== null}
              >
                Cancel
              </button>
              <button
                onClick={proceedWithDeletePost}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-md hover:bg-red-600 flex items-center"
                disabled={deletingPostId !== null}
              >
                {deletingPostId === postToDelete ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RedditPosts;