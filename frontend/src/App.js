import React, { useState } from "react";
import { Film, MessageSquare, User, Trash2, Play, Zap, FileText } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinematic");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [operationMode, setOperationMode] = useState("manual");

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

      // Auto mode → immediately generate full story
      // This handles the automatic workflow trigger
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
      setState(data.state || data);
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
      const res = await fetch(`${API_BASE}/session/${id}/generate_full`, {
        method: "POST",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || res.status);
      }

      const data = await res.json();
      setState(data.state || data);
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
      console.error("Logout cleanup failed", e);
    }
    setSessionId(null);
    setState(null);
    setCharacterDescription("");
  }

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto p-6">

        {/* HEADER */}
        <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-500">
            AI <span className="text-white">Director</span>
          </h1>
          {sessionId && (
            <div className="px-3 py-1 bg-gray-800 rounded-full text-xs text-gray-400 font-mono">
              ID: {sessionId.slice(0, 8)}...
            </div>
          )}
        </header>

        {/* ----------- USER INPUT STAGE ------------ */}
        {!sessionId && (
          <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              New Project Setup
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Narrative Style</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                >
                  <option value="cinematic">Cinematic (Movie Script)</option>
                  <option value="comic">Comic Book (Visual Panels)</option>
                  <option value="novel">Novel (Prose)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Workflow</label>
                <select
                  value={operationMode}
                  onChange={(e) => setOperationMode(e.target.value)}
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                >
                  <option value="manual">Manual Director (Step-by-Step)</option>
                  <option value="auto">Auto-Pilot (One Click)</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Protagonist & Premise</label>
              <textarea
                placeholder="e.g. A retired space pirate who is forced to smuggle a sentient plant across the galaxy..."
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg p-4 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all resize-none"
              />
            </div>

            <button
              onClick={startStory}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${loading
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/50"
                }`}
            >
              {loading ? "Initializing..." : "Start Production"}
            </button>
          </div>
        )}

        {/* ----------- CONTROLS ------------ */}
        {sessionId && (
          <div className="sticky top-4 z-10 bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow-2xl mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">

              {/* Conditional Rendering for Manual vs Auto controls */}
              {operationMode === "manual" ? (
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                  <ControlButton
                    onClick={() => runStep("character")}
                    disabled={loading}
                    icon={<User size={16} />}
                    label="Character"
                    color="blue"
                  />
                  <ControlButton
                    onClick={() => runStep("outline")}
                    disabled={loading}
                    icon={<FileText size={16} />}
                    label="Outline"
                    color="green"
                  />
                  <ControlButton
                    onClick={() => runStep("scenes")}
                    disabled={loading}
                    icon={<Film size={16} />}
                    label="Scenes"
                    color="purple"
                  />
                  <ControlButton
                    onClick={() => runStep("dialogue")}
                    disabled={loading}
                    icon={<MessageSquare size={16} />}
                    label="Dialogue"
                    color="yellow"
                  />
                </div>
              ) : (
                <button
                  onClick={() => generateFull(sessionId)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50 transition-all"
                >
                  <Play size={18} /> Regenerate Full Story
                </button>
              )}

              <div className="flex items-center gap-4">
                {loading && <span className="text-yellow-400 animate-pulse text-sm font-medium">AI is writing...</span>}

                <button
                  onClick={deleteSession}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/30 px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={16} /> Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ----------- RESULTS DISPLAY ------------ */}
        {state && (
          <div className="space-y-12 pb-20">

            {/* 1. Character Sheet */}
            {state.character_sheet && (
              <ResultSection title="Character Profile" color="text-blue-400" icon={<User />}>
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed">
                  {state.character_sheet}
                </pre>
              </ResultSection>
            )}

            {/* 2. Outline */}
            {(state.outline_text || state.outline) && (
              <ResultSection title="Story Outline" color="text-green-400" icon={<FileText />}>
                <pre className="whitespace-pre-wrap font-sans text-gray-300 text-lg leading-relaxed">
                  {state.outline_text || state.outline}
                </pre>
              </ResultSection>
            )}

            {/* 3. Scenes */}
            {state.scenes && state.scenes.length > 0 && (
              <div className="animate-in fade-in duration-700">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <Film className="text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-400">Scene Breakdown</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {state.scenes.map((scene, i) => (
                    <div key={i} className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-purple-500/50 transition-colors">
                      <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wider mb-3">Scene {i + 1}</h4>
                      <pre className="whitespace-pre-wrap font-sans text-gray-200 leading-relaxed">{scene}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Dialogues */}
            {state.dialogues && state.dialogues.length > 0 && (
              <div className="animate-in fade-in duration-700">
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <MessageSquare className="text-yellow-400" />
                  <h3 className="text-2xl font-bold text-yellow-400">Script & Dialogue</h3>
                </div>
                <div className="space-y-6">
                  {state.dialogues.map((dialogue, i) => (
                    <div key={i} className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 border-l-4 border-l-yellow-500">
                      <h4 className="font-bold text-yellow-500/80 text-xs uppercase tracking-wider mb-4">Dialogue Sequence {i + 1}</h4>
                      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 leading-relaxed bg-black/20 p-4 rounded-lg">
                        {dialogue}
                      </pre>
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

// Helper Components for Cleaner Code
function ControlButton({ onClick, disabled, icon, label, color }) {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-500 ring-blue-500",
    green: "bg-green-600 hover:bg-green-500 ring-green-500",
    purple: "bg-purple-600 hover:bg-purple-500 ring-purple-500",
    yellow: "bg-yellow-600 hover:bg-yellow-500 ring-yellow-500",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colorClasses[color]} px-4 py-2 rounded-lg font-medium text-white shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale`}
    >
      {icon} {label}
    </button>
  );
}

function ResultSection({ title, color, icon, children }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex items-center gap-3 mb-4">
        <span className={color}>{icon}</span>
        <h3 className={`text-2xl font-bold ${color}`}>{title}</h3>
      </div>
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        {children}
      </div>
    </div>
  );
}

export default App;