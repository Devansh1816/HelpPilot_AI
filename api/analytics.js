import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const url = process.env.SUPABASE_URL;
        const key = process.env.SUPABASE_ANON_KEY;
        
        return res.status(200).json({ 
            success: true, 
            hasUrl: !!url, 
            hasKey: !!key,
            urlSnippet: url ? url.substring(0, 10) + '...' : 'Missing'
        });
    }
    res.status(405).end();
}
