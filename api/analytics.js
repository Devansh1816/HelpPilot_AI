import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL, 
    process.env.SUPABASE_ANON_KEY,
    { db: { schema: 'public' } }
);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const { data, error, count } = await supabase
                .from('conversations')
                .select('*', { count: 'exact' });
            
            if (error) throw error;

            const total = count !== null ? count : (data ? data.length : 0);
            const escalations = data ? data.filter(item => item.status === 'escalated').length : 0;

            let resolutionRate = '100%';
            if (total > 0) {
                const resolved = total - escalations;
                resolutionRate = ((resolved / total) * 100).toFixed(1) + '%';
            }

            return res.status(200).json({ 
                success: true, 
                totalConversations: total, 
                resolutionRate: resolutionRate, 
                escalations: escalations 
            });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    }
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
