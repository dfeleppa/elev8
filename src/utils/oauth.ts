export const initiateOAuth = (platform: string) => {
  const config = {
    google: {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/business.manage',
    },
    instagram: {
      clientId: import.meta.env.VITE_INSTAGRAM_CLIENT_ID,
      scope: 'basic',
    },
    facebook: {
      clientId: import.meta.env.VITE_FACEBOOK_CLIENT_ID,
      scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
    },
  };

  const platformConfig = config[platform];
  if (!platformConfig) throw new Error('Invalid platform');

  const params = new URLSearchParams({
    client_id: platformConfig.clientId,
    redirect_uri: `${window.location.origin}/oauth/callback`,
    scope: platformConfig.scope,
    response_type: 'code',
    state: platform,
  });

  const url = platform === 'google'
    ? `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    : platform === 'instagram'
    ? `https://api.instagram.com/oauth/authorize?${params}`
    : `https://www.facebook.com/v12.0/dialog/oauth?${params}`;

  window.location.href = url;
};

export const handleOAuthCallback = async (code: string, state: string) => {
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ platform: state, code }),
  });

  if (!response.ok) {
    throw new Error('Failed to complete OAuth flow');
  }

  return response.json();
};