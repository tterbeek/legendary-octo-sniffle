import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // server-side key
);

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, listName, inviteId, listId, inviterEmail } = req.body;

    if (!email || !listName || !inviteId || !listId || !inviterEmail) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if the user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      // Existing user → send notification email only
      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been granted access to ${listName}`,
        html: `<p>${inviterEmail} added you to <strong>${listName}</strong>.</p>`,
      });

      // Add user directly to list_members
      await supabase.from('list_members').insert([{
        list_id: listId,
        user_id: existingUser.id,
        role: 'editor',
      }]);

      return res.status(200).json({ success: true, invited: 'existing' });
    }

    // New user → send invite email
    const APP_URL = process.env.APP_URL || 'http://localhost:5173';
    const inviteLink = `${APP_URL}/login?invite=${inviteId}&email=${encodeURIComponent(email)}`;

    await resend.emails.send({
      from: 'GrocLi <info@grocli.thijsterbeek.com>',
      to: email,
      subject: `You're invited to join ${listName}`,
      html: `
        <h2>You've been invited to join <strong>${listName}</strong></h2>
        <p>Invited by: ${inviterEmail}</p>
        <p><a href="${inviteLink}">Click here to accept your invite</a></p>
      `,
    });

    return res.status(200).json({ success: true, invited: 'new' });

  } catch (err) {
    console.error('Error in send-invite API:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
