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

    if (!message) return res.status(200).json({ reply: 'Please enter a message.' });
    if (!groqApiKey) return res.status(200).json({ reply: 'Error: GROQ_API_KEY is missing in Vercel settings.' });

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

    // 2. Fetch live models directly from Groq API for this specific key
    let candidateModels = [];
    try {
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${cleanKey}` }
      });
      const modelsData = await modelsRes.json();
      if (modelsData && Array.isArray(modelsData.data)) {
        candidateModels = modelsData.data
          .map(m => m.id)
          .filter(id => {
            const lower = id.toLowerCase();
            return !lower.includes('whisper') && 
                   !lower.includes('embed') && 
                   !lower.includes('audio') &&
                   !lower.includes('guard');
          });
      }
    } catch (e) {
      console.error("Model fetch error:", e);
    }

    // Add standard backups just in case API list is restricted
    candidateModels.push('llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768');
    candidateModels = Array.from(new Set(candidateModels));

    let replyText = null;
    let lastErrorMsg = '';

    // 3. Loop through available models until one successfully responds
    for (const modelName of candidateModels) {
      try {
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: message }
            ],
            temperature: 0.2
          })
        });

        const data = await groqRes.json();

        if (data.choices?.[0]?.message?.content) {
          replyText = data.choices[0].message.content;
          break; // Success! Found the working model.
        } else if (data.error) {
          lastErrorMsg = data.error.message;
        }
      } catch (err) {
        lastErrorMsg = err.message;
      }
    }

    if (replyText) {
      return res.status(200).json({ reply: replyText });
    }

    return res.status(200).json({ reply: `Groq API Error: ${lastErrorMsg || 'All models failed.'}` });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
