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
  onAdaptSuccess: (resumeUpdated: string, matchScore: number) => void;
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
          onAdaptSuccess(data.resumeUpdated, currentScore);
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
      <h1 className="text-2xl font-bold text-foreground">Анализ соответствия резюме вакансии</h1>
      <Card className="bg-white shadow-sm border-[#E8E0EE]">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-foreground">{scoreMessage.heading}</p>
              <p className="text-sm text-muted-foreground mt-1">{scoreMessage.body}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-extrabold text-[#4A355E]">{currentScore}%</div>
              <div className="w-32">
                <div className="relative h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#E8E0EE" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${currentScore}%`, backgroundColor: "#D9DD55" }}
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
            <Card className="border-[#EDCACF] bg-[#FDF5F6] overflow-hidden shadow-sm">
              <div className="h-1 bg-[#C96875] w-full" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <p className="font-medium text-foreground text-sm leading-snug">{capitalizeFirst(req.text)}</p>
                  <div className="flex gap-2 shrink-0">
                    <Badge className={req.criticality === "must" ? "bg-gray-500 hover:bg-gray-500 text-white border-transparent" : "bg-gray-200 hover:bg-gray-200 text-gray-600 border-transparent"}>
                      {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                    </Badge>
                    <Badge className="flex items-center gap-1 bg-[#C96875] hover:bg-[#b85d6a] text-white border-transparent">
                      <AlertCircle className="w-3 h-3" />
                      отсутствует
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Есть такой опыт? Расскажите кратко — где применяли (компания, проект) или на каком уровне владеете навыком."
                  className="bg-white border-[#EDCACF] focus-visible:ring-[#C96875]/40 text-sm"
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
            <Card className="border-[#E5D5A0] bg-[#FDFAF3] shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{capitalizeFirst(req.text)}</p>
                  <p className="text-xs text-[#8B6D1A] mt-1 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Будет усилено при адаптации резюме
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Badge className={req.criticality === "must" ? "bg-gray-500 hover:bg-gray-500 text-white border-transparent" : "bg-gray-200 hover:bg-gray-200 text-gray-600 border-transparent"}>
                    {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                  </Badge>
                  <Badge variant="outline" className="bg-[#F0E4B0] text-[#7A5C10] border-[#E5D5A0]">
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
            <Card className="border-[#BAD4C2] bg-[#F4FAF6] shadow-sm">
              <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <p className="font-medium text-foreground text-sm flex-1">{capitalizeFirst(req.text)}</p>
                <div className="flex gap-2 shrink-0">
                  <Badge className={req.criticality === "must" ? "bg-gray-500 hover:bg-gray-500 text-white border-transparent" : "bg-gray-200 hover:bg-gray-200 text-gray-600 border-transparent"}>
                    {req.criticality === "must" ? "обязательное требование" : "желательное требование"}
                  </Badge>
                  <Badge variant="outline" className="bg-[#D4EADB] text-[#2D6644] border-[#BAD4C2] flex items-center gap-1">
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
