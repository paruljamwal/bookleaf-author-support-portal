import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Role } from "@bookleaf/shared";
import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { ToastProvider } from "./components/toast";
import { ErrorState, PageSkeleton } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";

const Shell = lazy(() => import("./components/Shell"));

const LoginPage = lazy(() => import("./features/auth/LoginPage"));
const RegisterPage = lazy(() => import("./features/auth/RegisterPage"));
const AuthorDashboardPage = lazy(() => import("./features/author/DashboardPage"));
const BooksPage = lazy(() => import("./features/author/BooksPage"));
const TicketsPage = lazy(() => import("./features/author/TicketsPage"));
const NewTicketPage = lazy(() => import("./features/author/NewTicketPage"));
const AuthorTicketPage = lazy(() => import("./features/author/TicketDetailPage"));
const AdminDashboardPage = lazy(() => import("./features/admin/DashboardPage"));
const QueuePage = lazy(() => import("./features/admin/QueuePage"));
const AdminTicketPage = lazy(() => import("./features/admin/TicketDetailPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <Suspense fallback={<PageSkeleton />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route path="/register" element={<RegisterRoute />} />
              <Route path="/signup" element={<RegisterRoute />} />
              <Route element={<RequireAuth role="AUTHOR" />}>
                <Route
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Shell />
                    </Suspense>
                  }
                >
                  <Route path="/author" element={<AuthorDashboardPage />} />
                  <Route path="/author/books" element={<BooksPage />} />
                  <Route path="/author/tickets" element={<TicketsPage />} />
                  <Route path="/author/tickets/new" element={<NewTicketPage />} />
                  <Route path="/author/tickets/:ticketId" element={<AuthorTicketPage />} />
                </Route>
              </Route>
              <Route element={<RequireAuth role="ADMIN" />}>
                <Route
                  element={
                    <Suspense fallback={<PageSkeleton />}>
                      <Shell />
                    </Suspense>
                  }
                >
                  <Route path="/admin" element={<AdminDashboardPage />} />
                  <Route path="/admin/tickets" element={<QueuePage />} />
                  <Route path="/admin/tickets/:ticketId" element={<AdminTicketPage />} />
                </Route>
              </Route>
              <Route path="/" element={<HomeRedirect />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RequireAuth({ role }: { role: Role }) {
  const { user, isLoading, isError, refetch } = useAuth();
  if (isLoading) return <PageSkeleton />;
  if (isError) {
    return (
      <div className="p-6">
        <ErrorState message="The session could not be checked." onRetry={refetch} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/author"} replace />;
  return <Outlet />;
}

function RegisterRoute() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RegisterPage />
    </Suspense>
  );
}

function NotFoundPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted">That address is not part of BookLeaf Author Support.</p>
      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-primary">
        Go to sign in
      </Link>
    </main>
  );
}

function HomeRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <PageSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/author"} replace />;
}
