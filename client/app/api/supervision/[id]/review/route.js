import { forwardRoleRequest } from "@/lib/backendApi";
export async function POST(request, { params }) { const { id } = await params; return forwardRoleRequest(request, `supervision/${encodeURIComponent(id)}/review`, "supervisor"); }
