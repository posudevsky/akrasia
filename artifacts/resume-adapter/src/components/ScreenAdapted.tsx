import { useMemo, useState } from "react";
import { AppState } from "../App";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Textarea } from "./ui/textarea";
import { Download, FileText, ArrowLeft, Copy, Check, RotateCcw, Pencil, CheckCheck } from "lucide-react";
import { Document, Packer, Paragraph, TextRun } from "docx";

interface ScreenAdaptedProps {
  state: AppState;
  onReset: () => void;
  onBackToAnalysis: () => void;
}

export default function ScreenAdapted({ state, onReset, onBackToAnalysis }: ScreenAdaptedProps) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);

  const originalScore = useMemo(() => {
    const requirements = state.analysisResult?.requirements || [];
    let totalWeight = 0;
    let earnedWeight = 0;
    requirements.forEach(req => {
      const weight = req.criticality === "must" ? 2 : 1;
      totalWeight += weight;
      let score = 0;
      if (req.status === "confirmed") score = 1;
      else if (req.status === "partial") score = 0.5;
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
      if (req.status === "confirmed") score = 1;
      else if (req.status === "partial") score = 1;
      else if (req.status === "missing") {
        const answer = state.userAnswers.find(a => a.requirementId === req.id)?.answer;
        if (answer && answer.trim().length > 0) score = 0.5;
      }
      earnedWeight += weight * score;
    });
    if (totalWeight === 0) return 0;
    return Math.round((earnedWeight / totalWeight) * 100);
  }, [state.analysisResult, state.userAnswers]);

  const rawResume = state.adaptedResume || "";
  const plainTextResume = rawResume.replace(/<\/?change>/g, "").replace(/<\/?addition>/g, "");

  // Text used for copy/download — edited version if available
  const finalText = editedText ?? plainTextResume;

  const handleStartEditing = () => {
    setEditDraft(finalText);
    setIsEditing(true);
  };

  const handleSaveEditing = () => {
    setEditedText(editDraft);
    setIsEditing(false);
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(finalText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = finalText;
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
    const blob = new Blob([finalText], { type: "text/plain;charset=utf-8" });
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
          children: finalText.split("\n").map(line =>
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

  const renderPlainText = (text: string) => {
    const isSectionHeader = (t: string) => {
      const tr = t.trim();
      return tr.length > 1 && tr === tr.toUpperCase() && /[A-ZА-ЯЁ]/.test(tr);
    };
    const toSentenceCase = (t: string) => {
      const words = t.trim().split(/\s+/);
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

    text.split("\n").forEach((line, idx) => {
      const trimmed = line.trim();
      const isEmpty = trimmed === "";
      const isHeader = isSectionHeader(trimmed);

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
        textElements.push(
          <p key={`line-${idx}`} className={`leading-snug mb-0${isName ? " font-bold text-sm" : ""}`}>
            {shouldBullet && <span>– </span>}{trimmed}
          </p>
        );
      }
    });

    return <div className="whitespace-pre-wrap">{textElements}</div>;
  };

  const renderTaggedText = () => {
    if (!state.adaptedResume) return null;

    const parts = state.adaptedResume.split(/(<change>|<\/change>|<addition>|<\/addition>)/);
    type TagType = "change" | "addition" | null;
    let activeTag: TagType = null;
    type Line = { nodes: React.ReactNode[]; text: string };
    const lines: Line[] = [{ nodes: [], text: "" }];
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
        if (subIdx > 0) lines.push({ nodes: [], text: "" });
        const cur = lines[lines.length - 1];
        cur.text += subline;
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
        const nodes: React.ReactNode[] = shouldBullet
          ? [<span key="bullet">– </span>, ...line.nodes]
          : line.nodes;
        textElements.push(
          <p key={`line-${idx}`} className={`leading-snug mb-0${isName ? " font-bold text-sm" : ""}`}>
            {nodes}
          </p>
        );
      }
    });

    return <div className="whitespace-pre-wrap">{textElements}</div>;
  };

  const showHighlights = !editedText && !isEditing;

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
          {showHighlights && (
            <>
              <div className="flex items-center gap-2">
                <span style={{ backgroundColor: "#FEF3C7", borderBottom: "2px solid #D97706" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
                <span className="text-slate-600">переформулировано</span>
              </div>
              <div className="flex items-center gap-2">
                <span style={{ backgroundColor: "#DBEAFE", borderBottom: "2px solid #3B82F6" }} className="px-2 py-0.5 rounded-sm text-slate-700">Аа</span>
                <span className="text-slate-600">добавлено</span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <Button size="sm" onClick={handleSaveEditing}>
              <CheckCheck className="w-4 h-4 mr-2" /> Готово
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleStartEditing}>
              <Pencil className="w-4 h-4 mr-2" /> Редактировать
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopyToClipboard} disabled={isEditing}>
            {copied ? <Check className="w-4 h-4 mr-2 text-green-600" /> : <Copy className="w-4 h-4 mr-2" />}
            {copied ? "Скопировано" : "Скопировать"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTxt} disabled={isEditing}>
            <FileText className="w-4 h-4 mr-2" /> TXT
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadDocx} disabled={isEditing}>
            <FileText className="w-4 h-4 mr-2" /> DOCX
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isEditing}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Resume card */}
      <Card className="shadow-md print:shadow-none print:border-none print:m-0 print:p-0">
        <CardContent className="p-8 text-slate-800 dark:text-slate-200 text-xs leading-snug">
          {isEditing ? (
            <Textarea
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              className="w-full min-h-[600px] font-mono text-xs leading-snug resize-none border-0 p-0 shadow-none focus-visible:ring-0"
              autoFocus
            />
          ) : editedText ? (
            renderPlainText(editedText)
          ) : (
            renderTaggedText()
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 print:hidden">
        <Button variant="outline" onClick={onBackToAnalysis} disabled={isEditing}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Вернуться к анализу
        </Button>
        <Button variant="outline" onClick={onReset} disabled={isEditing}>
          <RotateCcw className="w-4 h-4 mr-2" /> Начать заново
        </Button>
      </div>
    </div>
  );
}
