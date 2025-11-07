import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Connecting to external PostgreSQL database...');

    const client = new Client({
      user: "bwqQCWau3ybME2RR",
      password: "6XHFzssSRgbjzIMUZat3i557497Zcr38",
      database: "kahbellos",
      hostname: "212.85.15.242",
      port: 5433,
    });

    await client.connect();
    console.log('Connected successfully');

    // Query para buscar clientes - ajuste o nome da tabela conforme necessário
    const result = await client.queryObject(`
      SELECT 
        nome,
        whatsapp,
        nome_wpp,
        email,
        "data-nasc"
      FROM clientes
      ORDER BY nome
    `);

    await client.end();

    console.log(`Found ${result.rows.length} clients`);

    return new Response(
      JSON.stringify(result.rows),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: 'Failed to fetch clients from external database'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
