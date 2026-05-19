import { useState, useMemo } from "react";
import {
  useVerifyAdmin,
  useGetAdminWaitlist,
  useGetAdminUsers,
  useCreateAdminUser,
  useDeleteAdminUser,
  getGetAdminWaitlistQueryKey,
  getGetAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

type SortField = "email" | "createdAt";
type SortDir = "asc" | "desc";

interface WaitlistEntry {
  id: number;
  email: string;
  createdAt: string;
}

interface WaitlistQueryResult {
  data?: { entries: WaitlistEntry[] };
  isLoading: boolean;
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 inline opacity-40" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 h-3.5 w-3.5 inline" />
    : <ArrowDown className="ml-1 h-3.5 w-3.5 inline" />;
}

function WaitlistCard({
  waitlistQuery,
  sortField,
  sortDir,
  onSort,
  copyToClipboard,
}: {
  waitlistQuery: WaitlistQueryResult;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  copyToClipboard: (text: string) => void;
}) {
  const sorted = useMemo(() => {
    const entries = waitlistQuery.data?.entries ?? [];
    return [...entries].sort((a, b) => {
      let cmp = 0;
      if (sortField === "email") cmp = a.email.localeCompare(b.email);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [waitlistQuery.data?.entries, sortField, sortDir]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Список ожидания
          {waitlistQuery.data && (
            <span className="ml-2 text-sm font-normal text-slate-500">({waitlistQuery.data.entries.length})</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {waitlistQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-slate-500 px-6 py-4">Список пуст</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="text-left px-6 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                  <button type="button" onClick={() => onSort("email")} className="flex items-center hover:text-slate-900 dark:hover:text-white">
                    Email <SortIcon field="email" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600 dark:text-slate-400">
                  <button type="button" onClick={() => onSort("createdAt")} className="flex items-center hover:text-slate-900 dark:hover:text-white">
                    Дата <SortIcon field="createdAt" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-6 py-2.5 font-medium">{e.email}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {new Date(e.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                  <td className="px-2 py-2.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-slate-400 hover:text-slate-700"
                      onClick={() => copyToClipboard(e.email)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function AdminContent({ adminPassword, onLogout }: { adminPassword: string; onLogout: () => void }) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const headers = { "x-admin-password": adminPassword };
  const requestOpts = { headers };

  const waitlistQuery = useGetAdminWaitlist({ request: requestOpts });
  const usersQuery = useGetAdminUsers({ request: requestOpts });
  const createUserMutation = useCreateAdminUser({ request: requestOpts });
  const deleteUserMutation = useDeleteAdminUser({ request: requestOpts });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(
      { data: { email: newEmail, password: newPassword } },
      {
        onSuccess: () => {
          setNewEmail("");
          setNewPassword("");
          toast({ title: "Пользователь добавлен" });
          void queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
        },
        onError: (err) => {
          const msg = (err as { data?: { error?: string } }).data?.error ?? "Ошибка";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteUser = (id: number, email: string) => {
    if (!confirm(`Удалить пользователя ${email}?`)) return;
    deleteUserMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Пользователь удалён" });
          void queryClient.invalidateQueries({ queryKey: getGetAdminUsersQueryKey() });
        },
        onError: () => {
          toast({ title: "Ошибка удаления", variant: "destructive" });
        },
      }
    );
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Скопировано" });
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 sm:p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Панель администратора</h2>
        <Button variant="outline" size="sm" onClick={onLogout}>
          Выйти
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Добавить пользователя</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateUser} className="flex flex-col sm:flex-row gap-3">
            <Input
              type="email"
              placeholder="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Input
              type="password"
              placeholder="пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={createUserMutation.isPending}>
              {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Добавить
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Приглашённые пользователи
            {usersQuery.data && (
              <span className="ml-2 text-sm font-normal text-slate-500">({usersQuery.data.users.length})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {usersQuery.isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : usersQuery.data?.users.length === 0 ? (
            <p className="text-sm text-slate-500">Нет пользователей</p>
          ) : (
            <div className="divide-y">
              {usersQuery.data?.users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium">{u.email}</p>
                    <p className="text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString("ru-RU")}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => handleDeleteUser(u.id, u.email)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WaitlistCard
        waitlistQuery={waitlistQuery}
        sortField={sortField}
        sortDir={sortDir}
        onSort={(field) => {
          if (field === sortField) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
          } else {
            setSortField(field);
            setSortDir("asc");
          }
        }}
        copyToClipboard={copyToClipboard}
      />
    </div>
  );
}

export default function AdminPage() {
  const [adminPassword, setAdminPassword] = useState<string | null>(null);
  const [inputPassword, setInputPassword] = useState("");
  const { toast } = useToast();

  const verifyMutation = useVerifyAdmin();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    verifyMutation.mutate(
      { data: { password: inputPassword } },
      {
        onSuccess: () => {
          setAdminPassword(inputPassword);
        },
        onError: () => {
          toast({ title: "Неверный пароль", variant: "destructive" });
        },
      }
    );
  };

  if (!adminPassword) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Панель администратора</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-pass">Пароль администратора</Label>
                <Input
                  id="admin-pass"
                  type="password"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifyMutation.isPending}>
                {verifyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminContent
      key={adminPassword}
      adminPassword={adminPassword}
      onLogout={() => { setAdminPassword(null); setInputPassword(""); }}
    />
  );
}
