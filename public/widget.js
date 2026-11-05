(function () {
    // Dynamic backend URL fallback fix
    const backendUrl = window.location.origin && window.location.origin !== 'null' && !window.location.origin.includes('file://')
        ? window.location.origin 
        : 'https://helppilotai.vercel.app';

    // Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #helppilot-widget-button {
            position: fixed; bottom: 20px; right: 20px;
            width: 60px; height: 60px; border-radius: 30px;
            background: #6366f1; color: #fff; border: none;
            box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
            cursor: pointer; z-index: 999999;
            display: flex; align-items: center; justify-content: center; font-size: 24px;
        }
        #helppilot-widget-box {
            position: fixed; bottom: 90px; right: 20px;
            width: 350px; height: 480px; background: #0f172a;
            border: 1px solid #1e293b; border-radius: 16px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999;
            display: none; flex-direction: column; overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .hp-header { background: #1e293b; padding: 14px; color: #fff; font-size: 15px; font-weight: 600; border-bottom: 1px solid #334155; }
        .hp-messages { flex: 1; padding: 14px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .hp-msg { max-width: 80%; padding: 8px 12px; border-radius: 10px; font-size: 13px; line-height: 1.4; }
        .hp-msg.bot { background: #1e293b; color: #e2e8f0; align-self: flex-start; }
        .hp-msg.user { background: #6366f1; color: #fff; align-self: flex-end; }
        .hp-footer { padding: 10px; border-top: 1px solid #1e293b; display: flex; gap: 6px; background: #0f172a; }
        .hp-input { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px; color: #fff; font-size:
