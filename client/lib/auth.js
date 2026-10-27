import { roleDefinitions } from "@/lib/roles";
import CredentialsProvider from "next-auth/providers/credentials";

const apiUrl = process.env.API_URL || "http://127.0.0.1:4000";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "Department account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Department name", type: "text" },
        university: { label: "University", type: "text" },
        intent: { type: "hidden" },
        role: { type: "hidden" },
      },
      async authorize(credentials) {
        const registering = credentials?.intent === "register";
        const role = credentials?.role || "department";
        if (!Object.hasOwn(roleDefinitions, role) || (registering && role !== "department")) return null;
        let response;
        try {
          response = await fetch(`${apiUrl}/api/auth/${registering ? "register" : "login"}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials?.email,
              password: credentials?.password,
              role,
              ...(registering ? { name: credentials?.name, university: credentials?.university } : {}),
            }),
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          throw new Error("Unable to reach the server. Please try again.");
        }
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 401) return null;
          throw new Error(response.status < 500 && data?.message ? data.message : "Unable to sign in. Please try again.");
        }
        const backendCookie = response.headers.getSetCookie()
          .find(cookie => cookie.startsWith("department.sid="))?.split(";")[0];
        const user = data?.user || data?.department;
        if (!user?.id || !backendCookie || user.role !== role) throw new Error("Unable to create your session. Please try again.");
        return { ...user, backendCookie };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const { backendCookie, ...profile } = user;
        token.department = profile;
        // Keep the API session inside NextAuth's encrypted JWT, never in public session data.
        token.backendCookie = user.backendCookie;
      } else if (token.backendCookie) {
        let response;
        try {
          response = await fetch(`${apiUrl}/api/auth/me`, {
            headers: { Cookie: token.backendCookie },
            cache: "no-store",
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          return token;
        }
        // Refresh edited account details and invalidate sessions for deleted accounts.
        if (response.status === 401 || response.status === 403) throw new Error("Account session is no longer valid.");
        if (response.ok) {
          const data = await response.json();
          token.department = data.user || data.department;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user = token.department;
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (!token?.backendCookie) return;
      try {
        await fetch(`${apiUrl}/api/auth/logout`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: token.backendCookie },
          body: "{}",
          signal: AbortSignal.timeout(5000),
        });
      } catch {
        // NextAuth still clears the browser session when the API is unavailable.
        console.error("Unable to clear the backend session during sign out.");
      }
    },
  },
};
