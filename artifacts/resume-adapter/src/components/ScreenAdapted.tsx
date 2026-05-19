import { useMemo, useState } from "react";
import { AppState } from "../App";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Download, FileText, ArrowLeft, Copy, Check, RotateCcw } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";

interface ScreenAdaptedProps {
  state: AppState;
  onReset: () => void;
  onBackToAnalysis: () => void;
}

export default function ScreenAdapted({ state, onReset, onBackToAnalysis }: ScreenAdaptedProps) {
  const [copied, setCopied] = useState(false);

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
        score = 1;
      } else if (req.status === "missing") {
        const answer = state.userAnswers.find(a => a.requirementId === req.id)?.answer;
        if (answer && answer.trim().length > 0) {
          score = 0.5;
        }
      }

      earnedWeight += weight * score;
    });

    if (totalWeight === 0) return 0;
    return Math.round((earnedWeight / totalWeight) * 100);
  }, [state.analysisResult, state.userAnswers]);

  const rawResume = state.adaptedResume || "";
  const plainTextResume = rawResume.replace(/<\/?change>/g, "").replace(/<\/?addition>/g, "");

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(plainTextResume);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = plainTextResume;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
        sections: [{
          properties: {},
          children: plainTextResume.split("\n").map(line =>
            new Paragraph({ children: [new TextRun(line)] })
          ),
        }],
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

    type Line = { nodes: React.ReactNode[]; text: string; lineTag: TagType | "mixed" };
    const lines: Line[] = [{ nodes: [], text: "", lineTag: null }];
    let nodeIdx = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "<change>") { activeTag = "change"; continue; }
      if (part === "</change>") { activeTag = null; continue; }
      if (part === "<addition>") { activeTag = "addition"; continue; }
      if (part === "</addition>") { activeTag = null; continue; }
      if (!part) continue;

      const sublines = part.split("\n");
      sublines.forEach((subline, subIdx) => {
        if (subIdx > 0) lines.push({ nodes: [], text: "", lineTag: null });
        const cur = lines[lines.length - 1];
        cur.text += subline;
        if (activeTag && subline) {
          if (cur.lineTag === null) cur.lineTag = activeTag;
          else if (cur.lineTag !== activeTag) cur.lineTag = "mixed";
        }
        if (activeTag === "change") {
          cur.nodes.push(
            <span key={`n-${nodeIdx++}`} style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-0.5 rounded-sm">
              {subline}
            </span>
          );
        } else if (activeTag === "addition") {
          cur.nodes.push(
            <span key={`n-${nodeIdx++}`} style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-0.5 rounded-sm">
              {subline}
            </span>
          );
        } else if (subline) {
          cur.nodes.push(<span key={`n-${nodeIdx++}`}>{subline}</span>);
        }
      });
    }

    const isSectionHeader = (text: string) => {
      const t = text.trim();
      return t.length > 1 && t === t.toUpperCase() && /[A-ZА-ЯЁ]/.test(t);
    };

    const toSentenceCase = (text: string) => {
      const words = text.trim().split(/\s+/);
      return words.map((word, idx) => {
        if (/^[A-Z0-9]+$/.test(word)) return word;
        return idx === 0
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : word.toLowerCase();
      }).join(" ");
    };

    const textElements: React.ReactNode[] = [];
    let firstNonEmptySeen = false;
    let inSection = false;
    lines.forEach((line, idx) => {
      const isHeader = isSectionHeader(line.text);
      const isEmpty = line.text.trim() === "";
      const trimmed = line.text.trim();

      if (isEmpty) {
        textElements.push(<div key={`line-${idx}`} className="h-2" />);
      } else if (isHeader) {
        inSection = true;
        const isName = !firstNonEmptySeen;
        firstNonEmptySeen = true;
        textElements.push(
          <p key={`line-${idx}`} className={`font-bold leading-snug mb-0${isName ? " text-sm" : ""}`}>
            {toSentenceCase(trimmed)}
          </p>
        );
      } else {
        const isName = !firstNonEmptySeen;
        firstNonEmptySeen = true;
        const alreadyBulleted = /^[•\-–—*·]/.test(trimmed);
        const isTitleLine = / \| /.test(trimmed) || /\b(19|20)\d{2}\b/.test(trimmed);
        const shouldBullet = inSection && !isTitleLine && !alreadyBulleted;
        const bulletNode = (() => {
          if (!shouldBullet) return null;
          if (line.lineTag === "addition")
            return <span key="bullet" style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-0.5 rounded-sm">– </span>;
          if (line.lineTag === "change")
            return <span key="bullet" style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-0.5 rounded-sm">– </span>;
          return <span key="bullet">– </span>;
        })();
        const nodes: React.ReactNode[] = bulletNode ? [bulletNode, ...line.nodes] : line.nodes;
        textElements.push(
          <p key={`line-${idx}`} className={`leading-snug mb-0${isName ? " font-bold text-sm" : ""}`}>
            {nodes}
          </p>
        );
      }
    });

    return <div className="whitespace-pre-wrap">{textElements}</div>;
  };

  return (
    <div className="grid gap-4">
      {/* Header */}
      <div className="print:hidden">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Адаптированное резюме</h2>
        <p className="text-slate-500 mt-1">
          Соответствие вакансии:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {originalScore}% &rarr; {newScore}%
          </span>
        </p>
      </div>

      {/* Legend + action buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
            <span className="text-slate-600">переформулировано</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
            <span className="text-slate-600">добавлено</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyToClipboard}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Скопировано" : "Скопировать"}
          </Button>
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

      {/* Resume card */}
      <Card className="shadow-md print:shadow-none print:border-none print:m-0 print:p-0">
        <CardContent className="p-8 text-slate-800 dark:text-slate-200 text-xs leading-snug">
          {renderResumeText()}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 print:hidden">
        <Button variant="outline" onClick={onBackToAnalysis}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться к анализу
        </Button>
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="w-4 h-4 mr-2" /> Начать заново
        </Button>
      </div>
    </div>
  );
}
