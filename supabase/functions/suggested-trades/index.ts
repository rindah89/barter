import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

console.log('Suggest Trades function booting up...');

// Define the type for the expected result structure based on the SQL query
interface SuggestedTrade {
  user_a_id: string;
  user_a_name: string | null;
  user_a_avatar: string | null;
  item_a_id: string;
  item_a_name: string;
  item_a_image: string | null;
  user_b_id: string;
  user_b_name: string | null;
  user_b_avatar: string | null;
  item_b_id: string;
  item_b_name: string;
  item_b_image: string | null;
  user_c_id: string;
  user_c_name: string | null;
  user_c_avatar: string | null;
  item_c_id: string;
  item_c_name: string;
  item_c_image: string | null;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the current user's ID from the request, assuming it's passed somehow
    // TODO: Determine how the user ID is passed (e.g., auth header, query param)
    // For now, let's assume it comes from the authenticated user session
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
        console.error('User not found');
      return new Response(JSON.stringify({ error: 'User not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const current_user_id = user.id;
    console.log(`Fetching suggestions for user: ${current_user_id} via RPC call to find_3_way_trades`);

    // No need for the large SQL query string here anymore
    // const sqlQuery = ` ... complex SQL ... `;

    // Call the database function via RPC
    const { data: suggestedTrades, error } = await supabaseClient.rpc(
        'find_3_way_trades', 
        { current_user_id: current_user_id } // Pass the user ID as a parameter
    );

    // Remove the previous .sql() call
    // const { data: suggestedTrades, error } = await supabaseClient.sql<SuggestedTrade>(sqlQuery, current_user_id);

    if (error) {
      console.error('Error calling RPC function find_3_way_trades:', error);
      throw error;
    }

    console.log(`Found ${suggestedTrades?.length || 0} suggested trades.`);

    // Return the results
    return new Response(JSON.stringify(suggestedTrades || []), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (e) {
    console.error('Error in function:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}); 