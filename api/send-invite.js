// api/send-invite.js
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Helper for CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // or your domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(req, res) {
  // 1️⃣ Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.writeHead(200, corsHeaders).end('OK');
  }

  // 2️⃣ Reject non-POST requests
  if (req.method !== 'POST') {
    return res.writeHead(405, corsHeaders).end('Method Not Allowed');
  }

  try {
    const { email, listName, inviteId, listId, inviterEmail } = req.body || {};

    if (!email || !listName || !inviteId || !listId || !inviterEmail) {
      return res
        .writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: false, error: 'Missing required fields' }));
    }

    console.log('send-invite called:', { email, listName, inviteId, inviterEmail });

    // ✅ Check if user exists in Supabase Auth
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Existing user → send notification email
      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been added to ${listName}`,
        html: `<p>${inviterEmail} has added you to <strong>${listName}</strong>.</p>`,
      });

      return res
        .writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: true, invited: 'existing' }));
    }

    // New user → send invite link
    const inviteLink = `${process.env.APP_URL || 'http://localhost:5173'}/login?invite=${inviteId}&email=${encodeURIComponent(email)}`;

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

    return res
      .writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: true, invited: 'new' }));
  } catch (error) {
    console.error('send-invite error:', error);
    return res
      .writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: false, error: error.message }));
  }
}
