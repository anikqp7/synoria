import { forwardRoleRequest } from "@/lib/backendApi";
const handler = request => forwardRoleRequest(request, "supervisorLoads", "department");
export { handler as GET };
