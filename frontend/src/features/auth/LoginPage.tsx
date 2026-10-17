import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@bookleaf/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button, Field, inputClass } from "../../components/ui";
import { api, errorMessage, loadCsrf } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { usePageTitle } from "../../lib/title";
import { AuthLayout } from "./AuthLayout";

export default function LoginPage() {
  usePageTitle("Sign in");
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  if (!isLoading && user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/author"} replace />;
  }

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      await loadCsrf();
      const response = await api.post<{ user: { role: "AUTHOR" | "ADMIN" } }>("/auth/login", values);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate(response.data.user.role === "ADMIN" ? "/admin" : "/author");
    } catch (error) {
      setFormError(errorMessage(error, "Email or password is incorrect."));
    }
  }

  return (
    <AuthLayout title="Sign in" description="Use the email and password for your author or admin account.">
          <form className="mt-8 grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <Field id="email" label="Email" error={form.formState.errors.email?.message}>
              <input
                id="email"
                type="email"
                autoComplete="username"
                className={inputClass}
                aria-invalid={Boolean(form.formState.errors.email)}
                aria-describedby={form.formState.errors.email ? "email-error" : undefined}
                {...form.register("email")}
              />
            </Field>
            <Field id="password" label="Password" error={form.formState.errors.password?.message}>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={inputClass}
                aria-invalid={Boolean(form.formState.errors.password)}
                aria-describedby={form.formState.errors.password ? "password-error" : undefined}
                {...form.register("password")}
              />
            </Field>
            {formError ? (
              <p className="text-sm text-danger" role="alert">
                {formError}
              </p>
            ) : null}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted">
            Don't have an account?{" "}
            <Link to="/register" className="font-semibold text-primary">
              Sign up
            </Link>
          </p>
    </AuthLayout>
  );
}
