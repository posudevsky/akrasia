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
}

export default function ScreenAdapted({ state, onReset }: ScreenAdaptedProps) {
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
  const plainTextResume = rawResume.replace(/<\/?change>/g, "");

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

  // Parse text to render <change> spans
  const renderResumeText = () => {
    if (!state.adaptedResume) return null;
    const parts = state.adaptedResume.split(/(<change>|<\/change>)/);
    
    let isChanged = false;
    const elements = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "<change>") {
        isChanged = true;
      } else if (part === "</change>") {
        isChanged = false;
      } else if (part) {
        if (isChanged) {
          elements.push(
            <span key={i} className="bg-amber-100 dark:bg-amber-900/40 border-b-2 border-amber-500 px-1 py-0.5 rounded-sm">
              {part}
            </span>
          );
        } else {
          elements.push(<span key={i}>{part}</span>);
        }
      }
    }
    
    // Split by newlines to render paragraphs properly
    const textElements = [];
    let currentLine: React.ReactNode[] = [];
    
    elements.forEach((el, index) => {
      if (typeof el === 'object' && el.props && typeof el.props.children === 'string') {
        const lines = el.props.children.split('\n');
        lines.forEach((line: string, lineIdx: number) => {
          if (lineIdx > 0) {
            textElements.push(<p key={`p-${index}-${lineIdx}`} className="min-h-[1em] mb-2">{currentLine}</p>);
            currentLine = [];
          }
          currentLine.push(<span key={`span-${index}-${lineIdx}`} className={el.props.className}>{line}</span>);
        });
      } else if (typeof el === 'object' && el.type === 'span' && typeof el.props.children === 'string') {
         // Plain text span
         const lines = el.props.children.split('\n');
         lines.forEach((line: string, lineIdx: number) => {
           if (lineIdx > 0) {
             textElements.push(<p key={`p-${index}-${lineIdx}`} className="min-h-[1em] mb-2">{currentLine}</p>);
             currentLine = [];
           }
           currentLine.push(<span key={`span-${index}-${lineIdx}`}>{line}</span>);
         });
      } else if (typeof el === 'string') {
        const lines = el.split('\n');
        lines.forEach((line, lineIdx) => {
          if (lineIdx > 0) {
            textElements.push(<p key={`p-str-${index}-${lineIdx}`} className="min-h-[1em] mb-2">{currentLine}</p>);
            currentLine = [];
          }
          currentLine.push(line);
        });
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

      <Card className="shadow-md print:shadow-none print:border-none print:m-0 print:p-0">
        <CardContent className="p-8 prose dark:prose-invert max-w-none text-slate-800 dark:text-slate-200">
          {renderResumeText()}
        </CardContent>
      </Card>

      <div className="flex justify-start print:hidden pt-4">
        <Button variant="ghost" onClick={onReset} className="text-slate-500">
          <ArrowLeft className="w-4 h-4 mr-2" /> Начать заново
        </Button>
      </div>
    </div>
  );
}
