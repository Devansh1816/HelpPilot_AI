import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            // Conversations count fetch karna
            const { count, error } = await supabase.from('conversations').select('*', { count: 'exact', head: true });
            if (error) throw error;

            return res.status(200).json({ 
                success: true, 
                totalConversations: count || 0, 
                resolutionRate: '91.6%', 
                escalations: 2 
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
