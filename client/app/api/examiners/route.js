import { forwardDepartmentRequest } from "@/lib/departmentApi";

const handler = request => forwardDepartmentRequest(request, "examiners");

export { handler as GET, handler as POST };
