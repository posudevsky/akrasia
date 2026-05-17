import { useMemo } from "react";
import { AppState } from "../App";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Download, FileText, ArrowLeft } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver"; // Usually we'd use this, but we can just use native Blob

interface ScreenAdaptedProps {
  state: AppState;
  onReset: () => void;
  onBackToAnalysis: () => void;
}

export default function ScreenAdapted({ state, onReset, onBackToAnalysis }: ScreenAdaptedProps) {
  const originalScore = useMemo(() => {
    const requirements = state.analysisResult?.requirements || [];
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
  }, [state.analysisResult]);

  const newScore = useMemo(() => {
    const requirements = state.analysisResult?.requirements || [];
    let totalWeight = 0;
    let earnedWeight = 0;

    requirements.forEach(req => {
      const weight = req.criticality === "must" ? 2 : 1;
      totalWeight += weight;

      let score = 0;
      if (req.status === "confirmed") {
        score = 1;
      } else if (req.status === "partial") {
        score = 1; // Assume partials are fixed by adaptation
      } else if (req.status === "missing") {
        const answer = state.userAnswers.find(a => a.requirementId === req.id)?.answer;
        if (answer && answer.trim().length > 0) {
          score = 0.5; // Answered missing → treated as partial
        }
      }

      earnedWeight += weight * score;
    });

    if (totalWeight === 0) return 0;
    return Math.round((earnedWeight / totalWeight) * 100);
  }, [state.analysisResult, state.userAnswers]);

  const rawResume = state.adaptedResume || "";
  const plainTextResume = rawResume.replace(/<\/?change>/g, "").replace(/<\/?addition>/g, "");

  const handleDownloadTxt = () => {
    const blob = new Blob([plainTextResume], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Resume_Adapted.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    try {
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: plainTextResume.split("\n").map(line => 
              new Paragraph({
                children: [new TextRun(line)],
              })
            ),
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Resume_Adapted.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate docx", err);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  // Parse text to render <change> and <addition> spans with distinct colours
  const renderResumeText = () => {
    if (!state.adaptedResume) return null;

    const parts = state.adaptedResume.split(/(<change>|<\/change>|<addition>|<\/addition>)/);

    type TagType = "change" | "addition" | null;
    let activeTag: TagType = null;
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "<change>") { activeTag = "change"; continue; }
      if (part === "</change>") { activeTag = null; continue; }
      if (part === "<addition>") { activeTag = "addition"; continue; }
      if (part === "</addition>") { activeTag = null; continue; }
      if (!part) continue;

      if (activeTag === "change") {
        elements.push(
          <span key={i} style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-0.5 rounded-sm">
            {part}
          </span>
        );
      } else if (activeTag === "addition") {
        elements.push(
          <span key={i} style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-0.5 rounded-sm">
            {part}
          </span>
        );
      } else {
        elements.push(<span key={i}>{part}</span>);
      }
    }

    // Split by newlines to render paragraphs properly
    const textElements: React.ReactNode[] = [];
    let currentLine: React.ReactNode[] = [];

    elements.forEach((el, index) => {
      if (typeof el === "object" && el !== null && "props" in (el as object)) {
        const node = el as React.ReactElement<{ children: string; className?: string; style?: React.CSSProperties }>;
        const text = node.props.children;
        if (typeof text === "string") {
          const lines = text.split("\n");
          lines.forEach((line, lineIdx) => {
            if (lineIdx > 0) {
              textElements.push(<p key={`p-${index}-${lineIdx}`} className="min-h-[1em] mb-2">{currentLine}</p>);
              currentLine = [];
            }
            currentLine.push(
              <span key={`s-${index}-${lineIdx}`} className={node.props.className} style={node.props.style}>{line}</span>
            );
          });
        } else {
          currentLine.push(el);
        }
      } else {
        currentLine.push(el);
      }
    });

    if (currentLine.length > 0) {
      textElements.push(<p key="last-line" className="min-h-[1em] mb-2">{currentLine}</p>);
    }

    return <div className="whitespace-pre-wrap">{textElements}</div>;
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Адаптированное резюме</h2>
          <p className="text-slate-500 mt-1">Ожидаемое соответствие: <span className="font-medium text-slate-700 dark:text-slate-300">{originalScore}% &rarr; {newScore}%</span></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
            <FileText className="w-4 h-4 mr-2" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadDocx}>
            <FileText className="w-4 h-4 mr-2" /> DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm print:hidden">
        <div className="flex items-center gap-2">
          <span style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
          <span className="text-slate-600">переформулировано из резюме</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
          <span className="text-slate-600">новый контент</span>
        </div>
      </div>

      <Card className="shadow-md print:shadow-none print:border-none print:m-0 print:p-0">
        <CardContent className="p-8 prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
          {renderResumeText()}
        </CardContent>
      </Card>

      <div className="flex justify-between print:hidden pt-4">
        <Button variant="ghost" onClick={onBackToAnalysis} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться к анализу
        </Button>
        <Button variant="ghost" onClick={onReset} className="text-slate-500">
          Начать заново
        </Button>
      </div>
    </div>
  );
}
