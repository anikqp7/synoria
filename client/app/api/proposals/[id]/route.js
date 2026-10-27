import { forwardDepartmentRequest } from "@/lib/departmentApi";
async function GET(request, { params }) { const { id } = await params; return forwardDepartmentRequest(request, `proposals/${encodeURIComponent(id)}`); }
export { GET };
