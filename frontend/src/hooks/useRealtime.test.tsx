import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSupportRealtime } from "./useRealtime";

const author = {
  id: "user-1",
  email: "priya.sharma@email.com",
  name: "Priya Sharma",
  role: "AUTHOR" as const,
  authorPublicId: "AUTH001",
};

describe("polling fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips a refresh while one is in flight and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    const client = new QueryClient();
    let release: (() => void) | undefined;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const spy = vi.spyOn(client, "invalidateQueries").mockReturnValue(pending);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { unmount, result } = renderHook(() => useSupportRealtime(author), { wrapper });
    expect(result.current).toBe("polling");
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toMatchObject({ queryKey: ["author"] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    unmount();
    release?.();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});