import { kv } from "@vercel/kv";

function generateUniqueId(ip: string): string {
  return Buffer.from(ip).toString('base64');
}

async function callCozeAPI(messages: any) {
  const token = "pat_GAdDwAiisG2p3PT5tfaxEX8LrV7oqMpKVsmpOQJ9nCuJwCxBlUQw8Vf7NSiuRiI9";
  const botId = "7371913283235971077";
  const userId = "290322018062355";

  const response = await fetch('https://api.coze.com/open_api/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      conversation_id: "123",
      bot_id: botId,
      user: userId,
      query: messages[messages.length - 1].content,
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur API: ${response.statusText}`);
  }

  return response.json();
}

export const runtime = "edge";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userId = generateUniqueId(ip);

  const { messages } = await req.json();

  try {
    // Enregistrer la conversation dans la base de données
    await kv.set(`conversation_${userId}`, messages);

    const cozeResponse = await callCozeAPI(messages);
    
    const answerMessage = cozeResponse.messages.find((message: any) => 
      message.role === 'assistant' && message.type === 'answer'
    );

    const content = answerMessage ? answerMessage.content : "No relevant answer found";

    // Ajouter la réponse de l'API à la conversation
    messages.push({ role: 'assistant', content });

    // Mettre à jour la conversation dans la base de données
    await kv.set(`conversation_${userId}`, messages);

    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  } catch (error) {
    const errorMessage = (error as Error).message || "Unknown error";
    return new Response(`Erreur lors de l'appel à l'API: ${errorMessage}`, {
      status: 500,
    });
  }
}

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const userId = generateUniqueId(ip);

  try {
    // Récupérer la conversation depuis la base de données
    const messages = await kv.get(`conversation_${userId}`);

    return new Response(JSON.stringify(messages), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = (error as Error).message || "Unknown error";
    return new Response(`Erreur lors de la récupération de la conversation: ${errorMessage}`, {
      status: 500,
    });
  }
}