import { forwardRoleRequest } from "@/lib/backendApi";
async function handler(request, { params }) { const { id } = await params; return forwardRoleRequest(request, `supervisorLoads/${encodeURIComponent(id)}`, "department"); }
export { handler as GET, handler as PATCH };
