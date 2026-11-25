import type { APIRoute } from 'astro';
import { GoogleGenAI } from '@google/genai';
import { Resend } from 'resend';
import type { Message, LeadData } from '../../types/chat.ts';

export const prerender = false;

interface AIResponse {
  reply: string;
  isComplete: boolean;
  leadData: LeadData | null;
}

const SYSTEM_PROMPT = `
Sos el asistente virtual comercial de Fernando Sánchez, Desarrollador Full Stack especializado en sitios web modernos (Astro, React, Tailwind CSS) y automatización con IA.
Tu objetivo es conversar con potenciales clientes de forma amable, profesional y concisa (en español rioplatense neutro, sin exagerar) para calificar su proyecto.

Debés recopilar estos 5 datos haciendo preguntas naturales, DE A UNA O DOS POR VEZ (nunca mandes un cuestionario largo de golpe):
1. projectType: Qué quiere construir (landing page, tienda online, chatbot con IA, app web, etc.).
2. goal: Qué problema quiere resolver o qué objetivo busca.
3. timeline: Para cuándo lo necesita (plazo estimado).
4. budget: Presupuesto aproximado (si no sabe, aceptá "A definir").
5. contact: Nombre y un medio de contacto (email o WhatsApp).

REGLAS DE RESPUESTA:
- Respondé SIEMPRE con un objeto JSON válido con esta estructura exacta:
{
  "reply": "Tu mensaje conversacional para el cliente",
  "isComplete": false,
  "leadData": null
}
- Solo cambiá "isComplete" a true cuando ya tengas los 5 datos confirmados. En ese caso, completá "leadData" con:
{
  "projectType": "...",
  "goal": "...",
  "timeline": "...",
  "budget": "...",
  "contact": "...",
  "priority": "alta" | "media" | "baja"
}
- Criterio de prioridad: "alta" si tiene necesidad clara y plazo próximo o presupuesto definido; "media" si está explorando con interés real; "baja" si es solo curiosidad o sin definición.
- Cuando "isComplete" sea true, en "reply" agradecé, confirmá que ya le enviaste el resumen a Fernando y decile que se va a contactar a la brevedad.
`;

async function sendLeadEmail(lead: LeadData) {
  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const toEmail = import.meta.env.CONTACT_EMAIL;

  await resend.emails.send({
    from: 'Asistente IA <onboarding@resend.dev>',
    to: toEmail,
    subject: `[Prioridad ${lead.priority.toUpperCase()}] Nuevo lead: ${lead.projectType}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #18181b;">
        <h2 style="color: #059669;">Nuevo proyecto calificado por tu Asistente IA</h2>
        <p><strong>Prioridad:</strong> ${lead.priority.toUpperCase()}</p>
        <hr style="border: 1px solid #e4e4e7;" />
        <p><strong>Tipo de proyecto:</strong> ${lead.projectType}</p>
        <p><strong>Objetivo / Problema:</strong> ${lead.goal}</p>
        <p><strong>Plazo estimado:</strong> ${lead.timeline}</p>
        <p><strong>Presupuesto:</strong> ${lead.budget}</p>
        <p><strong>Contacto:</strong> ${lead.contact}</p>
      </div>
    `,
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  contents: { role: string; parts: { text: string }[] }[],
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 400,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });
    } catch (err: any) {
      const status = err?.status;
      const isTransient = status === 503 || status === 429;

      if (!isTransient || attempt === maxRetries) {
        throw err;
      }

      // Espera 1s en el primer reintento, 2s en el segundo
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }
  throw new Error('No se pudo obtener respuesta de Gemini.');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const { messages } = (await request.json()) as { messages: Message[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No se recibieron mensajes.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY });

    const contents = messages.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const response = await generateWithRetry(ai, contents);

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Gemini devolvió una respuesta vacía.');
    }

    const parsed: AIResponse = JSON.parse(rawText);

    let emailSent = false;
    if (parsed.isComplete && parsed.leadData) {
      await sendLeadEmail(parsed.leadData);
      emailSent = true;
    }

    return new Response(
      JSON.stringify({
        reply: parsed.reply,
        isComplete: parsed.isComplete,
        leadData: parsed.leadData,
        emailSent,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en /api/chat:', error);
    return new Response(
      JSON.stringify({
        error:
          'El asistente está recibiendo muchas consultas en este momento. Probá mandar tu mensaje de nuevo.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};