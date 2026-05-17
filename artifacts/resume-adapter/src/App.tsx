import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import ScreenUpload from "./components/ScreenUpload";
import ScreenAnalysis from "./components/ScreenAnalysis";
import ScreenAdapted from "./components/ScreenAdapted";
import { AnalyzeResult, UserAnswer } from "@workspace/api-client-react/src/generated/api.schemas";

const queryClient = new QueryClient();

export type AppState = {
  step: "upload" | "analysis" | "adapted";
  vacancyText: string;
  resumeText: string;
  analysisResult: AnalyzeResult | null;
  userAnswers: UserAnswer[];
  adaptedResume: string | null;
};

function AppContent() {
  const [state, setState] = useState<AppState>({
    step: "upload",
    vacancyText: "",
    resumeText: "",
    analysisResult: null,
    userAnswers: [],
    adaptedResume: null,
  });

  const updateState = (updates: Partial<AppState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetState = () => {
    setState({
      step: "upload",
      vacancyText: "",
      resumeText: "",
      analysisResult: null,
      userAnswers: [],
      adaptedResume: null,
    });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 font-sans">
      <header className="border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            акразия<span className="font-normal text-slate-400 dark:text-slate-500">. адаптация резюме к вакансии</span>
          </h1>
        </div>
      </header>
      
      <main className="container mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <AnimatePresence mode="wait">
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
                    resumeText: resu
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
                onAdaptSuccess={(resumeUpdated) =>
                  updateState({ step: "adapted", adaptedResume: resumeUpdated })
                }
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
              />
            </motion.div>
          )}
        </AnimatePresence>
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
