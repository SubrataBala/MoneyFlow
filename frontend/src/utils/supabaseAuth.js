const getSupabaseUrl = () => {
  const url = process.env.REACT_APP_SUPABASE_URL;
  if (!url) {
    throw new Error('REACT_APP_SUPABASE_URL is not configured.');
  }
  return url.replace(/\/$/, '');
};

export const startAdminGoogleLogin = () => {
  const redirectTo = `${window.location.origin}/login`;
  const params = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
  });
  window.location.href = `${getSupabaseUrl()}/auth/v1/authorize?${params.toString()}`;
};

export const getSupabaseAccessTokenFromUrl = () => {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return hashParams.get('access_token');
};

export const clearSupabaseAuthHash = () => {
  if (window.location.hash) {
    window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  }
};
