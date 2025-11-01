import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY!);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function OPTIONS() {
  return new NextResponse('OK', {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  try {
    const { email, listName, inviteId, listId, inviterEmail } = await req.json();

    if (!email || !listName || !inviteId || !listId || !inviterEmail) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user exists in auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    const existingUser = userData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      // Send email to existing user
      await resend.emails.send({
        from: 'GrocLi <info@grocli.thijsterbeek.com>',
        to: email,
        subject: `You've been granted access to ${listName}`,
        html: `<p>${inviterEmail} added you to the list <b>${listName}</b>.</p>`,
      });

      return NextResponse.json({ success: true, invited: 'existing' });
    }

    // Otherwise send new invite link
    const inviteLink = `${process.env.APP_URL}/login?invite=${inviteId}&email=${encodeURIComponent(email)}`;

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

    return NextResponse.json({ success: true, invited: 'new' });
  } catch (error: any) {
    console.error('send-invite error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
