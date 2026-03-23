import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prescription, orientations, observations, patient_name, clinical_data } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Você é um assistente médico especializado em podologia. Sua tarefa é analisar uma receita/prescrição e verificar possíveis contraindicações, alergias ou efeitos colaterais considerando o histórico clínico do paciente.

Responda SEMPRE em JSON com a estrutura:
{"safe": boolean, "warnings": ["lista de alertas se houver"]}

Se não houver riscos identificáveis, retorne {"safe": true, "warnings": []}.
Se houver riscos, retorne {"safe": false, "warnings": ["descrição do risco 1", "descrição do risco 2"]}.

Seja conciso e objetivo nos alertas.`;

    const userPrompt = `Paciente: ${patient_name}

Dados clínicos do paciente:
- Queixa principal: ${clinical_data?.chief_complaint || "Não informado"}
- Notas clínicas: ${clinical_data?.clinical_notes || "Não informado"}
- Diagnóstico: ${clinical_data?.diagnosis || "Não informado"}
- Tratamento realizado: ${clinical_data?.treatment_performed || "Não informado"}
- Recomendações anteriores: ${clinical_data?.recommendations || "Não informado"}

Prescrição a verificar:
${prescription || "(vazio)"}

Orientações:
${orientations || "(vazio)"}

Observações:
${observations || "(vazio)"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "safety_check_result",
            description: "Return safety check results",
            parameters: {
              type: "object",
              properties: {
                safe: { type: "boolean" },
                warnings: { type: "array", items: { type: "string" } },
              },
              required: ["safe", "warnings"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "safety_check_result" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ safe: true, warnings: ["Verificação temporariamente indisponível (limite de requisições)."] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ safe: true, warnings: ["Verificação indisponível (créditos insuficientes)."] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI error:", response.status, await response.text());
      return new Response(JSON.stringify({ safe: true, warnings: ["Não foi possível realizar a verificação de segurança."] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ safe: true, warnings: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ safe: true, warnings: ["Erro na verificação: " + (e instanceof Error ? e.message : "desconhecido")] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
