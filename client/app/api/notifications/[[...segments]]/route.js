import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
async function handler(request, { params }) {
  const token = await getToken({ req: request });
  if (!token?.backendCookie) return NextResponse.json({ message: 'Please sign in again.' }, { status: 401 });
  const role = token.department?.role || 'department';
  if (!['department', 'supervisor', 'student', 'examiner'].includes(role)) return NextResponse.json({ message: 'This account cannot access notifications.' }, { status: 403 });
  const { segments = [] } = await params, path = segments.join('/');
  const patterns = { GET: /^$/, PATCH: /^[a-f0-9]{24}\/read$/i, POST: /^readAll$/ };
  if (!patterns[request.method]?.test(path)) return NextResponse.json({ message: 'Notification resource not found.' }, { status: 404 });
  const query = new URL(request.url).searchParams;
  if (request.method === 'GET') for (const key of query.keys()) if (!['cursor', 'unread', 'category', 'limit'].includes(key) || query.getAll(key).length !== 1) return NextResponse.json({ message: 'Invalid notification filter.' }, { status: 400 });
  return forwardRoleRequest(request, `notifications${path ? `/${path}` : ''}${request.method === 'GET' ? `?${query}` : ''}`, role);
}
export { handler as GET, handler as PATCH, handler as POST };
