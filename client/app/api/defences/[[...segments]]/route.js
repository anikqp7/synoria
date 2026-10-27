import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
async function handler(request, { params }) {
  const token = await getToken({ req: request });
  if (!token?.backendCookie) return NextResponse.json({ message: 'Please sign in again.' }, { status: 401 });
  const role = token.department?.role || 'department';
  if (!['department', 'supervisor', 'student', 'examiner'].includes(role)) return NextResponse.json({ message: 'This account cannot access defence schedules.' }, { status: 403 });
  const { segments = [] } = await params;
  const validId = value => /^[a-f0-9]{24}$/i.test(value);
  const examinerWrite = role === 'examiner' && segments.length === 3 && segments[1] === 'evaluation' && ((request.method === 'PUT' && segments[2] === 'draft') || (request.method === 'POST' && ['submit','publish'].includes(segments[2])));
  if (request.method !== 'GET' && role !== 'department' && !examinerWrite && !(role==='supervisor'&&request.method==='POST'&&segments.length===3&&segments[1]==='evaluation'&&segments[2]==='correct')) return NextResponse.json({ message: 'Only the coordinator can manage defence schedules.' }, { status: 403 });
  const path = segments.join('/');
  const patterns = { GET: /^(?:[a-f0-9]{24}(?:\/evaluation)?)?$/i, POST: /^(?:[a-f0-9]{24}\/(?:cancel|evaluation\/(?:submit|reopen|publish|correct)))?$/i, PUT: /^[a-f0-9]{24}\/evaluation\/draft$/i, PATCH: /^[a-f0-9]{24}$/i };
  if (!patterns[request.method]?.test(path)) return NextResponse.json({ message: 'Defence resource not found.' }, { status: 404 });
  const query = new URL(request.url).searchParams;
  if (segments.length === 0 && request.method === 'GET') {
    for (const key of query.keys()) if (!['search', 'status', 'page', 'sort'].includes(key) || query.getAll(key).length !== 1) return NextResponse.json({ message: 'Invalid schedule filter.' }, { status: 400 });
  }
  return forwardRoleRequest(request, `defences${path ? `/${path}` : ''}${request.method === 'GET' && !segments.length ? `?${query}` : ''}`, role);
}
export { handler as GET, handler as POST, handler as PATCH, handler as PUT };
