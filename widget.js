(function () {
  // 1. Script Tag Se App ID Read Karna
  const scriptTag = document.currentScript;
  const appId = scriptTag ? scriptTag.getAttribute('data-app-id') : 'demo-app-id';

  // 2. Floating Launcher Button Render Karna (Bottom Right)
  const launcher = document.createElement('div');
  launcher.id = 'helppilot-launcher';
  launcher.innerHTML = '💬';
  launcher.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #6366f1, #a855f7);
    color: #ffffff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    cursor: pointer;
    box-shadow: 0 8px 25px rgba(99, 102, 241, 0.4);
    z-index: 999999;
    transition: transform 0.2s ease;
  `;

  // 3. Dark-Mode Glassmorphic Chat Window
  const chatWindow = document.createElement('div');
  chatWindow.id = 'helppilot-chat-window';
  chatWindow.style.cssText = `
    position: fixed;
    bottom: 96px;
    right: 24px;
    width: 380px;
    height: 520px;
    background: #0b0f19;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    display: none;
    flex-direction: column;
    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    z-index: 999999;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #ffffff;
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

  // Toggle Window
  const toggleChat = () => {
    const isHidden = chatWindow.style.display === 'none';
    chatWindow.style.display = isHidden ? 'flex' : 'none';
  };

  launcher.onclick = toggleChat;
  document.getElementById('helppilot-close-btn').onclick = toggleChat;

  // Handle Real API Call
  const sendBtn = document.getElementById('helppilot-send-btn');
  const input = document.getElementById('helppilot-input');
  const messagesContainer = document.getElementById('helppilot-messages');

  const sendMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    // Visitor Message Bubble
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
      // Call Vercel Backend Endpoint
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId: appId, message: text })
      });
      const data = await res.json();

      document.getElementById(typingId)?.remove();
      messagesContainer.innerHTML += `
        <div style="align-self: flex-start; background: rgba(255,255,255,0.06); padding: 10px 14px; border-radius: 12px; max-width: 82%; font-size: 14px; line-height: 1.4; color: #