import { kv } from "@vercel/kv";
import { Ratelimit } from "@upstash/ratelimit";

// Fonction pour appeler l'API Coze
async function callCozeAPI(messages: any) {
  const token = process.env.COZE_API_TOKEN; // Utilise la variable d'environnement

  const response = await fetch('https://api.coze.com/open_api/v2/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      conversation_id: "123", // Remplacez par l'ID de votre conversation
      bot_id: "73649188512364313445", // Remplacez par l'ID de votre bot, en tant que chaîne de caractères
      user: "290322018062355", // Remplacez par l'ID de votre utilisateur
      query: messages[messages.length - 1].content, // Envoie le dernier message de la conversation
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Erreur API Coze: ${response.statusText}`);
  }

  return response.json();
}

export const runtime = "edge";

export async function POST(req: Request) {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  ) {
    const ip = req.headers.get("x-forwarded-for");
    const ratelimit = new Ratelimit({
      redis: kv,
      limiter: Ratelimit.slidingWindow(50, "1 d"),
    });

    const { success, limit, reset, remaining } = await ratelimit.limit(
      `chathn_ratelimit_${ip}`,
    );

    if (!success) {
      return new Response("You have reached your request limit for the day.", {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      });
    }
  }

  const { messages } = await req.json();

  // Appeler l'API Coze
  try {
    const cozeResponse = await callCozeAPI(messages);
    return new Response(JSON.stringify(cozeResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(`Erreur lors de l'appel à l'API Coze: ${error.message}`, {
      status: 500,
    });
  }
}