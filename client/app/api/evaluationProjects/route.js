import { forwardRoleRequest } from '@/lib/backendApi';
export async function GET(request) { return forwardRoleRequest(request, 'evaluationProjects', 'examiner'); }
