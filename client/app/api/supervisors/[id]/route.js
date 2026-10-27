import { forwardDepartmentRequest } from "@/lib/departmentApi";

async function handler(request, { params }) {
  const { id } = await params;
  return forwardDepartmentRequest(request, `supervisors/${encodeURIComponent(id)}`);
}

export { handler as GET, handler as PATCH, handler as DELETE };
