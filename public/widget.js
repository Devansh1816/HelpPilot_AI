(function () {
    'use strict';

    // Read the public app ID from the embed script.
    const scriptElement = document.currentScript;
    const appId = scriptElement?.getAttribute('data-app-id');

    // The HelpPilot API is hosted on Vercel.
    // Use the same origin the widget script was loaded from, so no domain
    // is hardcoded.
    let backendUrl = '';

    try {
        backendUrl = new URL(scriptElement.src).origin;
    } catch {
        backendUrl = '';
    }

    if (!backendUrl || !appId || appId.length > 100) {
        console.error('HelpPilot: Missing or invalid data-app-id.');
        return;
    }

    // Prevent duplicate widget installation.
    if (document.getElementById('helppilot-widget-button')) {
        return;
    }

    // Create a visitor ID for this browser session.
    let visitorId;

    try {
        visitorId = sessionStorage.getItem('helppilot_visitor_id');

        if (!visitorId) {
            visitorId = window.crypto?.randomUUID
                ? window.crypto.randomUUID()
                : 'visitor_' + Date.now() + '_' +
                  Math.random().toString(36).slice(2);

            sessionStorage.setItem('helppilot_visitor_id', visitorId);
        }
    } catch {
        visitorId = 'visitor_' + Date.now() + '_' +
            Math.random().toString(36).slice(2);
    }

    // Widget styles.
    const style = document.createElement('style');

    style.textContent = `
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
            box-shadow: 0 4px 14px rgba(99,102,241,.4);
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
            max-width: calc(100vw - 30px);
            height: 480px;
            max-height: calc(100vh - 120px);
            background: #0f172a;
            border: 1px solid #1e293b;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,.5);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
        }

        .hp-header {
            background: #1e293b;
            padding: 14px;
            color: #fff;
            font-size: 15px;
            font-weight: 600;
            border-bottom: 1px solid #334155;
        }

        .hp-messages {
            flex: 1;
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .hp-msg {
            max-width: 80%;
            padding: 8px 12px;
            border-radius: 10px;
            font-size: 13px;
            line-height: 1.4;
            overflow-wrap: anywhere;
        }

        .hp-msg.bot {
            background: #1e293b;
            color: #e2e8f0;
            align-self: flex-start;
        }

        .hp-msg.user {
            background: #6366f1;
            color: #fff;
            align-self: flex-end;
        }

        .hp-footer {
            padding: 10px;
            border-top: 1px solid #1e293b;
            display: flex;
            gap: 6px;
            background: #0f172a;
        }

        .hp-input {
            min-width: 0;
            flex: 1;
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: 8px;
            color: #fff;
            font-size: 13px;
            outline: none;
        }

        .hp-send {
            background: #6366f1;
            color: #fff;
            border: none;
            padding: 0 14px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
        }

        .hp-send:disabled {
            opacity: .6;
            cursor: not-allowed;
        }
    `;

    document.head.appendChild(style);

    // Create the chat button.
    const button = document.createElement('button');
    button.id = 'helppilot-widget-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Open HelpPilot support chat');
    button.textContent = '💬';

    // Create the chat window.
    const box = document.createElement('div');
    box.id = 'helppilot-widget-box';

    const header = document.createElement('div');
    header.className = 'hp-header';
    header.textContent = 'HelpPilot AI Support';

    const messages = document.createElement('div');
    messages.className = 'hp-messages';
    messages.id = 'hp-msg-container';

    const welcome = document.createElement('div');
    welcome.className = 'hp-msg bot';
    welcome.textContent = '👋 Hi! How can I help your store today?';
    messages.appendChild(welcome);

    const footer = document.createElement('div');
    footer.className = 'hp-footer';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'hp-input-field';
    input.className = 'hp-input';
    input.placeholder = 'Type a message...';
    input.maxLength = 4000;
    input.setAttribute('aria-label', 'Your message');

    const sendButton = document.createElement('button');
    sendButton.type = 'button';
    sendButton.id = 'hp-send-btn';
    sendButton.className = 'hp-send';
    sendButton.textContent = 'Send';

    footer.appendChild(input);
    footer.appendChild(sendButton);

    box.appendChild(header);
    box.appendChild(messages);
    box.appendChild(footer);

    document.body.appendChild(button);
    document.body.appendChild(box);

    button.addEventListener('click', function () {
        const isOpen = box.style.display === 'flex';
        box.style.display = isOpen ? 'none' : 'flex';
    });

    function addMessage(text, type) {
        const messageElement = document.createElement('div');
        messageElement.className = 'hp-msg ' + type;

        // textContent prevents HTML injection.
        messageElement.textContent = text;

        messages.appendChild(messageElement);
        messages.scrollTop = messages.scrollHeight;
    }

    let sending = false;

    async function sendMessage(message) {
        const text = String(message || input.value).trim();

        if (!text || sending) return;

        if (text.length > 4000) {
            addMessage('Please keep your message under 4,000 characters.', 'bot');
            return;
        }

        addMessage(text, 'user');
        input.value = '';

        sending = true;
        sendButton.disabled = true;
        sendButton.textContent = '...';

        try {
            const response = await fetch(`${backendUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: text,
                    appId: appId,
                    visitorId: visitorId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // Show friendly server messages (rate limit, trial ended).
                if (data && typeof data.reply === 'string' && data.reply) {
                    addMessage(data.reply, 'bot');
                    return;
                }
                throw new Error(data.error || 'Chat request failed.');
            }

            addMessage(
                data.reply || 'Thanks for your message.',
                'bot'
            );

        } catch (error) {
            console.error('HelpPilot widget error:', error);
            addMessage(
                'Unable to connect right now. Please try again later.',
                'bot'
            );
        } finally {
            sending = false;
            sendButton.disabled = false;
            sendButton.textContent = 'Send';
        }
    }

    sendButton.addEventListener('click', function () {
        sendMessage(input.value);
    });

    input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            sendMessage(input.value);
        }
    });

    // Accept test-page messages only from this same page.
    window.addEventListener('message', function (event) {
        if (event.source !== window) return;

        const data = event.data;

        if (
            !data ||
            data.type !== 'HELPPILOT_SEND_QUERY' ||
            typeof data.query !== 'string' ||
            data.query.length > 4000
        ) {
            return;
        }

        box.style.display = 'flex';
        sendMessage(data.query);
    });

})();
