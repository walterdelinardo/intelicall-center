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

    // Primeiro, listar todas as tabelas disponíveis
    const tablesResult = await client.queryObject(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('Available tables:', JSON.stringify(tablesResult.rows));

    // Tentar buscar de várias possíveis tabelas
    const possibleTableNames = ['clientes', 'cliente', 'customers', 'users', 'contatos'];
    let result = null;
    let usedTable = null;

    for (const tableName of possibleTableNames) {
      try {
        result = await client.queryObject(`
          SELECT 
            nome,
            whatsapp,
            nome_wpp,
            email,
            "data-nasc"
          FROM ${tableName}
          ORDER BY nome
          LIMIT 1
        `);
        usedTable = tableName;
        console.log(`Found table: ${tableName}`);
        break;
      } catch (e) {
        console.log(`Table ${tableName} not found, trying next...`);
      }
    }

    if (!result || !usedTable) {
      await client.end();
      return new Response(
        JSON.stringify({ 
          error: 'Client table not found',
          availableTables: tablesResult.rows,
          message: 'Por favor, informe o nome correto da tabela de clientes'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Buscar todos os registros da tabela encontrada
    const allClients = await client.queryObject(`
      SELECT 
        nome,
        whatsapp,
        nome_wpp,
        email,
        "data-nasc"
      FROM ${usedTable}
      ORDER BY nome
    `);

    await client.end();

    console.log(`Found ${allClients.rows.length} clients in table ${usedTable}`);

    return new Response(
      JSON.stringify(allClients.rows),
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
