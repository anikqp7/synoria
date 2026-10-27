import { forwardDepartmentRequest } from "@/lib/departmentApi";
const handler = request => forwardDepartmentRequest(request, "proposals");
export { handler as GET };
