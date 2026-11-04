export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body || {};
    if (!message) return res.status(200).json({ reply: 'Please enter a message.' });

    const lowerMsg = message.toLowerCase();
    
    // Phase 3: Sentiment & Escalation Detection
    let sentiment = 'neutral';
    let escalated = false;

    if (lowerMsg.includes('worst') || lowerMsg.includes('useless') || lowerMsg.includes('scam') || lowerMsg.includes('angry') || lowerMsg.includes('refund') || lowerMsg.includes('legal')) {
      sentiment = 'frustrated';
      escalated = true;
    }

    let replyText = "Hello! I am HelpPilot AI. How can I help you today?";
    
    if (lowerMsg.includes('refund') || lowerMsg.includes('policy') || lowerMsg.includes('money')) {
      replyText = "We offer a full 14-day money-back guarantee for all subscription plans. No questions asked.";
    } else if (lowerMsg.includes('pricing') || lowerMsg.includes('price') || lowerMsg.includes('plan')) {
      replyText = "HelpPilot AI offers a free plan up to 100 queries, with premium tiers starting at affordable monthly rates.";
    } else if (lowerMsg.includes('embed') || lowerMsg.includes('widget') || lowerMsg.includes('website')) {
      replyText = "To embed HelpPilot AI, simply copy the widget HTML snippet and paste it right before the closing </body> tag.";
    } else {
      replyText = `Thank you for your message. Our support team is available 24/7 to assist you with "${message}".`;
    }

    if (escalated) {
      replyText += " ⚠️ [Auto-Escalated: Customer appears frustrated. Handed over to human agent queue.]";
    }

    return res.status(200).json({ reply: replyText, sentiment, escalated });

  } catch (err) {
    return res.status(200).json({ reply: 'Server Exception: ' + err.message });
  }
}
