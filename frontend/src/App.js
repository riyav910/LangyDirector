import React, { useState, useEffect } from "react";
import {
  Film, MessageSquare, User, Trash2, Play, Zap, FileText, Download
} from "lucide-react";
import jsPDF from "jspdf";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinema");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [operationMode, setOperationMode] = useState("manual");

  // -------------------------------------------------------
  // Load session + story if user refreshed
  // -------------------------------------------------------
  useEffect(() => {
    const savedSession = localStorage.getItem("sessionId");
    const savedState = localStorage.getItem("storyState");

    if (savedSession && savedState) {
      setSessionId(savedSession);
      setState(JSON.parse(savedState));
    }
  }, []);

  // -------------------------------------------------------
  // Download PDF
  // -------------------------------------------------------
  function downloadPDF() {
    if (!state) return;

    const doc = new jsPDF();
    let y = 10;

    const addText = (title, text) => {
      doc.setFontSize(16);
      doc.text(title, 10, y);
      y += 8;

      const lines = doc.splitTextToSize(text || "No data", 180);
      doc.setFontSize(12);
      lines.forEach((line) => {
        doc.text(line, 10, y);
        y += 6;
        if (y >= 280) {
          doc.addPage();
          y = 10;
        }
      });

      y += 10;
    };

    addText("Character Sheet", state.character_sheet);
    addText("Outline", state.outline_text || state.outline);

    (state.scenes || []).forEach((scene, i) => addText(`Scene ${i + 1}`, scene));
    (state.dialogues || []).forEach((dialogue, i) => addText(`Dialogue ${i + 1}`, dialogue));

    doc.save("AI_Director_Story.pdf");
  }

  // -------------------------------------------------------
  // Start Story (creates session silently)
  // -------------------------------------------------------
  async function startStory() {
    if (!characterDescription.trim()) {
      alert("Please describe your character first.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          story_mode: mode,
          initial_character_description: characterDescription,
        }),
      });

      if (!res.ok) throw new Error("Failed to start session");

      const data = await res.json();

      setSessionId(data.session_id);
      setState(data.state);

      // SAVE to localStorage
      localStorage.setItem("sessionId", data.session_id);
      localStorage.setItem("storyState", JSON.stringify(data.state));

      // Auto mode → generate full story immediately
      if (operationMode === "auto") {
        await generateFull(data.session_id);
      }
    } catch (err) {
      alert("Error starting story: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // Manual Step
  // -------------------------------------------------------
  async function runStep(step) {
    if (!sessionId) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/session/${sessionId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.status);
      }

      const data = await res.json();
      const newState = data.state || data;

      setState(newState);
      localStorage.setItem("storyState", JSON.stringify(newState));
    } catch (err) {
      alert("Error running step: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // Auto Full Story Generation
  // -------------------------------------------------------
  async function generateFull(id = sessionId) {
    if (!id) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/session/${id}/generate_full`, { method: "POST" });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.status);
      }

      const data = await res.json();
      const newState = data.state || data;

      setState(newState);
      localStorage.setItem("storyState", JSON.stringify(newState));
    } catch (err) {
      alert("Error generating story: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------
  // Delete Session
  // -------------------------------------------------------
  async function deleteSession() {
    if (!sessionId) return;
    try {
      await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" });
    } catch (e) {
      console.error("Cleanup failed", e);
    }

    setSessionId(null);
    setState(null);
    setCharacterDescription("");
    localStorage.removeItem("sessionId");
    localStorage.removeItem("storyState");
  }

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans selection:bg-blue-500/30 selection:text-blue-200">
      <div className="max-w-5xl mx-auto p-6 md:p-8">

        {/* ================= HEADER ================= */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 border-b border-gray-800 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Langy<span className="text-blue-500">Director</span>
            </h1>
            <p className="text-gray-400 text-sm mt-1 tracking-wide">AI-POWERED STORYTELLING ENGINE</p>
          </div>

          {state && (
            <button
              onClick={downloadPDF}
              className="group flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-200 px-4 py-2.5 rounded-lg transition-all shadow-lg"
            >
              <Download size={18} className="text-blue-400 group-hover:scale-110 transition-transform" />
              <span className="font-medium">Export PDF</span>
            </button>
          )}
        </header>

        {/* ================= USER INPUT STAGE ================= */}
        {!sessionId && (
          <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden">
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-8 flex items-center gap-3 text-white tracking-tight">
                <div className="p-2 bg-gray-700/50 rounded-lg">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                New Project Setup
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Narrative Style */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider">Narrative Style</label>
                  <div className="relative">
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value)}
                      className="w-full bg-gray-900 text-gray-100 border border-gray-600 rounded-lg px-4 py-3 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    >
                      <option value="cinema">Cinema</option>
                      <option value="comedy">Comedy</option>
                      <option value="comic">Comic</option>
                      <option value="drama">Drama</option>
                      <option value="horror">Horror</option>
                      <option value="novel">Novel</option>
                      <option value="romance">Romance</option>
                      <option value="thriller">Thriller</option>
                    </select>
                  </div>
                </div>

                {/* Workflow Mode */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider">Workflow</label>
                  <select
                    value={operationMode}
                    onChange={(e) => setOperationMode(e.target.value)}
                    className="w-full bg-gray-900 text-gray-100 border border-gray-600 rounded-lg px-4 py-3 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  >
                    <option value="manual">Manual Director (Step-by-Step)</option>
                    <option value="auto">Auto-Pilot (Full Generation)</option>
                  </select>
                </div>
              </div>

              {/* Premise Input */}
              <div className="mb-8 space-y-2">
                <label className="block text-sm font-semibold text-gray-400 uppercase tracking-wider">Protagonist & Premise</label>
                <textarea
                  placeholder="e.g. A retired space pirate who transports a sentient plant across the galaxy, only to discover the plant is the heir to a fallen empire..."
                  value={characterDescription}
                  onChange={(e) => setCharacterDescription(e.target.value)}
                  rows={5}
                  className="w-full bg-gray-900 text-gray-100 border border-gray-600 rounded-lg p-4 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600 leading-relaxed"
                />
              </div>

              <button
                onClick={startStory}
                disabled={loading}
                className={`w-full py-4 rounded-xl font-bold text-lg tracking-wide transition-all duration-200 shadow-lg ${loading
                    ? "bg-gray-700 cursor-not-allowed text-gray-500"
                    : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/20 text-white active:scale-[0.99]"
                  }`}
              >
                {loading ? "Initializing Production..." : "Start Production"}
              </button>
            </div>
          </div>
        )}

        {/* ================= CONTROLS ================= */}
        {sessionId && (
          <div className="sticky top-4 z-50 bg-gray-900/95 backdrop-blur-xl p-4 rounded-xl border border-gray-800 shadow-2xl mb-12 ring-1 ring-white/5">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">

              {operationMode === "manual" ? (
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
                  <ControlButton
                    onClick={() => runStep("character")}
                    disabled={loading}
                    icon={<User size={18} />}
                    label="Character"
                    color="blue"
                  />
                  <div className="h-8 w-px bg-gray-800 mx-1 hidden md:block"></div>
                  <ControlButton
                    onClick={() => runStep("outline")}
                    disabled={loading}
                    icon={<FileText size={18} />}
                    label="Outline"
                    color="green"
                  />
                  <div className="h-8 w-px bg-gray-800 mx-1 hidden md:block"></div>
                  <ControlButton
                    onClick={() => runStep("scenes")}
                    disabled={loading}
                    icon={<Film size={18} />}
                    label="Scenes"
                    color="purple"
                  />
                  <div className="h-8 w-px bg-gray-800 mx-1 hidden md:block"></div>
                  <ControlButton
                    onClick={() => runStep("dialogue")}
                    disabled={loading}
                    icon={<MessageSquare size={18} />}
                    label="Dialogue"
                    color="yellow"
                  />
                </div>
              ) : (
                <button
                  onClick={() => generateFull(sessionId)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-900/20"
                >
                  <Play size={20} fill="currentColor" />
                  {loading ? "Generating Story..." : "Regenerate Full Story"}
                </button>
              )}

              <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-gray-800 pt-3 md:pt-0">
                {loading && (
                  <span className="flex items-center gap-2 text-yellow-400 text-sm font-medium animate-pulse">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                    AI Processing...
                  </span>
                )}

                <button
                  onClick={deleteSession}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= RESULTS DISPLAY ================= */}
        {state && (
          <div className="space-y-16 pb-20">

            {/* 1. Character Sheet */}
            {state.character_sheet && (
              <ResultSection title="Character Profile" color="text-blue-400" icon={<User className="w-6 h-6" />}>
                <FormattedOutput content={state.character_sheet} />
              </ResultSection>
            )}

            {/* 2. Outline */}
            {(state.outline_text || state.outline) && (
              <ResultSection title="Story Outline" color="text-green-400" icon={<FileText className="w-6 h-6" />}>
                <FormattedOutput content={state.outline_text || state.outline} />
              </ResultSection>
            )}

            {/* 3. Scenes */}
            {state.scenes && state.scenes.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Film className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-purple-400 tracking-tight">Scene Breakdown</h3>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  {state.scenes.map((scene, i) => (
                    <div key={i} className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-xl">
                      <div className="bg-gray-900/50 px-6 py-3 border-b border-gray-700 flex justify-between items-center">
                        <h4 className="font-bold text-gray-400 text-xs uppercase tracking-widest">Scene {i + 1}</h4>
                      </div>
                      <div className="p-6">
                        <FormattedOutput content={scene} isCard={true} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Dialogues */}
            {state.dialogues && state.dialogues.length > 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <div className="p-2 bg-yellow-500/10 rounded-lg">
                    <MessageSquare className="w-6 h-6 text-yellow-400" />
                  </div>
                  <h3 className="text-2xl font-bold text-yellow-400 tracking-tight">Script & Dialogue</h3>
                </div>
                <div className="space-y-8">
                  {state.dialogues.map((dialogue, i) => (
                    <div key={i} className="bg-gray-800/50 rounded-xl border border-gray-700/50 border-l-4 border-l-yellow-500 shadow-lg overflow-hidden">
                      <div className="bg-yellow-500/5 px-6 py-3 border-b border-gray-700/50">
                        <h4 className="font-bold text-yellow-500/90 text-xs uppercase tracking-widest">Sequence {i + 1}</h4>
                      </div>
                      <div className="p-6">
                        <FormattedOutput content={dialogue} isCard={true} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ================= HELPER COMPONENTS =================

function ControlButton({ onClick, disabled, icon, label, color }) {
  // Mapping colors to Tailwind classes
  const styles = {
    blue: "bg-blue-600 hover:bg-blue-500 shadow-blue-900/20",
    green: "bg-green-600 hover:bg-green-500 shadow-green-900/20",
    purple: "bg-purple-600 hover:bg-purple-500 shadow-purple-900/20",
    yellow: "bg-yellow-600 hover:bg-yellow-500 shadow-yellow-900/20 text-gray-900", // Dark text for yellow
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${styles[color]} 
        px-4 py-2.5 rounded-lg text-white font-medium text-sm
        flex items-center gap-2 
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        transition-all shadow-lg active:scale-95 whitespace-nowrap
      `}
    >
      {icon} {label}
    </button>
  );
}

function ResultSection({ title, color, icon, children }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center gap-3 mb-5 border-b border-gray-800 pb-2">
        <div className={`p-2 rounded-lg bg-gray-800 border border-gray-700`}>
          <span className={color}>{icon}</span>
        </div>
        <h3 className={`text-2xl font-bold ${color} tracking-tight`}>{title}</h3>
      </div>
      <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
        {children}
      </div>
    </div>
  );
}

function FormattedOutput({ content, isCard = false }) {
  // If it's inside a card (like scene/dialogue), we remove the background to avoid nested boxes
  const containerClass = isCard
    ? "whitespace-pre-wrap font-mono text-gray-300 text-sm leading-relaxed"
    : "whitespace-pre-wrap font-mono text-gray-300 text-sm leading-relaxed bg-gray-950/30 p-5 rounded-lg border border-gray-700/50";

  return (
    <pre className={containerClass}>
      {content}
    </pre>
  );
}