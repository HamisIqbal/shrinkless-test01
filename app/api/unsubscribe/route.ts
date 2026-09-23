import { NextResponse, type NextRequest } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe';
import { unsubscribe } from '@/lib/services/subscribers';

/**
 * RFC 8058 one-click unsubscribe: the mail client POSTs here straight from
 * its own "Unsubscribe" button. Only POST acts — a GET is what link scanners
 * send, and they must never be able to unsubscribe anyone.
 */
export async function POST(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('e') ?? '';
  const token = request.nextUrl.searchParams.get('t') ?? '';

  if (!verifyUnsubscribeToken(email, token)) {
    return NextResponse.json({ error: 'Invalid link' }, { status: 400 });
  }

  await unsubscribe(email);
  return NextResponse.json({ unsubscribed: true });
}
