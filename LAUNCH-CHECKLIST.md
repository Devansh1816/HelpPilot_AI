# HelpPilot AI - launch checklist

1. Supabase -> SQL Editor: run `supabase-setup.sql` (RLS on + unique UTR + index). Confirm all 5 tables show rowsecurity = true.
2. Supabase -> Authentication -> URL Configuration: set Site URL and add Redirect URL = your production domain (needed for email verify + password reset links).
3. Vercel -> Environment Variables: add everything from `.env.example`, then Redeploy.
4. (Done) Support email is set in the Terms and Privacy pages.
5. `public/test.html`: replace `PASTE_YOUR_PUBLIC_APP_ID_HERE` (or delete the page).
6. Test: sign up -> verify email -> login -> add FAQ -> embed widget -> chat -> forgot password -> UTR submit -> admin approve -> plan shows Pro.
7. Test with two accounts: data must not leak between them.
8. No domain is hardcoded: the widget and embed code use whatever domain the site is served from. Use the exact domain Vercel shows (it ends in .vercel.app, not .vercel.com).
