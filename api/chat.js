export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { appId, message } = req.body || {};
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!message) return res.status(200).json({ reply: 'Message is required.' });
    if (!groqApiKey) return res.status(200).json({ reply: 'GROQ_API_KEY is missing in Vercel Environment Variables.' });

    const cleanKey = groqApiKey.trim();

    // 1. Supabase Knowledge Base Fetch
    let knowledgeContext = "No specific knowledge base uploaded yet.";
    if (supabaseUrl && supabaseKey) {
      try {
        const supaRes = await fetch(
          `${supabaseUrl}/rest/v1/knowledge_base?app_id=eq.${appId}&select=title,content`,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': 'application/json'
            }
          }
        );
        if (supaRes.ok) {
          const docs = await supaRes.json();
          if (Array.isArray(docs) && docs.length > 0) {
            knowledgeContext = docs.map(d => `Title: ${d.title}\nContent: ${d.content}`).join("\n\n");
          }
        }
      } catch (e) {
        console.error("Supabase fetch error:", e);
      }
    }

    const systemPrompt = `You are HelpPilot AI, a customer support assistant. Answer concisely based ONLY on this context:\n\n=== KNOWLEDGE BASE ===\n${knowledgeContext}\n======================\n\nQuestion: "${message}"`;

    // 2. SMART AUTO-DISCOVERY: Strictly filter ONLY text chat models (exclude audio/whisper/vision)
    let targetModel = 'llama-3.3-70b-versatile'; // Standard fallback
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${cleanKey}` }
      });
      const modelsData = await modelsRes.json();
      
      if (modelsData.data && Array.isArray(modelsData.data)) {
        // Filter out whisper, audio, vision, guard, embedding models
        const textModels = modelsData.data.filter(m => {
          const id = m.id.toLowerCase();
          return (id.includes('llama') || id.includes('mixtral') || id.includes('gemma')) &&
                 !id.includes('whisper') && 
                 !id.includes('guard') && 
                 !id.includes('embed');
        });

        if (textModels.length > 0) {
          // Prefer Llama 3.3 or Llama 3.1 text models
          const preferredModel = textModels.find(m => m.id.includes('llama-3.3') || m.id.includes('llama-3.1'));
          targetModel = preferredModel ? preferredModel.id : textModels[0].id;
        }
      }
    } catch (e) {
      console.error("Auto-discovery text filter failed:", e);
    }

    // 3. Ultra-Fast Chat Completion
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cleanKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.2
      })
    });

    const data = await groqRes.json();

    if (data.error) {
      return res.status(200).json({ reply: `Groq Error: ${data.error.message}` });
    }

    const replyText = data.choices?.[0]?.message?.content;
    return res.status(200).json({ reply: replyText || 'No response generated.' });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
