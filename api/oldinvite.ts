// api/send-invite.ts
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Create clients once (outside handler)
const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // or your frontend domain
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ✅ 1. Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse('OK', { status: 200, headers: corsHeaders });
}

// ✅ 2. Handle POST request
export async function POST(req: Request) {
  try {
    const { email, listName, inviteId, listId, inviterEmail } = await req.json();

    // Validate input
    if (!email || !listName || !inviteId || !listId || !inviterEmail) {
      return new NextResponse(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ✅ Log incoming request (for debugging)
    console.log('send-invite POST received:', { email, listName, inviteId, inviterEmail });

    // Check if the user already exists in Supabase Auth
    const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const existingUser = usersData.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // ✅ Existing user → send notification
    if (existingUser) {
      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been added to ${listName}`,
        html: `<p>${inviterEmail} has added you to <strong>${listName}</strong>.</p>`,
      });

      return new NextResponse(
        JSON.stringify({ success: true, invited: 'existing' }),
        { status: 200, headers: corsHeaders }
      );
    }

    // ✅ New user → send invite email with link
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

    return new NextResponse(
      JSON.stringify({ success: true, invited: 'new' }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('send-invite error:', error);
    return new NextResponse(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}
