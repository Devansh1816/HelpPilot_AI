(function () {
    const currentScript = document.currentScript;
    const workspaceId = currentScript ? (currentScript.getAttribute('data-workspace-id') || 'app_saas_main') : 'app_saas_main';
    const backendUrl = 'https://helppilotai.vercel.app';

    // Inject Widget Styles
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
            font-size: 24px;
        }
        #helppilot-widget-box {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 350px;
            height: 480px;
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .hp-header { background: #1e293b; padding: 14px; color: #fff; font-size: 15px; font-weight: 600; border-bottom: 1px solid #334155; }
        .hp-messages { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .hp-msg { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.4; }
        .hp-msg.bot { background: #1e293b; color: #e2e8f0; align-self: flex-start; }
        .hp-msg.user { background: #6366f1; color: #fff; align-self: flex-end; }
        .hp-footer { padding: 10px; border-top: 1px solid #1e293b; display: flex; gap: 6px; background: #0f172a; }
        .hp-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px; color: #fff; font-size: 13px; outline: none; }
        .hp-send { background: #6366f1; color: #fff; border: none; padding: 0 14px; border-radius: 8px; cursor: pointer; font-weight: 600; }
    `;
    document.head.appendChild(style);

    // Create Elements
    const btn = document.createElement('button');
    btn.id = 'helppilot-widget-button';
    btn.innerHTML = '💬';

    const box = document.createElement('div');
    box.id = 'helppilot-widget-box';
    box.innerHTML = `
        <div class="hp-header">HelpPilot AI Support</div>
        <div class="hp-messages" id="hp-msg-container">
            <div class="hp-msg bot">👋 Hi! How can I help your store today?</div>
        </div>
        <div class="hp-footer">
            <input type="text" id="hp-input-field" class="hp-input" placeholder="Type a message..." />
            <button id="hp-send-btn" class="hp-send">Send</button>
        </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(box);

    btn.onclick = () => {
        box.style.display = box.style.display === 'flex' ? 'none' : 'flex';
    };

    const msgContainer = box.querySelector('#hp-msg-container');
    const inputField = box.querySelector('#hp-input-field');
    const sendBtn = box.querySelector('#hp-send-btn');

    async function sendMsg() {
        const text = inputField.value.trim();
        if (!text) return;

        const uDiv = document.createElement('div');
        uDiv.className = 'hp-msg user';
        uDiv.textContent = text;
        msgContainer.appendChild(uDiv);
        inputField.value = '';
        msgContainer.scrollTop = msgContainer.scrollHeight;

        try {
            const res = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, appId: workspaceId })
            });
            const data = await res.json();

            const bDiv = document.createElement('div');
            bDiv.className = 'hp-msg bot';
            bDiv.textContent = data.reply || "Thanks for your message.";
            msgContainer.appendChild(bDiv);
            msgContainer.scrollTop = msgContainer.scrollHeight;
        } catch (e) {
            const bDiv = document.createElement('div');
            bDiv.className = 'hp-msg bot';
            bDiv.textContent = "Unable to connect right now.";
            msgContainer.appendChild(bDiv);
        }
    }

    sendBtn.onclick = sendMsg;
    inputField.onkeypress = (e) => { if (e.key === 'Enter') sendMsg(); };
})();
