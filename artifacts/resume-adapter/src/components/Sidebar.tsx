import { useState, useEffect } from "react";
import { Menu, X, Plus, LogOut, History, Trash2 } from "lucide-react";
import {
  useGetHistory,
  useLogout,
  useDeleteHistory,
  getGetHistoryQueryKey,
} from "@workspace/api-client-react";
import type { AuthUser, HistoryEntry } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  currentUser: AuthUser | null;
  onNewAdaptation: () => void;
  onHistorySelect: (entry: HistoryEntry) => void;
  onHistoryDeleted: (id: number) => void;
  onLogout: () => void;
  activeHistoryId?: number | null;
  historyVersion?: number;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export default function Sidebar({
  currentUser,
  onNewAdaptation,
  onHistorySelect,
  onHistoryDeleted,
  onLogout,
  activeHistoryId,
  historyVersion = 0,
}: SidebarProps) {
  const [open, setOpen] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const logoutMutation = useLogout();
  const deleteHistoryMutation = useDeleteHistory();

  const historyQuery = useGetHistory({
    query: {
      queryKey: getGetHistoryQueryKey(),
      enabled: !!currentUser,
      refetchOnWindowFocus: false,
    },
  });

  useEffect(() => {
    if (historyVersion > 0) {
      historyQuery.refetch();
    }
  }, [historyVersion]);

  const entries = historyQuery.data?.entries ?? [];

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        onLogout();
      },
    });
  };

  const handleNewAdaptation = () => {
    setOpen(false);
    onNewAdaptation();
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    setOpen(false);
    onHistorySelect(entry);
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (deletingIds.has(id)) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    deleteHistoryMutation.mutate(
      { id },
      {
        onSuccess: () => {
          historyQuery.refetch();
          onHistoryDeleted(id);
        },
        onSettled: () => {
          setDeletingIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        },
      }
    );
  };

  return (
    <>
      {/* Mobile burger button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden flex items-center justify-center w-9 h-9 rounded-md bg-slate-900 text-white shadow-md"
        onClick={() => setOpen((v) => !v)}
        aria-label="Открыть меню"
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 bg-slate-900 text-slate-100 shrink-0",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-4 border-b border-slate-700/60">
          <p className="text-lg font-bold tracking-tight text-white leading-none">акразия.</p>
          <p className="text-xs text-slate-400 mt-1">адаптация резюме к вакансии</p>
        </div>

        {/* Navigation */}
        <div className="px-3 pt-4">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-slate-100 hover:bg-slate-700 hover:text-white font-medium"
            onClick={handleNewAdaptation}
          >
            <Plus className="w-4 h-4" />
            Новая адаптация
          </Button>
        </div>

        {/* History */}
        <div className="flex-1 overflow-y-auto px-3 pt-5 min-h-0">
          <div className="flex items-center gap-2 px-2 mb-2">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">История</span>
          </div>

          {historyQuery.isLoading && (
            <p className="text-xs text-slate-500 px-2 py-2">Загрузка...</p>
          )}

          {!historyQuery.isLoading && entries.length === 0 && (
            <p className="text-xs text-slate-500 px-2 py-2">Адаптаций пока нет</p>
          )}

          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const isDeleting = deletingIds.has(entry.id);
              return (
                <li key={entry.id} className="group relative">
                  <button
                    onClick={() => handleHistorySelect(entry)}
                    disabled={isDeleting}
                    className={cn(
                      "w-full text-left rounded-md px-2 py-2 pr-8 text-sm transition-colors",
                      activeHistoryId === entry.id
                        ? "bg-slate-700 text-white"
                        : "text-slate-300 hover:bg-slate-700/60 hover:text-white",
                      isDeleting && "opacity-50"
                    )}
                  >
                    <p className="truncate leading-snug">
                      {entry.vacancySnippet || "Без названия"}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{formatDate(entry.createdAt)}</span>
                      <span className="text-xs text-slate-500">{entry.matchScore}%</span>
                    </div>
                  </button>

                  <button
                    onClick={(e) => handleDelete(e, entry.id)}
                    disabled={isDeleting}
                    title="Удалить"
                    className={cn(
                      "absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded",
                      "text-slate-600 hover:text-red-400 hover:bg-slate-800",
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      isDeleting && "opacity-50 pointer-events-none"
                    )}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* User info + logout */}
        {currentUser && (
          <div className="border-t border-slate-700/60 px-3 py-3 mt-auto">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 truncate flex-1">{currentUser.email}</span>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-700 shrink-0 h-7 w-7"
                onClick={handleLogout}
                title="Выйти"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
