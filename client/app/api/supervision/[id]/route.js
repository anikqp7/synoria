import { forwardRoleRequest } from "@/lib/backendApi";
async function handler(request, { params }) { const { id } = await params; return forwardRoleRequest(request, `supervision/${encodeURIComponent(id)}`, "supervisor"); }
export { handler as GET };
