import { useState } from "react";
import { useLogin, useJoinWaitlist } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { AuthUser } from "@workspace/api-client-react";

interface ScreenLoginProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export default function ScreenLogin({ onLoginSuccess }: ScreenLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(false);
  const { toast } = useToast();

  const loginMutation = useLogin();
  const waitlistMutation = useJoinWaitlist();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (user) => {
          onLoginSuccess(user);
        },
        onError: () => {
          toast({ title: "Ошибка входа", description: "Неверный email или пароль.", variant: "destructive" });
        },
      }
    );
  };

  const handleWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    waitlistMutation.mutate(
      { data: { email: waitlistEmail } },
      {
        onSuccess: () => {
          setWaitlistDone(true);
        },
        onError: () => {
          toast({ title: "Ошибка", description: "Не удалось сохранить email. Попробуйте ещё раз.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Вход</CardTitle>
          <CardDescription>Войдите в свой аккаунт для работы с резюме</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="вы@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Войти
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => { setWaitlistOpen(true); setWaitlistDone(false); setWaitlistEmail(""); }}
              className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-4"
            >
              Регистрация
            </button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={waitlistOpen} onOpenChange={setWaitlistOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Закрытое бета-тестирование</DialogTitle>
            <DialogDescription>
              Сейчас Акразия работает в режиме закрытого бета-тестирования. Оставьте свой email — мы сообщим вам о публичном запуске.
            </DialogDescription>
          </DialogHeader>

          {waitlistDone ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Готово!</p>
              <p className="text-sm text-slate-500">Мы сообщим вам о публичном запуске.</p>
              <Button variant="outline" className="mt-2" onClick={() => setWaitlistOpen(false)}>
                Закрыть
              </Button>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="waitlist-email">Ваш email</Label>
                <Input
                  id="waitlist-email"
                  type="email"
                  placeholder="вы@example.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setWaitlistOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit" className="flex-1" disabled={waitlistMutation.isPending}>
                  {waitlistMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Оставить email
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
