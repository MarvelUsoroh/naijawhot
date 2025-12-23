import { createClient } from "jsr:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseKey);

const YARNGPT_API_URL = "https://yarngpt.ai/api/v1/tts";

async function hashText(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const cleanupHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-region',
  // Cache preflight to reduce repeated OPTIONS overhead.
  // Browsers may cap this value.
  'Access-Control-Max-Age': '600',
  'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  'Content-Type': 'application/json'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cleanupHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405,
      headers: cleanupHeaders
    });
  }

  try {
    const { text, voice = "Idera" } = await req.json();
    const apiKey = Deno.env.get("YARNGPT_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "YarnGPT API Key not configured" }), { status: 500, headers: cleanupHeaders });
    }

    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), { status: 400, headers: cleanupHeaders });
    }

    // Generate filename
    const filename = `${await hashText(text + voice)}.mp3`;
    const bucket = "game-audio";

    // 1. Check cache (List to verify existence)
    const { data: existingFiles } = await supabase.storage.from(bucket).list("", {
      search: filename
    });

    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filename);

    if (existingFiles && existingFiles.length > 0) {
      console.log(`Cache hit for: "${text}"`);
      return new Response(JSON.stringify({ url: publicUrl, cached: true }), { headers: cleanupHeaders });
    }

    console.log(`Cache miss for: "${text}". Calling YarnGPT...`);

    // 2. Call API
    const response = await fetch(YARNGPT_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        voice,
        response_format: "mp3"
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("YarnGPT Error:", err);
      return new Response(JSON.stringify({ error: "Failed to generate audio", details: err }), { status: response.status, headers: cleanupHeaders });
    }

    const audioBlob = await response.blob();

    // 3. Upload
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filename, audioBlob, {
        contentType: 'audio/mpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error("Storage Error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to cache" }), { status: 500, headers: cleanupHeaders });
    }

    return new Response(JSON.stringify({ url: publicUrl, cached: false }), { headers: cleanupHeaders });

  } catch (err: any) {
    console.error("Handler Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cleanupHeaders });
  }
});
