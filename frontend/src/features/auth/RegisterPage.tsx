import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@bookleaf/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useToast } from "../../components/toast";
import { Button, Field, inputClass } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { usePageTitle } from "../../lib/title";
import { AuthLayout } from "./AuthLayout";

export default function RegisterPage() {
  usePageTitle("Sign up");
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  if (!isLoading && user) {
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/author"} replace />;
  }

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await api.get("/auth/csrf");
      const response = await api.post<{ user: { role: "AUTHOR" | "ADMIN" } }>("/auth/register", values);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast("Your author account is ready.");
      navigate(response.data.user.role === "ADMIN" ? "/admin" : "/author");
    } catch (error) {
      setFormError(errorMessage(error, "The account could not be created."));
    }
  }

  return (
    <AuthLayout title="Create an author account" description="Use your name, email, and a password of at least 8 characters.">
      <form className="mt-8 grid gap-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <Field id="name" label="Full name" error={form.formState.errors.name?.message}>
          <input
            id="name"
            type="text"
            autoComplete="name"
            className={inputClass}
            aria-invalid={Boolean(form.formState.errors.name)}
            aria-describedby={form.formState.errors.name ? "name-error" : undefined}
            {...form.register("name")}
          />
        </Field>
        <Field id="email" label="Email" error={form.formState.errors.email?.message}>
          <input
            id="email"
            type="email"
            autoComplete="email"
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
            autoComplete="new-password"
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
          {form.formState.isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-primary">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
