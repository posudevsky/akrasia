import { useState, useRef } from "react";
import { useAnalyzeResume } from "@workspace/api-client-react";
import type { AnalyzeResult } from "@workspace/api-client-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Label } from "./ui/label";
import { useToast } from "@/hooks/use-toast";
import { AppState } from "../App";
import { UploadCloud, FileText, Briefcase, Loader2 } from "lucide-react";

const TEST_VACANCY = `HR-аналитик

Обязанности:
- Сбор, обработка и анализ HR-данных (численность, текучесть, вовлечённость, стоимость найма)
- Подготовка регулярной отчётности для HR-дирекции и бизнеса
- Построение дашбордов и визуализация HR-метрик в Power BI
- Автоматизация отчётности с помощью Power Query и SQL
- Участие во внедрении HR-аналитической платформы
- Работа с данными из 1С:ЗУП

Требования:
- Опыт работы в HR-аналитике от 2 лет
- Уверенное владение Excel (сводные таблицы, Power Query)
- Опыт построения отчётности по HR-метрикам (текучесть, вовлечённость, численность)
- Знание SQL на уровне написания базовых запросов
- Опыт работы с Power BI или Tableau

Будет плюсом:
- Опыт работы в 1С:ЗУП
- Знание основ статистики`;

const TEST_RESUME = `Иванов Иван Иванович
ivan@email.ru | +7 999 123 45 67

ОПЫТ РАБОТЫ

Альфа-Банк, специалист по персоналу, 2022 — настоящее время

- Ежемесячно готовил отчёты по численности и движению персонала в Excel
- Вёл сводные таблицы по затратам на персонал
- Выгружал данные из корпоративной базы данных с помощью SQL-запросов
- Рассчитывал показатели текучести и укомплектованности штата

ОБРАЗОВАНИЕ
НИУ ВШЭ, бакалавр, управление персоналом, 2022

НАВЫКИ
Excel, SQL, PowerPoint`;

interface ScreenUploadProps {
  state: AppState;
  onAnalyzeSuccess: (res: AnalyzeResult, vacancy: string, resume: string) => void;
}

export default function ScreenUpload({ state, onAnalyzeSuccess }: ScreenUploadProps) {
  const [vacancyText, setVacancyText] = useState(state.vacancyText);
  const [resumeText, setResumeText] = useState(state.resumeText);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const analyzeMutation = useAnalyzeResume();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parse-file", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("File parse failed");
      const data = await res.json();
      setResumeText(data.text);
      toast({
        title: "Файл загружен",
        description: "Текст резюме успешно извлечен.",
      });
    } catch (err) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось распознать файл.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAnalyze = () => {
    if (!vacancyText.trim() || !resumeText.trim()) {
      toast({
        title: "Заполните все поля",
        description: "Требуется текст вакансии и резюме.",
        variant: "destructive"
      });
      return;
    }

    analyzeMutation.mutate(
      { data: { vacancyText, resumeText } },
      {
        onSuccess: (data) => {
          onAnalyzeSuccess(data, vacancyText, resumeText);
        },
        onError: () => {
          toast({
            title: "Ошибка анализа",
            description: "Попробуйте еще раз.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-muted-foreground">
          Вставьте вакансию и резюме – система проанализирует соответствие и адаптирует резюме.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-[#F6909B]" />
              Описание вакансии
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="min-h-[300px] resize-none"
              placeholder="Вставьте описание вакансии с hh.ru или другого сайта"
              value={vacancyText}
              onChange={(e) => setVacancyText(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#F6909B]" />
              Ваше резюме
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="text">Текст</TabsTrigger>
                <TabsTrigger value="file">Файл</TabsTrigger>
              </TabsList>
              <TabsContent value="text">
                <Textarea
                  className="min-h-[252px] resize-none"
                  placeholder="Вставьте текст вашего резюме"
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                />
              </TabsContent>
              <TabsContent value="file">
                <div className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg p-8 flex flex-col items-center justify-center text-center min-h-[252px] bg-slate-50 dark:bg-slate-900/50">
                  <UploadCloud className="h-10 w-10 text-slate-400 mb-4" />
                  <Label htmlFor="resume-file" className="cursor-pointer">
                    <span className="bg-white dark:bg-slate-800 px-4 py-2 border rounded-md font-medium hover:bg-slate-50 transition-colors inline-block">
                      Выберите файл (PDF, DOCX)
                    </span>
                    <input
                      id="resume-file"
                      type="file"
                      accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </Label>
                  {isUploading && (
                    <p className="mt-4 text-sm text-slate-500 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Обработка файла...
                    </p>
                  )}
                  {resumeText && !isUploading && (
                    <p className="mt-4 text-sm text-green-600 font-medium">
                      Текст успешно загружен
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-center gap-4 -mt-2">
        <button
          type="button"
          onClick={() => { setVacancyText(TEST_VACANCY); setResumeText(TEST_RESUME); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Вставить тестовые данные
        </button>
        <Button 
          size="lg" 
          onClick={handleAnalyze} 
          disabled={analyzeMutation.isPending || isUploading}
          className="w-full sm:w-auto"
        >
          {analyzeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {analyzeMutation.isPending ? "Анализирую соответствие..." : "Анализировать"}
        </Button>
      </div>
    </div>
  );
}
