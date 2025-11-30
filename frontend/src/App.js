import React, { useState, useEffect } from "react";
import { Film, MessageSquare, User, Trash2, Play, Zap, FileText } from "lucide-react";
import jsPDF from "jspdf";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinematic");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [operationMode, setOperationMode] = useState("manual");

  // Load session + story if user refreshed
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

      // UPDATE LOCAL STORAGE
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

      // UPDATE LOCAL STORAGE
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

    // CLEAR LOCAL STORAGE
    localStorage.removeItem("sessionId");
    localStorage.removeItem("storyState");
  }

  // -------------------------------------------------------
  // RENDER
  // -------------------------------------------------------
  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans selection:bg-blue-500 selection:text-white">
      <div className="max-w-5xl mx-auto p-6">

        {/* HEADER */}
        <header className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight text-blue-500">
            Langy<span className="text-white">Director</span>
          </h1>

          {state && (
            <button
              onClick={downloadPDF}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded"
            >
              📄 Download PDF
            </button>
          )}
        </header>

        {/* ----------- USER INPUT STAGE ------------ */}
        {!sessionId && (
          <div className="bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-700">
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
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-3"
                >
                  <option value="cinematic">Cinematic (Movie Script)</option>
                  <option value="comic">Comic Book</option>
                  <option value="novel">Novel</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Workflow</label>
                <select
                  value={operationMode}
                  onChange={(e) => setOperationMode(e.target.value)}
                  className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg px-4 py-3"
                >
                  <option value="manual">Manual Director</option>
                  <option value="auto">Auto-Pilot</option>
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-400 mb-2">Protagonist & Premise</label>
              <textarea
                placeholder="e.g. A retired space pirate who transports a sentient plant..."
                value={characterDescription}
                onChange={(e) => setCharacterDescription(e.target.value)}
                rows={4}
                className="w-full bg-gray-900 text-white border border-gray-600 rounded-lg p-4 resize-none"
              />
            </div>

            <button
              onClick={startStory}
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg ${loading
                  ? "bg-gray-700 cursor-not-allowed text-gray-400"
                  : "bg-blue-600 hover:bg-blue-500"
                }`}
            >
              {loading ? "Initializing..." : "Start Production"}
            </button>
          </div>
        )}

        {/* ----------- CONTROLS ------------ */}
        {sessionId && (
          <div className="sticky top-4 bg-gray-900/90 backdrop-blur-md p-4 rounded-xl border border-gray-800 shadow mb-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {operationMode === "manual" ? (
                <div className="flex gap-2 overflow-x-auto">
                  <ControlButton onClick={() => runStep("character")} disabled={loading} icon={<User size={16} />} label="Character" color="blue" />
                  <ControlButton onClick={() => runStep("outline")} disabled={loading} icon={<FileText size={16} />} label="Outline" color="green" />
                  <ControlButton onClick={() => runStep("scenes")} disabled={loading} icon={<Film size={16} />} label="Scenes" color="purple" />
                  <ControlButton onClick={() => runStep("dialogue")} disabled={loading} icon={<MessageSquare size={16} />} label="Dialogue" color="yellow" />
                </div>
              ) : (
                <button
                  onClick={() => generateFull(sessionId)}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  <Play size={18} /> Regenerate Full Story
                </button>
              )}

              <div className="flex items-center gap-4">
                {loading && <span className="text-yellow-400 animate-pulse text-sm">AI is writing...</span>}

                <button
                  onClick={deleteSession}
                  className="text-red-400 hover:text-red-300 px-4 py-2 rounded-lg text-sm flex items-center gap-2"
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
            {state.character_sheet && (
              <ResultSection title="Character Profile" color="text-blue-400" icon={<User />}>
                <pre className="whitespace-pre-wrap font-mono text-sm">{state.character_sheet}</pre>
              </ResultSection>
            )}

            {(state.outline_text || state.outline) && (
              <ResultSection title="Story Outline" color="text-green-400" icon={<FileText />}>
                <pre className="whitespace-pre-wrap text-gray-300 text-lg">{state.outline_text || state.outline}</pre>
              </ResultSection>
            )}

            {state.scenes && state.scenes.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <Film className="text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-400">Scene Breakdown</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  {state.scenes.map((scene, i) => (
                    <div key={i} className="bg-gray-800 p-6 rounded-xl border border-gray-700">
                      <h4 className="font-bold text-gray-400 text-xs mb-3">Scene {i + 1}</h4>
                      <pre className="whitespace-pre-wrap text-gray-200 leading-relaxed">{scene}</pre>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {state.dialogues && state.dialogues.length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                  <MessageSquare className="text-yellow-400" />
                  <h3 className="text-2xl font-bold text-yellow-400">Script & Dialogue</h3>
                </div>
                <div className="space-y-6">
                  {state.dialogues.map((dialogue, i) => (
                    <div key={i} className="bg-gray-800/50 p-6 rounded-xl border border-gray-700 border-l-4 border-l-yellow-500">
                      <h4 className="font-bold text-yellow-500/80 text-xs mb-4">Dialogue Sequence {i + 1}</h4>
                      <pre className="whitespace-pre-wrap font-mono text-sm bg-black/20 p-4 rounded-lg">{dialogue}</pre>
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

// UI Helper Components
function ControlButton({ onClick, disabled, icon, label, color }) {
  const colorClasses = {
    blue: "bg-blue-600 hover:bg-blue-500",
    green: "bg-green-600 hover:bg-green-500",
    purple: "bg-purple-600 hover:bg-purple-500",
    yellow: "bg-yellow-600 hover:bg-yellow-500",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${colorClasses[color]} px-4 py-2 rounded-lg text-white flex items-center gap-2 disabled:opacity-50`}
    >
      {icon} {label}
    </button>
  );
}

function ResultSection({ title, color, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className={color}>{icon}</span>
        <h3 className={`text-2xl font-bold ${color}`}>{title}</h3>
      </div>
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">{children}</div>
    </div>
  );
}

export default App;
