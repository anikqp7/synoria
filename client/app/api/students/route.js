import { forwardDepartmentRequest } from "@/lib/departmentApi";

const handler = request => forwardDepartmentRequest(request, "students");

export { handler as GET, handler as POST };
