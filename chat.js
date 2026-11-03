// Handle Real API Call in widget.js
  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    // Render Visitor Bubble
    messagesContainer.innerHTML += `
      <div style="align-self: flex-end; background: #6366f1; color: #fff; padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4;">
        ${text}
      </div>
    `;

    input.value = '';
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show Typing Indicator
    const typingId = 'typing-' + Date.now();
    messagesContainer.innerHTML += `
      <div id="${typingId}" style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; color: #94a3b8;">
        <em>HelpPilot is typing...</em>
      </div>
    `;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    try {
      // Call Vercel API Endpoint (Deploy hone ke baad yahan apna live URL lagayenge)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: appId, message: text })
      });
      const data = await res.json();

      // Remove typing indicator & show real AI reply
      document.getElementById(typingId)?.remove();
      messagesContainer.innerHTML += `
        <div style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4; color: #cbd5e1;">
          ${data.reply}
        </div>
      `;
    } catch (err) {
      document.getElementById(typingId)?.remove();
      messagesContainer.innerHTML += `
        <div style="align-self: flex-start; background: rgba(239, 68, 68, 0.2); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; color: #f87171;">
          Connection error. Please try again.
        </div>
      `;
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  };