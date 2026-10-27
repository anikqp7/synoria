import { forwardRoleRequest } from "@/lib/backendApi";
const handler = request => forwardRoleRequest(request, "workspaces", "student");
export { handler as GET, handler as POST };
