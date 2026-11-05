(function () {
    const backendUrl = 'https://helppilotai.vercel.app';

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
        .hp-messages { flex: 1; padding: 14px;
