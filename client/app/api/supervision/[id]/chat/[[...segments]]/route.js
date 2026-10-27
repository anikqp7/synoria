import { NextResponse } from 'next/server';
import { forwardRoleRequest } from '@/lib/backendApi';
import { chatQuery } from '@/lib/chatApi';
async function handler(request, { params }) {
  const { id, segments = [] } = await params;
  const chat = !segments.length && ['GET','POST'].includes(request.method);
  const read = segments.length === 1 && segments[0] === 'read' && request.method === 'POST';
  const meetings = segments[0] === 'meetings' && (segments.length === 1 && ['GET','POST'].includes(request.method) || segments.length === 2 && /^[a-f0-9]{24}$/i.test(segments[1]) && request.method === 'PATCH');
  if (!/^[a-f0-9]{24}$/i.test(id) || !(chat || read || meetings)) return NextResponse.json({ message: 'Chat resource not found.' }, { status: 404 });
  const resource = `supervision/${id}/chat${segments.length ? '/' + segments.join('/') : ''}`;
  return forwardRoleRequest(request, request.method === 'GET' && !meetings ? chatQuery(resource, request) : resource, 'supervisor');
}
export { handler as GET, handler as POST, handler as PATCH };
