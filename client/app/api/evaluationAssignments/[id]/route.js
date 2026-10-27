import { forwardRoleRequest } from '@/lib/backendApi';
import { NextResponse } from 'next/server';
async function handler(request, { params }) {
 const { id } = await params;
 if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({message:'Project not found.'},{status:404});
 return forwardRoleRequest(request, `evaluationAssignments/${id}`, 'supervisor');
}
export { handler as GET, handler as PUT };
