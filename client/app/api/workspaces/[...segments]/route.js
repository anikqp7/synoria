import { chatQuery } from "@/lib/chatApi";
import { NextResponse } from "next/server";
import { forwardRoleRequest } from "@/lib/backendApi";
async function handler(request, { params }) {
  const { segments } = await params;
  if (/^[a-f0-9]{24}$/i.test(segments[0])) {
    if (segments[1] === 'chat' && segments[2] === 'meetings' && (segments.length === 3 && ['GET','POST'].includes(request.method) || segments.length === 4 && /^[a-f0-9]{24}$/i.test(segments[3]) && request.method === 'PATCH')) return forwardRoleRequest(request, `workspaces/${segments.join('/')}`, 'student');
    if (segments[1] === 'chat' && ((segments.length === 2 && ['GET', 'POST'].includes(request.method)) || (segments.length === 3 && segments[2] === 'read' && request.method === 'POST'))) {
      const resource = `workspaces/${segments[0]}/chat${segments.length === 3 ? '/read' : ''}`;
      return forwardRoleRequest(request, request.method === 'GET' ? chatQuery(resource, request) : resource, 'student');
    }
  }
  const path = segments.join("/");
  const patterns = {
    GET: /^(?:teams|[a-f0-9]{24}(?:\/proposal)?)$/i,
    PATCH: /^[a-f0-9]{24}(?:\/invitations\/[a-f0-9]{24}|\/members\/[a-f0-9]{24}|\/joinRequests\/[a-f0-9]{24}|\/proposal)?$/i,
    POST: /^[a-f0-9]{24}\/(?:invitations|members|joinRequests|proposal\/(?:submit|scopeChange))$/i,
    DELETE: /^[a-f0-9]{24}\/members\/[a-f0-9]{24}$/i,
  };
  if (!patterns[request.method]?.test(path)) return NextResponse.json({ message: "Workspace resource not found." }, { status: 404 });
  return forwardRoleRequest(request, `workspaces/${segments.map(encodeURIComponent).join("/")}${path === "teams" ? new URL(request.url).search : ""}`, "student");
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
