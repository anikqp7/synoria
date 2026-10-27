import { forwardRoleRequest } from "@/lib/backendApi";
const handler = request => forwardRoleRequest(request, "supervision", "supervisor");
export { handler as GET };
