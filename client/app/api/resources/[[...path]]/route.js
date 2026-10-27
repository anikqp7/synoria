import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import { forwardRoleRequest } from "@/lib/backendApi";
async function handler(request, { params }) {
 const { path = [] } = await params;
 if (path.length > 3 || path.some(p => !/^[a-zA-Z0-9-]+$/.test(p)) || (path.length > 1 && (path.length !== 3 || path[1] !== "files"))) return NextResponse.json({message:"Not found."},{status:404});
 const token = await getToken({req:request});
 return forwardRoleRequest(request, `resources${path.length ? "/" + path.join("/") : ""}`, token?.department?.role || "student", 7 * 1024 * 1024);
}
export { handler as GET, handler as POST };
