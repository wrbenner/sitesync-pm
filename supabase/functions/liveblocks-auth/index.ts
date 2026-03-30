import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const liveblocksSecret = Deno.env.get('LIVEBLOCKS_SECRET_KEY')
    if (!liveblocksSecret) throw new Error('LIVEBLOCKS_SECRET_KEY not configured')

    // Verify Supabase auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } },
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { room } = await req.json()

    // Get Liveblocks token
    const response = await fetch('https://api.liveblocks.io/v2/rooms/' + room + '/authorize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${liveblocksSecret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: user.id,
        userInfo: {
          name: user.user_metadata?.full_name || user.email || 'Anonymous',
          avatar: user.user_metadata?.avatar_url || null,
          color: '#' + user.id.slice(0, 6),
        },
      }),
    })

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
