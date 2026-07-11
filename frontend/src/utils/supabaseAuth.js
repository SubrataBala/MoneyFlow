import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase is not configured. Please check REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in your environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Initiates the Google OAuth flow using the Supabase client.
 * This is more robust than constructing the URL manually.
 */
export const startAdminGoogleLogin = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // Keep the OAuth return separate from the regular owner/admin login
      // page. This prevents the owner form from flashing while the Google
      // session is exchanged for this application's admin session.
      redirectTo: new URL('/auth/callback', window.location.origin).toString(),
    },
  });

  if (error) {
    console.error('Error starting Google login:', error);
    throw new Error('Could not initiate Google login. Please try again.');
  }
};

export const getSupabaseAccessTokenFromUrl = () => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  return hashParams.get('access_token');
};

export const clearSupabaseAuthHash = () => {
  if (window.location.hash) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
};

export default supabase;
