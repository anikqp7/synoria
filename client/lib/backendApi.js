import { canManageAccounts } from "@/lib/roles";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function backendAccess(request, role, contentType = "application/json", maxBytes = 65536) {
  const token = await getToken({ req: request });
  const error = (message, status) => ({ error: NextResponse.json({ message }, { status }) });
  if (!token?.backendCookie) return error("Please sign in again.", 401);
  if (!token.department?.id || (role === "department" ? !canManageAccounts(token.department.role || "department") : token.department.role !== role)) return error("This account cannot access this resource.", 403);
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    if (!request.headers.get("content-type")?.startsWith(contentType)) return error(`Send ${contentType}.`, 415);
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(process.env.NEXTAUTH_URL || request.url).origin) return error("Invalid request origin.", 403);
    if (Number(request.headers.get("content-length")) > maxBytes) return error("Request is too large.", 413);
  }
  return { token };
}

export async function forwardRoleRequest(request, resource, role, maxBytes = 65536) {
  const { token, error } = await backendAccess(request, role, "application/json", maxBytes);
  if (error) return error;
  let body;
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) {
    try { body = JSON.stringify(await request.json()); }
    catch { return NextResponse.json({ message: "Invalid JSON request." }, { status: 400 }); }
    if (new TextEncoder().encode(body).length > maxBytes) return NextResponse.json({ message: "Request is too large." }, { status: 413 });
  }
  try {
    const response = await fetch(`${process.env.API_URL || "http://127.0.0.1:4000"}/api/auth/${resource}`, {
      method: request.method,
      headers: { Cookie: token.backendCookie, "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({
        message: response.status === 404
          ? "This API is unavailable on the running backend. Restart the backend server and try again."
          : "The backend returned an unexpected response. Please try again.",
      }, { status: 502 });
    }
    const data = await response.json();
    return NextResponse.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Unable to reach the server. Please try again." }, { status: 502 });
  }
}
