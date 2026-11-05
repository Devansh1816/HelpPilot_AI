(function () {
    // 1. Get Workspace ID from script attribute
    const currentScript = document.currentScript;
    const workspaceId = currentScript ? currentScript.getAttribute('data-workspace-id') : 'app_saas_main';
    const backendUrl = currentScript ? new URL(currentScript.src).origin : 'https://helppilotai.vercel.app';

    // 2. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #helppilot-widget-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            border-radius: 30px;
            background: #6366f1;
            color: #fff;
            border: none;
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
            cursor: pointer;
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }
        #helppilot-widget-button:hover { transform: scale(1.05); }
        #helppilot-widget-box {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 360px;
            height: 520px;
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .hp-header { background: #1e293b; padding: 16px; color: #fff; font-size: 15px; font-weight: 600; border-bottom: 1px solid #334155; }
        .hp-messages { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .hp-msg { max-width: 80%; padding: 10px 14px; border-radius: 12px; font-size: 13.5px; line-height: 1.4; word-break: break-word; }
        .hp-msg.bot { background: #1e293b; color: #e2e8f0; align-self: flex-start; }
        .hp-msg.user { background: #6366f1; color: #fff; align-self: flex-end; }
        .hp-footer { padding: 12px; border-top: 1px solid #1e293b; display: flex; gap: 8px; background: #0f172a; }
        .hp-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; color: #fff; font-size: 13px; outline: none; }
        .hp-send { background: #6366f1; color: #fff; border: none; padding: 0 16px; border-radius: 8px; font-weight: 600; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // 3. Create Button & Box
    const btn = document.createElement('button');
    btn.id = 'helppilot-widget-button';
    btn.innerHTML = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

    const box = document.createElement('div');
    box.id = 'helppilot-widget-box';
    box.innerHTML = `
        <div class="hp-header">💬 Support Assistant</div>
        <div class="hp-messages" id="hp-msg-container">
            <div class="hp-msg bot">👋 Hello! How can we help your store today?</div>
        </div>
        <div class="hp-footer">
            <input type="text" id="hp-input-field" class="hp-input" placeholder="Ask a question..." />
            <button id="hp-send-btn" class="hp-send">Send</button>
        </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(box);

    // 4. Toggle Visibility
    btn.onclick = () => {
        box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
    };

    // 5. Chat Communication
    const msgContainer = box.querySelector('#hp-msg-container');
    const inputField = box.querySelector('#hp-input-field');
    const sendBtn = box.querySelector('#hp-send-btn');

    async function sendMessage() {
        const text = inputField.value.trim();
        if (!text) return;

        // Render User Message
        const userDiv = document.createElement('div');
        userDiv.className = 'hp-msg user';
        userDiv.textContent = text;
        msgContainer.appendChild(userDiv);
        inputField.value = '';
        msgContainer.scrollTop = msgContainer.scrollHeight;

        // Call HelpPilot API
        try {
            const res = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, appId: workspaceId })
            });
            const data = await res.json();

            const botDiv = document.createElement('div');
            botDiv.className = 'hp-msg bot';
            botDiv.textContent = data.reply || "Thanks for reaching out!";
            msgContainer.appendChild(botDiv);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (err) {
            const botDiv = document.createElement('div');
            botDiv.className = 'hp-msg bot';
            botDiv.textContent = "Unable to connect right now. Please try again.";
            msgContainer.appendChild(botDiv);
        }
    }

    sendBtn.onclick = sendMessage;
    inputField.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
})();
