import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY!);

console.log('SUPABASE_URL', process.env.SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY', !!process.env.SUPABASE_SERVICE_ROLE_KEY);


export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { email, listName, inviteId, inviterEmail } = req.body;

    if (!email || !listName || !inviteId || !inviterEmail)
      return res.status(400).json({ success: false, error: 'Missing required fields' });

    // Construct invite link
    const inviteLink = `${process.env.APP_URL}/login?invite=${inviteId}&email=${encodeURIComponent(email)}`;

    await resend.emails.send({
      from: `GrocLi <info@grocli.thijsterbeek.com>`,
      to: email,
      subject: `You're invited to join ${listName}`,
      html: `<p>${inviterEmail} invited you to <strong>${listName}</strong></p>
             <a href="${inviteLink}">Join the list</a>`,
    });

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('send-invite error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
