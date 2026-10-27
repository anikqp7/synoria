import LoginForm from "@/components/loginForm";

export const metadata = { title: "Supervisor Sign In | Synoria" };

export default function SupervisorLogin() {
  return <LoginForm role="supervisor" />;
}
