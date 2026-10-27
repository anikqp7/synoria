import { forwardDepartmentRequest } from "@/lib/departmentApi";
async function handler(request, { params }) {
  const { id } = await params;
  return forwardDepartmentRequest(request, `proposals/${encodeURIComponent(id)}/assignment`);
}
export { handler as GET, handler as PUT };
