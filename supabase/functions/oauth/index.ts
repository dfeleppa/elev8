import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { platform, code } = await req.json();

    // OAuth configuration
    const config = {
      google: {
        tokenUrl: 'https://oauth2.googleapis.com/token',
        clientId: Deno.env.get('GOOGLE_CLIENT_ID'),
        clientSecret: Deno.env.get('GOOGLE_CLIENT_SECRET'),
        scope: 'https://www.googleapis.com/auth/business.manage',
      },
      instagram: {
        tokenUrl: 'https://api.instagram.com/oauth/access_token',
        clientId: Deno.env.get('INSTAGRAM_CLIENT_ID'),
        clientSecret: Deno.env.get('INSTAGRAM_CLIENT_SECRET'),
        scope: 'basic',
      },
      facebook: {
        tokenUrl: 'https://graph.facebook.com/v12.0/oauth/access_token',
        clientId: Deno.env.get('FACEBOOK_CLIENT_ID'),
        clientSecret: Deno.env.get('FACEBOOK_CLIENT_SECRET'),
        scope: 'pages_show_list,pages_read_engagement,pages_manage_posts',
      },
    };

    const platformConfig = config[platform];
    if (!platformConfig) {
      throw new Error('Invalid platform');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch(platformConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: platformConfig.clientId,
        client_secret: platformConfig.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: `${Deno.env.get('APP_URL')}/oauth/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();

    // Store the tokens in Supabase
    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: (await supabase.auth.getUser()).data.user.id,
        platform,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      });

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});