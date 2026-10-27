import { forwardRoleRequest } from "@/lib/backendApi";

export const forwardDepartmentRequest = (request, resource) => forwardRoleRequest(request, resource, "department");
