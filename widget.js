(function () {
  function initHelpPilotWidget() {
    const scriptTag = document.querySelector('script[data-app-id]');
    const appId = scriptTag ? scriptTag.getAttribute('data-app-id') : '11111111-1111-1111-1111-111111111111';

    if (document.getElementById('helppilot-launcher')) return;

    // Floating Button
    const launcher = document.createElement('div');
    launcher.id = 'helppilot-launcher';
    launcher.innerHTML = '💬';
    launcher.style.cssText = `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      width: 60px !important;
      height: 60px !important;
      background: linear-gradient(135deg, #6366f1, #a855f7) !important;
      color: #ffffff !important;
      border-radius: 50% !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 26px !important;
      cursor: pointer !important;
      box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4) !important;
      z-index: 999999 !important;
    `;

    // Chat Window
    const chatWindow = document.createElement('div');
    chatWindow.id = 'helppilot-chat-window';
    chatWindow.style.cssText = `
      position: fixed !important;
      bottom: 96px !important;
      right: 24px !important;
      width: 380px !important;
      height: 520px !important;
      background: #0b0f19 !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 16px !important;
      display: none;
      flex-direction: column !important;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6) !important;
      z-index: 999999 !important;
      overflow: hidden !important;
      font-family: 'Segoe UI', system-ui, sans-serif !important;
      color: #ffffff !important;
    `;

    chatWindow.innerHTML = `
      <div style="background: rgba(18, 26, 43, 0.9); padding: 18px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; font-size: 16px; color: #fff;">HelpPilot AI</div>
          <div style="font-size: 12px; color: #10b981; display: flex; align-items: center; gap: 6px; margin-top: 2px;">
            <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></span> 24/7 Support Online
          </div>
        </div>
        <button id="helppilot-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer;">✕</button>
      </div>

      <div id="helppilot-messages" style="flex: 1; padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #0b0f19;">
        <div style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4; color: #cbd5e1;">
          👋 Hello! How can I help you today? Ask me anything about our products or services.
        </div>
      </div>

      <div style="padding: 14px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(18, 26, 43, 0.9); display: flex; gap: 8px;">
        <input id="helppilot-input" type="text" placeholder="Type your message..." style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 10px 14px; border-radius: 8px; color: #fff; font-size: 14px; outline: none;" />
        <button id="helppilot-send-btn" style="background: #6366f1; color: #fff; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; cursor: pointer;">Send</button>
      </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(chatWindow);

    const toggleChat = () => {
      const isHidden = chatWindow.style.display === 'none';
      chatWindow.style.display = isHidden ? 'flex' : 'none';
    };

    launcher.onclick = toggleChat;
    document.getElementById('helppilot-close-btn').onclick = toggleChat;

    const sendBtn = document.getElementById('helppilot-send-btn');
    const input = document.getElementById('helppilot-input');
    const messagesContainer = document.getElementById('helppilot-messages');

    const sendMessage = async () => {
      const text = input.value.trim();
      if (!text) return;

      messagesContainer.innerHTML += `
        <div style="align-self: flex-end; background: #6366f1; color: #fff; padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4;">
          ${text}
        </div>
      `;

      input.value = '';
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      const typingId = 'typing-' + Date.now();
      messagesContainer.innerHTML += `
        <div id="${typingId}" style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; color: #94a3b8;">
          <em>HelpPilot is typing...</em>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appId: appId, message: text })
        });
        const data = await res.json();

        document.getElementById(typingId)?.remove();
        messagesContainer.innerHTML += `
          <div style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4; color: #cbd5e1;">
            ${data.reply || data.error || 'No response.'}
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

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') sendMessage();
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpPilotWidget);
  } else {
    initHelpPilotWidget();
  }
})();
