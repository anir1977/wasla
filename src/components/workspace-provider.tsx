"use client";
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import type { Workspace } from "@/lib/types";
import { browserClient } from "@/lib/supabase/client";
const Context = createContext<{
  data: Workspace;
  setData: React.Dispatch<React.SetStateAction<Workspace>>;
  refresh: () => Promise<void>;
} | null>(null);
export function WorkspaceProvider({
  initial,
  children,
}: {
  initial: Workspace;
  children: React.ReactNode;
}) {
  const [data, setData] = useState(initial);
  const refresh = useCallback(async () => {
    if (initial.demo) return;
    const response = await fetch("/api/workspace", { cache: "no-store" });
    if (response.ok) setData(await response.json());
  }, [initial.demo]);
  useEffect(() => {
    if (initial.demo) return;
    const client = browserClient();
    let timer: ReturnType<typeof setTimeout>;
    const queue = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 200);
    };
    const channel = client
      .channel("workspace-" + initial.store.id)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: "store_id=eq." + initial.store.id,
        },
        queue,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
          filter: "store_id=eq." + initial.store.id,
        },
        queue,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "product_variants",
          filter: "store_id=eq." + initial.store.id,
        },
        queue,
      )
      .subscribe();
    const interval = setInterval(() => void refresh(), 30000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      void client.removeChannel(channel);
    };
  }, [initial.demo, initial.store.id, refresh]);
  return (
    <Context.Provider value={{ data, setData, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing workspace");
  return value;
}
