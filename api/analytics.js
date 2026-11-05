import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            // 1. Total Conversations count
            const { count: totalConv, error: convError } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true });
            
            if (convError) throw convError;

            // 2. Human Escalations count (status 'escalated' ya messages ke hisaab se)
            const { count: escalationsCount, error: escError } = await supabase
                .from('conversations')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'escalated');

            if (escError) throw escError;

            const total = totalConv || 0;
            const escalations = escalationsCount || 0;

            // 3. AI Resolution Rate calculate karna
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
