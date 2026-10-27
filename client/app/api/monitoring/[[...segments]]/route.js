import { NextResponse } from 'next/server';
import { forwardDepartmentRequest } from '@/lib/departmentApi';
export async function GET(request, { params }) {
  const { segments = [] } = await params;
  const validId = value => /^[a-f0-9]{24}$/i.test(value);
  if (segments.length === 1 && segments[0] === 'overview') return forwardDepartmentRequest(request, 'monitoring/overview');
  if (!segments.length) {
    const query = new URL(request.url).searchParams;
    const allowed = new Set(['search', 'status', 'workType', 'risk', 'supervisorId', 'page']);
    for (const key of query.keys()) if (!allowed.has(key) || query.getAll(key).length !== 1) return NextResponse.json({ message: 'Invalid monitoring filter.' }, { status: 400 });
    return forwardDepartmentRequest(request, `monitoring?${query}`);
  }
  if (segments.length === 1 && validId(segments[0])) return forwardDepartmentRequest(request, `monitoring/${segments[0]}`);
  return NextResponse.json({ message: 'Project resource not found.' }, { status: 404 });
}
