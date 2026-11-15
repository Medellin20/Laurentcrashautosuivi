import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'lc_admin_session';
const SESSION_DURATION = 60 * 60 * 8;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET;
}

function sign(expiresAt: string, secret: string) {
  return createHmac('sha256', secret).update(expiresAt).digest('hex');
}

function isAuthenticated(request: NextRequest) {
  const secret = sessionSecret();
  const value = request.cookies.get(COOKIE_NAME)?.value;
  if (!secret || !value) return false;

  const [expiresAt, signature] = value.split('.');
  if (!expiresAt || !signature || Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;
  const expected = sign(expiresAt, secret);
  const receivedBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ authenticated: isAuthenticated(request) });
}

export async function POST(request: NextRequest) {
  const password = process.env.ADMIN_PASSWORD;
  const secret = sessionSecret();
  if (!password || !secret) {
    return NextResponse.json({ error: 'La connexion administrateur n’est pas configurée.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const submittedPassword = typeof body?.password === 'string' ? body.password : '';
  const submittedBuffer = Buffer.from(submittedPassword);
  const expectedBuffer = Buffer.from(password);
  const valid = submittedBuffer.length === expectedBuffer.length && timingSafeEqual(submittedBuffer, expectedBuffer);
  if (!valid) return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 401 });

  const expiresAt = String(Math.floor(Date.now() / 1000) + SESSION_DURATION);
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(COOKIE_NAME, `${expiresAt}.${sign(expiresAt, secret)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
