import { useState, useMemo } from "react";
import { AppState } from "../App";
import { useAdaptResume } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "./ui/card";
import { Badge } from "./ui/badge";
import { Textarea } from "./ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, AlertCircle, Info, ArrowLeft } from "lucide-react";
import type { Requirement } from "@workspace/api-client-react";
import { motion } from "framer-motion";

interface ScreenAnalysisProps {
  state: AppState;
  updateState: (updates: Partial<AppState>) => void;
  onAdaptSuccess: (resumeUpdated: string) => void;
  onBackToUpload: () => void;
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getScoreMessage(score: number): { heading: string; body: string } {
  const body =
    "Расскажите о недостающем опыте в красных карточках — система использует эту информацию при адаптации резюме. Даже небольшие уточнения могут дать заметный результат. Там где найдено частичное соответствие (жёлтые карточки) — система усилит формулировки в резюме автоматически. Зелёные карточки — требования которые уже подтверждены в вашем резюме.";
  if (score <= 40) {
    return { heading: "Есть над чем поработать", body };
  } else if (score <= 70) {
    return { heading: "Хорошая база", body };
  } else {
    return { heading: "Отличное попадание", body };
  }
}

export default function ScreenAnalysis({ state, updateState, onAdaptSuccess, onBackToUpload }: ScreenAnalysisProps) {
  const { toast } = useToast();
  const adaptMutation = useAdaptResume();
  const requirements = state.analysisResult?.requirements || [];

  const handleAnswerChange = (requirementId: number, answer: string) => {
    const existing = state.userAnswers.find(a => a.requirementId === requirementId);
    let newAnswers;
    if (existing) {
      newAnswers = state.userAnswers.map(a => 
        a.requirementId === requirementId ? { ...a, answer } : a
      );
    } else {
      newAnswers = [...state.userAnswers, { requirementId, answer }];
    }
    updateState({ userAnswers: newAnswers });
  };

  const currentScore = useMemo(() => {
    let totalWeight = 0;
    let earnedWeight = 0;

    requirements.forEach(req => {
      const weight = req.criticality === "must" ? 2 : 1;
      totalWeight += weight;

      let score = 0;
      if (req.status === "confirmed") {
        score = 1;
      } else if (req.status === "partial") {
        score = 0.5;
      }

      earnedWeight += weight * score;
    });

    if (totalWeight === 0) return 0;
    return Math.round((earnedWeight / totalWeight) * 100);
  }, [requirements]);

  const handleAdapt = () => {
    const missingReqs = requirements.filter(r => r.status === "missing");
    const answersToSend = missingReqs.map(req => {
      const ans = state.userAnswers.find(a => a.requirementId === req.id)?.answer || "";
      return { requirementId: req.id, answer: ans };
    });

    adaptMutation.mutate(
      { data: { vacancyText: state.vacancyText, resumeText: state.resumeText, userAnswers: answersToSend } },
      {
        onSuccess: (data) => {
          onAdaptSuccess(data.resumeUpdated);
        },
        onError: () => {
          toast({
            title: "Ошибка адаптации",
            description: "Не удалось адаптировать резюме.",
            variant: "destructive"
          });
        }
      }
    );
  };

  const missingReqs = requirements.filter(r => r.status === "missing");
  const partialReqs = requirements.filter(r => r.status === "partial");
  const confirmedReqs = requirements.filter(r => r.status === "confirmed");

  const scoreMessage = getScoreMessage(currentScore);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-bold text-slate-900">Анализ соответствия резюме вакансии</h1>
      <Card className="bg-white shadow-sm border-blue-100">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-slate-700">{scoreMessage.heading}</p>
              <p className="text-sm text-slate-500 mt-1">{scoreMessage.body}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-extrabold text-blue-600">{currentScore}%</div>
              <div className="w-32">
                <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${currentScore}%`, backgroundColor: "#2563EB" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {missingReqs.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border-red-200 bg-red-50/30 overflow-hidden shadow-sm">
              <div className="h-1 bg-red-500 w-full" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <p className="font-medium text-slate-900 text-sm leading-snug">{capitalizeFirst(req.text)}</p>
                  <div className="flex gap-2 shrink-0">
                    <Badge variant={req.criticality === "must" ? "default" : "secondary"} className={req.criticality === "must" ? "bg-blue-600 hover:bg-blue-700" : ""}>
                      {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                    </Badge>
                    <Badge variant="destructive" className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      отсутствует
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Есть такой опыт? Расскажите кратко — где применяли (компания, проект) или на каком уровне владеете навыком."
                  className="bg-white border-red-100 focus-visible:ring-red-400 text-sm"
                  style={{ height: "60px", minHeight: "60px", resize: "none" }}
                  value={state.userAnswers.find(a => a.requirementId === req.id)?.answer || ""}
                  onChange={(e) => handleAnswerChange(req.id, e.target.value)}
                />
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {partialReqs.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (missingReqs.length + i) * 0.05 }}
          >
            <Card className="border-yellow-200 bg-yellow-50/30 shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-slate-900 text-sm">{capitalizeFirst(req.text)}</p>
                  <p className="text-xs text-yellow-700 mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Будет усилено при адаптации резюме
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge variant={req.criticality === "must" ? "default" : "secondary"} className={req.criticality === "must" ? "bg-blue-600 hover:bg-blue-700" : ""}>
                    {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                    частично соответствует
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {confirmedReqs.map((req, i) => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (missingReqs.length + partialReqs.length + i) * 0.05 }}
          >
            <Card className="border-green-200 bg-green-50/30 shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="font-medium text-slate-900 text-sm flex-1">{capitalizeFirst(req.text)}</p>
                <div className="flex gap-2 shrink-0">
                  <Badge variant={req.criticality === "must" ? "default" : "secondary"} className={req.criticality === "must" ? "bg-blue-600 hover:bg-blue-700" : ""}>
                    {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                  </Badge>
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    подтверждено
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4">
        <Button variant="outline" onClick={onBackToUpload}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться к вставке данных
        </Button>
        <Button
          size="lg"
          onClick={handleAdapt}
          disabled={adaptMutation.isPending}
          className="w-full sm:w-auto"
        >
          {adaptMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {adaptMutation.isPending ? "Адаптирую резюме..." : "Адаптировать резюме"}
        </Button>
      </div>
    </div>
  );
}
