import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const { count, error } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;

            const total = count || 0;

            return res.status(200).json({ 
                success: true, 
                totalConversations: total, 
                resolutionRate: '100%', 
                escalations: 0 
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
