import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-secret',
};

const ALLOWED_TABLES = [
  'whatsapp_conversations',
  'whatsapp_messages',
  'whatsapp_inboxes',
  'clients',
  'appointments',
  'leads',
  'stock_items',
  'financial_transactions',
  'telegram_bots',
  'telegram_notifications',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate secret
    const apiSecret = req.headers.get('x-api-secret');
    const expectedSecret = Deno.env.get('N8N_API_SECRET');

    if (!expectedSecret || apiSecret !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let table: string | null = null;
    let filters: Record<string, string> | null = null;
    let select: string | null = null;
    let limit: number | null = null;
    let order: string | null = null;
    let ascending = true;
    let dateFrom: string | null = null;
    let dateTo: string | null = null;
    let dateColumn: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      table = url.searchParams.get('table');
      select = url.searchParams.get('select');
      limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : null;
      order = url.searchParams.get('order');
      ascending = url.searchParams.get('ascending') !== 'false';
      dateFrom = url.searchParams.get('date_from');
      dateTo = url.searchParams.get('date_to');
      dateColumn = url.searchParams.get('date_column');

      // Build filters from query params (exclude reserved keys)
      const reserved = ['table', 'select', 'limit', 'order', 'ascending', 'date_from', 'date_to', 'date_column'];
      filters = {};
      for (const [key, value] of url.searchParams.entries()) {
        if (!reserved.includes(key)) {
          filters[key] = value;
        }
      }
      if (Object.keys(filters).length === 0) filters = null;
    } else if (req.method === 'POST') {
      const body = await req.json();
      table = body.table;
      filters = body.filters;
      select = body.select;
      limit = body.limit;
      order = body.order;
      ascending = body.ascending !== false;
      dateFrom = body.date_from || null;
      dateTo = body.date_to || null;
      dateColumn = body.date_column || null;
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!table || !ALLOWED_TABLES.includes(table)) {
      return new Response(
        JSON.stringify({ error: `Table not allowed. Allowed: ${ALLOWED_TABLES.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let query = supabase.from(table).select(select || '*');

    if (filters && typeof filters === 'object') {
      for (const [key, value] of Object.entries(filters)) {
        query = query.eq(key, value);
      }
    }

    // Date range filtering
    const col = dateColumn || 'date';
    if (dateFrom) {
      query = query.gte(col, dateFrom);
    }
    if (dateTo) {
      query = query.lte(col, dateTo);
    }

    if (order) {
      query = query.order(order, { ascending });
    }

    if (limit) {
      query = query.limit(Number(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Query error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data, count: data?.length || 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});