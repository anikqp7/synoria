import { forwardDepartmentRequest } from "@/lib/departmentApi";

const handler = request => forwardDepartmentRequest(request, "supervisors");

export { handler as GET, handler as POST };
