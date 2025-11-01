// api/send-invite.js
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ----------------------------
// Environment variables
// ----------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// ----------------------------
// Supabase Admin client & Resend
// ----------------------------
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

// ----------------------------
// CORS headers helper
// ----------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // restrict in production
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ----------------------------
// API Handler
// ----------------------------
export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') return res.writeHead(200, corsHeaders).end('OK');
  if (req.method !== 'POST') return res.writeHead(405, corsHeaders).end('Method Not Allowed');

  try {
    const { email, listId, listName, inviterEmail } = req.body || {};

    if (!email || !listId || !listName || !inviterEmail) {
      return res
        .writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: false, error: 'Missing required fields' }));
    }

    // ----------------------------
    // Check if the user exists via Supabase Admin v2
    // ----------------------------
    console.info('Checking if user exists for email:', email);

    // fetch first 100 users or however many you need
    const { data: usersData, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
    page: 0,
    per_page: 1000,
    });

    if (usersError) throw usersError;

    console.info('listUsers response:', usersData, 'error:', usersError);

    // manually find the user with the exact email
    const existingUser = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;

    console.info('existingUser:', existingUser);

    if (existingUser) {
      // ----------------------------
      // Existing user: add to list_members
      // ----------------------------
      const { error: memberError } = await supabaseAdmin
        .from('list_members')
        .upsert(
          [
            {
              list_id: listId,
              user_id: existingUser.id,
              role: 'editor',
            },
          ],
          { onConflict: ['list_id', 'user_id'] }
        );

      if (memberError) console.error('Error adding existing user to list_members:', memberError);

      // Send notification email
      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been added to ${listName}`,
        html: `<p>${inviterEmail} has added you to <strong>${listName}</strong>.</p>`,
      });

      return res
        .writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
        .end(JSON.stringify({ success: true, invited: 'existing', userId: existingUser.id }));
    }

    // ----------------------------
    // New user: create an invite in list_invites table
    // ----------------------------
    const { data: inviteData, error: inviteError } = await supabaseAdmin
      .from('list_invites')
      .insert([{ list_id: listId, email, role: 'editor' }])
      .select()
      .single();

    if (inviteError) throw inviteError;

    const inviteLink = `${APP_URL}/login?invite=${inviteData.id}&email=${encodeURIComponent(email)}`;

    // Send signup invite email
    await resend.emails.send({
      from: 'GrocLi <info@grocli.thijsterbeek.com>',
      to: email,
      subject: `You're invited to join ${listName}`,
      html: `
        <h2>You've been invited to join <strong>${listName}</strong></h2>
        <p>Invited by: ${inviterEmail}</p>
        <p><a href="${inviteLink}">Click here to join</a></p>
      `,
    });

    return res
      .writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: true, invited: 'new', inviteId: inviteData.id }));

  } catch (error) {
    console.error('send-invite error:', error);
    return res
      .writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' })
      .end(JSON.stringify({ success: false, error: error.message }));
  }
}
