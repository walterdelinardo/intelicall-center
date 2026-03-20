import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { document_id, file_url, file_type, title } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const isImage = file_type === "image" || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file_url);

    let systemPrompt: string;
    let userContent: any[];

    if (isImage) {
      systemPrompt = `Você é um especialista médico em podologia e análise de imagens clínicas. Ao receber uma imagem médica (raio-X, foto clínica de pés, unhas, pele, etc.), forneça uma análise técnica e profissional detalhada incluindo:
- Descrição do que é observado na imagem
- Possíveis condições ou patologias identificadas
- Grau de severidade (se aplicável)
- Recomendações clínicas
Se a imagem não for médica, descreva o conteúdo de forma objetiva.
Responda sempre em português brasileiro.`;

      userContent = [
        { type: "text", text: `Analise esta imagem clínica. Título do documento: "${title}"` },
        { type: "image_url", url: file_url }
      ];
    } else {
      systemPrompt = `Você é um assistente especializado em análise de documentos médicos e clínicos na área de podologia. Ao receber informações sobre um documento:
- Se for uma declaração, receita ou documento administrativo: faça um resumo informativo explicando sobre o que trata
- Se for um laudo, exame ou relatório médico: faça uma análise técnica profissional
- Identifique informações importantes como datas, medicamentos, diagnósticos, recomendações
Responda sempre em português brasileiro.`;

      userContent = [
        { type: "text", text: `Analise este documento. Título: "${title}". URL do arquivo: ${file_url}. Por favor, forneça uma análise baseada no tipo de documento e seu título.` }
      ];
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise por IA." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("Erro ao comunicar com a IA");
    }

    const aiResult = await response.json();
    const analysis = aiResult.choices?.[0]?.message?.content || "Não foi possível gerar a análise.";

    // Update the document with the analysis
    if (document_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from("record_documents")
        .update({ ai_analysis: analysis, ai_analyzed_at: new Date().toISOString() })
        .eq("id", document_id);
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
