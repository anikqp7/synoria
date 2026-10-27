import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
export async function GET(request, { params }) {
  const { segments = [] } = await params;
  if (segments.length > 1 || (segments.length && segments[0] !== 'unread')) return NextResponse.json({ message: 'Chat resource not found.' }, { status: 404 });
  const token = await getToken({ req: request });
  if (!token?.backendCookie) return NextResponse.json({ message: 'Please sign in.' }, { status: 401 });
  const role = token.department?.role;
  if (!['student', 'supervisor'].includes(role)) return NextResponse.json({ message: 'Project chat is private to the team and supervisor.' }, { status: 403 });
  return forwardRoleRequest(request, segments.length ? 'chat/unread' : 'chat', role);
}
