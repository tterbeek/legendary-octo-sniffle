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
    const { email, listId, listName, inviterEmail, displayName } = req.body || {};

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

    const inviterLabel = (displayName || '').trim() || inviterEmail;

    const buildInviteHtml = (link) => `
<!DOCTYPE html>
<html>
  <body style="margin:0; padding:0; background:#f6f8f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:24px;">
          <table width="100%" style="max-width:520px; background:#ffffff; border-radius:12px; padding:24px;">
            
            <!-- Header -->
            <tr>
              <td style="font-size:22px; font-weight:600; color:#578080;">
                GrocLi
              </td>
            </tr>

            <tr><td style="height:16px;"></td></tr>

            <!-- Main message -->
            <tr>
              <td style="font-size:18px; font-weight:600; color:#1f2937;">
                You’ve been invited to a shared shopping list
              </td>
            </tr>

            <tr><td style="height:12px;"></td></tr>

            <tr>
              <td style="font-size:15px; color:#374151;">
                <strong>${inviterLabel}</strong> has shared the list
                <strong>“${listName}”</strong> with you.
              </td>
            </tr>

            <tr><td style="height:20px;"></td></tr>

            <!-- Value proposition -->
            <tr>
              <td style="font-size:15px; color:#374151;">
                With GrocLi, you can:
                <ul style="padding-left:18px; margin:12px 0;">
                  <li>Shop together in real time</li>
                  <li>See items added or checked instantly</li>
                  <li>Avoid double buying and forgotten items</li>
                </ul>
              </td>
            </tr>

            <tr><td style="height:24px;"></td></tr>

            <!-- CTA -->
            <tr>
              <td align="center">
                <a href="${link}" style="
                  background:#578080;
                  color:#ffffff;
                  text-decoration:none;
                  padding:14px 24px;
                  border-radius:8px;
                  font-size:16px;
                  font-weight:600;
                  display:inline-block;
                ">
                  Join the list
                </a>
              </td>
            </tr>

            <tr><td style="height:20px;"></td></tr>

            <!-- Secondary reassurance -->
            <tr>
              <td style="font-size:14px; color:#6b7280;">
                No passwords. No setup.  
                Just enter your email and you’re in.
              </td>
            </tr>

          </table>

          <!-- Footer -->
          <div style="font-size:12px; color:#9ca3af; margin-top:12px;">
            GrocLi · The fastest shared shopping list
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

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
        from: 'GrocLi Shared Shopping List<no-reply@app.grocli.net>',
        to: email,
        subject: `${inviterLabel} invited you to a shared shopping list`,
        html: buildInviteHtml(APP_URL),
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

    const inviteLink = `${APP_URL}/Signup?invite=${inviteData.id}&email=${encodeURIComponent(email)}`;

    // Send signup invite email
    await resend.emails.send({
      from: 'GrocLi - Shared Shopping List<no-reply@app.grocli.net>',
      to: email,
      subject: `${inviterLabel} invited you to a shared shopping list`,
      html: buildInviteHtml(inviteLink),
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
