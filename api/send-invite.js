// api/send-invite.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Regular client for public queries (if needed)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Admin client for server-side only operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // adjust to your frontend
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).setHeader(corsHeaders).end();

  if (req.method !== 'POST')
    return res.status(405).setHeader(corsHeaders).end('Method Not Allowed');

  try {
    const { email, listName, inviteId, listId, inviterEmail } = req.body || {};
    if (!email || !listName || !inviteId || !listId || !inviterEmail)
      return res.status(400).json({ success: false, error: 'Missing required fields' });

    console.log('send-invite called:', { email, listName, inviteId, inviterEmail });

    // ✅ Check if user exists in Supabase Auth
    const { data: existingUser, error } = await supabaseAdmin.auth.admin.getUserByEmail(email);


    if (existingUser) {
      // Existing user → add to list_members and send notification email
      await supabase.from('list_members').insert([
        { list_id: listId, user_id: existingUser.id, role: 'editor' },
      ]);

      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been added to ${listName}`,
        html: `<p>${inviterEmail} has added you to <strong>${listName}</strong>.</p>`,
      });

      return res.status(200).json({ success: true, invited: 'existing' });
    }

    // New user → send invite link
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const inviteLink = `${appUrl}/login?invite=${inviteId}&email=${encodeURIComponent(email)}`;

    await resend.emails.send({
      from: 'GrocLi <info@grocli.thijsterbeek.com>',
      to: email,
      subject: `You're invited to join ${listName}`,
      html: `
        <h2>You've been invited to join <strong>${listName}</strong></h2>
        <p>Invited by: ${inviterEmail}</p>
        <p><a href="${inviteLink}">Join the list</a></p>
      `,
    });

    return res.status(200).json({ success: true, invited: 'new' });
  } catch (error) {
    console.error('send-invite error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
