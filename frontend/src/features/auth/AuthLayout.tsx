import type { ReactNode } from "react";
import { Logo } from "../../components/Logo";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-primary px-12 py-16 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-white/10" />
        <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <Logo className="h-10 w-10 text-white" />
          <p className="font-serif text-xl">BookLeaf Author Support</p>
        </div>
        <div className="relative max-w-md">
          <h1 className="font-serif text-4xl leading-tight">Support that keeps the book moving.</h1>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Authors can review their titles and raise a query. The operations team can classify it, draft a reply, and send it when it is ready.
          </p>
        </div>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 text-primary lg:hidden">
            <Logo className="h-10 w-10" />
            <p className="font-serif text-xl text-foreground">BookLeaf Author Support</p>
          </div>
          <h2 className="text-3xl font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-muted">{description}</p>
          {children}
        </div>
      </section>
    </div>
  );
}
