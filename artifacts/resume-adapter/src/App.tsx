import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import ScreenUpload from "./components/ScreenUpload";
import ScreenAnalysis from "./components/ScreenAnalysis";
import ScreenAdapted from "./components/ScreenAdapted";
import ScreenLogin from "./components/ScreenLogin";
import AdminPage from "./components/AdminPage";
import Sidebar from "./components/Sidebar";
import {
  useGetMe,
  useGetHistoryById,
  getGetMeQueryKey,
  getGetHistoryByIdQueryKey,
} from "@workspace/api-client-react";
import type { AnalyzeResult, UserAnswer, AuthUser, HistoryEntry } from "@workspace/api-client-react";

const queryClient = new QueryClient();

export type AppState = {
  step: "login" | "upload" | "analysis" | "adapted";
  vacancyText: string;
  resumeText: string;
  analysisResult: AnalyzeResult | null;
  userAnswers: UserAnswer[];
  adaptedResume: string | null;
  currentUser: AuthUser | null;
  activeHistoryId: number | null;
  matchScore: number | null;
};

function AppContent() {
  const [state, setState] = useState<AppState>({
    step: "login",
    vacancyText: "",
    resumeText: "",
    analysisResult: null,
    userAnswers: [],
    adaptedResume: null,
    currentUser: null,
    activeHistoryId: null,
    matchScore: null,
  });

  const [pendingHistoryEntry, setPendingHistoryEntry] = useState<HistoryEntry | null>(null);
  const pendingIdRef = useRef<number | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const getMeQuery = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      refetchOnWindowFocus: false,
    },
  });

  const historyByIdQuery = useGetHistoryById(
    pendingHistoryEntry?.id ?? 0,
    {
      query: {
        queryKey: getGetHistoryByIdQueryKey(pendingHistoryEntry?.id ?? 0),
        enabled: !!pendingHistoryEntry,
        retry: false,
        refetchOnWindowFocus: false,
      },
    }
  );

  useEffect(() => {
    if (getMeQuery.data) {
      setState((prev) => ({ ...prev, step: "upload", currentUser: getMeQuery.data }));
    }
  }, [getMeQuery.data]);

  useEffect(() => {
    if (historyByIdQuery.data && pendingHistoryEntry && historyByIdQuery.data.id === pendingIdRef.current) {
      const entry = historyByIdQuery.data;
      setState((prev) => ({
        ...prev,
        step: "adapted",
        vacancyText: entry.vacancyText,
        resumeText: entry.resumeText,
        adaptedResume: entry.adaptedResume,
        analysisResult: null,
        userAnswers: [],
        activeHistoryId: entry.id,
        matchScore: entry.matchScore,
      }));
      setPendingHistoryEntry(null);
      pendingIdRef.current = null;
    }
  }, [historyByIdQuery.data, pendingHistoryEntry]);

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setPendingHistoryEntry(null);
    setState((prev) => ({
      step: "upload",
      vacancyText: "",
      resumeText: "",
      analysisResult: null,
      userAnswers: [],
      adaptedResume: null,
      currentUser: prev.currentUser,
      activeHistoryId: null,
      matchScore: null,
    }));
  };

  const handleLogout = () => {
    setPendingHistoryEntry(null);
    setState({
      step: "login",
      vacancyText: "",
      resumeText: "",
      analysisResult: null,
      userAnswers: [],
      adaptedResume: null,
      currentUser: null,
      activeHistoryId: null,
      matchScore: null,
    });
  };

  const handleHistorySelect = (entry: HistoryEntry) => {
    pendingIdRef.current = entry.id;
    setPendingHistoryEntry(entry);
  };

  const handleHistoryDeleted = (id: number) => {
    if (state.activeHistoryId === id) {
      resetState();
    }
  };

  const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";
  if (isAdmin) {
    return <AdminPage />;
  }

  const showSidebar = state.step !== "login" && !!state.currentUser;

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 font-sans flex">
      {showSidebar && (
        <Sidebar
          currentUser={state.currentUser}
          onNewAdaptation={resetState}
          onHistorySelect={handleHistorySelect}
          onHistoryDeleted={handleHistoryDeleted}
          onLogout={handleLogout}
          activeHistoryId={state.activeHistoryId}
          historyVersion={historyVersion}
        />
      )}

      <main className={`flex-1 min-w-0 ${showSidebar ? "md:pl-0" : ""}`}>
        {/* Mobile top padding to clear the burger button */}
        <div className={showSidebar ? "pt-14 md:pt-0" : ""}>
          <div className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
            <AnimatePresence mode="wait">
              {state.step === "login" && !getMeQuery.isLoading && (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ScreenLogin
                    onLoginSuccess={(user) => updateState({ step: "upload", currentUser: user })}
                  />
                </motion.div>
              )}

              {state.step === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ScreenUpload
                    state={state}
                    onAnalyzeSuccess={(res, vac, resu) =>
                      updateState({
                        step: "analysis",
                        analysisResult: res,
                        vacancyText: vac,
                        resumeText: resu,
                        userAnswers: [],
                      })
                    }
                  />
                </motion.div>
              )}

              {state.step === "analysis" && state.analysisResult && (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ScreenAnalysis
                    state={state}
                    updateState={updateState}
                    onAdaptSuccess={(resumeUpdated, matchScore) =>
                      updateState({ step: "adapted", adaptedResume: resumeUpdated, matchScore, activeHistoryId: null })
                    }
                    onBackToUpload={() => updateState({ step: "upload", userAnswers: [], analysisResult: null, adaptedResume: null })}
                  />
                </motion.div>
              )}

              {state.step === "adapted" && state.adaptedResume && (
                <motion.div
                  key="adapted"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <ScreenAdapted
                    state={state}
                    onReset={resetState}
                    onBackToAnalysis={() => updateState({ step: "analysis", userAnswers: [] })}
                    onSaved={(id) => {
                      updateState({ activeHistoryId: id });
                      setHistoryVersion((v) => v + 1);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
