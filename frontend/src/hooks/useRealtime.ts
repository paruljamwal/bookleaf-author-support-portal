import { useQueryClient } from "@tanstack/react-query";
import type { AuthUser } from "@bookleaf/shared";
import { useEffect, useState } from "react";
import type Pusher from "pusher-js";
import { api } from "../lib/api";

export type RealtimeMode = "live" | "polling" | "reconnecting";

export function useSupportRealtime(user: AuthUser | null): RealtimeMode {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<RealtimeMode>("polling");
  const userId = user?.id ?? null;
  const role = user?.role ?? null;
  const authorPublicId = user?.authorPublicId ?? null;

  useEffect(() => {
    if (!userId || !role) return;
    let refreshInFlight = false;
    const invalidate = () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      const pending =
        role === "ADMIN"
          ? queryClient.invalidateQueries({ queryKey: ["admin"] })
          : queryClient.invalidateQueries({
              queryKey: ["author"],
              predicate: (query) => query.queryKey[1] !== "books",
            });
      void Promise.resolve(pending).finally(() => {
        refreshInFlight = false;
      });
    };
    let timer: number | undefined;
    const startPolling = () => {
      if (timer) return;
      timer = window.setInterval(invalidate, 8_000);
    };
    const stopPolling = () => {
      if (!timer) return;
      window.clearInterval(timer);
      timer = undefined;
    };

    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
    if (!key || !cluster) {
      setMode("polling");
      startPolling();
      return () => stopPolling();
    }

    let cancelled = false;
    let client: Pusher | undefined;
    let cleanup = () => {
      stopPolling();
      client?.disconnect();
    };
    void (async () => {
      const { default: Pusher } = await import("pusher-js");
      if (cancelled) return;
      client = new Pusher(key, {
        cluster,
        authorizer: (channel) => ({
          authorize: (socketId, callback) => {
            void api
              .post<{ auth: string }>("/realtime/auth", { socket_id: socketId, channel_name: channel.name })
              .then((response) => callback(null, response.data))
              .catch((error: Error) => callback(error, null));
          },
        }),
      });
      if (cancelled) {
        client.disconnect();
        return;
      }
      const pusher = client;
      const channelName = role === "ADMIN" ? "private-admin" : `private-author-${authorPublicId ?? ""}`;
      const channel = pusher.subscribe(channelName);
      channel.bind("ticket.created", invalidate);
      channel.bind("ticket.updated", invalidate);
      channel.bind("ticket.reply.added", invalidate);
      if (role === "ADMIN") channel.bind("ticket.note.added", invalidate);

      const onConnected = () => {
        if (cancelled) return;
        setMode("live");
        stopPolling();
      };
      const onDrop = () => {
        if (cancelled) return;
        setMode("reconnecting");
        startPolling();
      };
      pusher.connection.bind("connected", onConnected);
      pusher.connection.bind("unavailable", onDrop);
      pusher.connection.bind("disconnected", onDrop);
      cleanup = () => {
        channel.unbind_all();
        pusher.unsubscribe(channelName);
        pusher.connection.unbind("connected", onConnected);
        pusher.connection.unbind("unavailable", onDrop);
        pusher.connection.unbind("disconnected", onDrop);
        pusher.disconnect();
        stopPolling();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [authorPublicId, queryClient, role, userId]);

  return user ? mode : "polling";
}
