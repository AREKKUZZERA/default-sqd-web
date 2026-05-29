// Release builds use Supabase as the single source of truth.
// This file is kept only for backwards-compatible imports; it intentionally contains no mock users, posts or messages.

export const currentUser = null;
export const people = [];
export const stories = [{ name: 'Все', author: 'all' }];
export const initialPosts = [];
export const conversations = [];
export const initialMessages = {};
