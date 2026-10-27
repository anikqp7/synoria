import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
async function handler(request, { params }) {
  const { segments = [] } = await params;
  const token = await getToken({ req: request });
  const role = token?.department?.role;
  if (!['student', 'department'].includes(role)) return NextResponse.json({ message: 'Please sign in with a student or department account.' }, { status: token ? 403 : 401 });
  if (!(segments.length === 0 || (segments.length === 2 && /^[a-f0-9]{24}$/i.test(segments[0]) && segments[1] === 'assignment'))) return NextResponse.json({ message: 'Not found.' }, { status: 404 });
  return forwardRoleRequest(request, `supervisorRequests${segments.length ? `/${segments.join('/')}` : ''}`, role);
}
export { handler as GET, handler as PUT };
