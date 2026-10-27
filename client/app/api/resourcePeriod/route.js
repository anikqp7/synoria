import {getToken} from "next-auth/jwt";
import {forwardRoleRequest} from "@/lib/backendApi";
async function handler(request){const token=await getToken({req:request});return forwardRoleRequest(request,"resourcePeriod",token?.department?.role||"student");}
export {handler as GET,handler as PUT};
