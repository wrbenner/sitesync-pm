import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const integrationId = url.searchParams.get('integration_id')
    const event = url.searchParams.get('event') || 'unknown'

    if (!integrationId) {
      return new Response(JSON.stringify({ error: 'Missing integration_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Verify integration exists
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('id, type, status, config')
      .eq('id', integrationId)
      .single()

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (integration.status !== 'connected') {
      return new Response(JSON.stringify({ error: 'Integration is not active' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Parse webhook payload
    const payload = await req.json()

    // Log the webhook delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: integrationId,
      event,
      payload,
      response_status: 200,
    })

    // Process based on integration type
    switch (integration.type) {
      case 'procore_import':
        // TODO: Process Procore webhook (issue created, submittal updated, etc.)
        break
      case 'autodesk_bim360':
        // TODO: Process Autodesk webhook (model updated, issue created)
        break
      case 'zapier_webhook':
        // Generic webhook: store payload for manual processing or automation rules
        break
      default:
        break
    }

    // Update integration last sync
    await supabase.from('integrations').update({
      last_sync: new Date().toISOString(),
    }).eq('id', integrationId)

    return new Response(
      JSON.stringify({ received: true, event }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
