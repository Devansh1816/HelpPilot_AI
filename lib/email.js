const EMAILJS_URL = 'https://api.emailjs.com/api/v1.0/email/send';

function config() {
  return {
    serviceId: process.env.EMAILJS_SERVICE_ID,
    publicKey: process.env.EMAILJS_PUBLIC_KEY,
    privateKey: process.env.EMAILJS_PRIVATE_KEY,
    notifyTemplateId: process.env.EMAILJS_NOTIFY_TEMPLATE_ID,
    welcomeTemplateId: process.env.EMAILJS_WELCOME_TEMPLATE_ID,
    adminEmail: process.env.EMAILJS_ADMIN_EMAIL
  };
}

// Best-effort delivery: email failures must never cancel core product actions.
async function send(templateId, params) {
  const c = config();
  if (!c.serviceId || !c.publicKey || !c.privateKey || !templateId) {
    console.warn('EmailJS notification skipped: incomplete configuration.');
    return { sent: false, reason: 'not_configured' };
  }

  try {
    const response = await fetch(EMAILJS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: c.serviceId,
        template_id: templateId,
        user_id: c.publicKey,
        accessToken: c.privateKey,
        template_params: params
      }),
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      console.error('EmailJS notification rejected:', response.status);
      return { sent: false, reason: 'provider_rejected' };
    }
    return { sent: true };
  } catch (error) {
    console.error('EmailJS notification failed:', error?.name || 'unknown_error');
    return { sent: false, reason: 'delivery_error' };
  }
}

export async function sendAdminNotification({ subject, eventType, storeName, appId, details }) {
  const c = config();
  if (!c.adminEmail || !c.notifyTemplateId) {
    console.warn('Admin notification skipped: recipient/template not configured.');
    return { sent: false, reason: 'not_configured' };
  }

  return send(c.notifyTemplateId, {
    to_email: c.adminEmail,
    subject: String(subject || 'HelpPilot AI notification').slice(0, 150),
    event_type: String(eventType || 'activity').slice(0, 80),
    store_name: String(storeName || 'Unknown store').slice(0, 100),
    app_id: String(appId || 'Not available').slice(0, 100),
    details: String(details || '').slice(0, 1000),
    event_time: new Date().toISOString()
  });
}

export async function sendWelcomeEmail(email, storeName) {
  const c = config();
  if (!email || !c.welcomeTemplateId) {
    return { sent: false, reason: 'not_configured' };
  }

  return send(c.welcomeTemplateId, {
    to_email: email,
    store_name: String(storeName || 'your store').slice(0, 100)
  });
}
