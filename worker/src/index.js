const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const SYSTEM_BASE =
  "You are the Prism research copilot, part of an agentic crypto research organisation. " +
  "You ground every answer in the live snapshot provided. You are research support, not a licensed " +
  "adviser. If the user asks for financial advice, say you only provide research support. " +
  "Answer in plain text, max 180 words.\n\n";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/chat") {
      return new Response("not found", { status: 404, headers: CORS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid json" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "server not configured" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const snapshot = (body.snapshot || "").slice(0, 4000);
    const question = (body.message || "").slice(0, 2000);

    try {
      const anthropic = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: env.MODEL || "claude-sonnet-4-5",
          max_tokens: 1024,
          system: SYSTEM_BASE + snapshot,
          messages: [{ role: "user", content: question }],
        }),
      });

      const data = await anthropic.json();
      if (!anthropic.ok) {
        return new Response(
          JSON.stringify({ error: (data.error && data.error.message) || "upstream error" }),
          { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
        );
      }
      const text = (data.content || [])
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      return new Response(JSON.stringify({ text }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
  },
};