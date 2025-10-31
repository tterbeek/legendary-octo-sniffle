import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Resend from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY!);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { email, listName, inviteId, inviterEmail } = req.body;

    if (!email || !listName || !inviteId || !inviterEmail) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    console.log('Send-invite called with:', { email, listName, inviteId, inviterEmail });

    // TODO: check user in Supabase and send email

    return res.status(200).json({ success: true, invited: 'new' });
  } catch (err: any) {
    console.error('Error in send-invite:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
