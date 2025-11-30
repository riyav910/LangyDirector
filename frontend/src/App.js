// frontend/src/App.js
import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinematic");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [operationMode, setOperationMode] = useState("manual");

  const readAloud = async (text) => {
    const res = await fetch("http://localhost:8000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      alert("TTS failed");
      return;
    }

    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  };

  async function playTTS(text) {
    const res = await fetch("http://localhost:8000/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      console.error("TTS Error", await res.text());
      return;
    }

    const audioBlob = await res.blob();
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.play();
  }


  async function createSession() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story_mode: mode,
        initial_character_description: characterDescription,
      }),
    });
    const data = await res.json();
    setSessionId(data.session_id);
    setState(data.state);
    setLoading(false);
  }

  async function runStep(step) {
    if (!sessionId) {
      alert("Create a session first");
      return;
    }
    setLoading(true);
    const res = await fetch(`${API_BASE}/session/${sessionId}/step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Server error: " + (err.detail || res.status));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setState(data.state || data);
    setLoading(false);
  }

  async function generateFull() {
    if (!sessionId) {
      alert("Create a session first");
      return;
    }
    setLoading(true);
    const res = await fetch(`${API_BASE}/session/${sessionId}/generate_full`, {
      method: "POST",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Server error: " + (err.detail || res.status));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setState(data.state || data);
    setLoading(false);
  }

  async function deleteSession() {
    if (!sessionId) return;
    await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" });
    setSessionId(null);
    setState(null);
  }

  return (
    <div className="dark bg-gray-900 text-gray-100 min-h-screen p-6">
      <h1 className="text-3xl font-bold mb-4">AI Director — Progressive Mode</h1>

      {!sessionId && (
        <>
          <label className="mr-4">
            Mode:
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="ml-2 bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1"
            >
              <option value="cinematic">Cinematic</option>
              <option value="comic">Comic</option>
              <option value="novel">Novel</option>
            </select>
          </label>

          <label className="ml-6">
            Operation:
            <select
              value={operationMode}
              onChange={(e) => setOperationMode(e.target.value)}
              className="ml-2 bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1"
            >
              <option value="manual">Manual (step-by-step)</option>
              <option value="auto">Auto (generate full story)</option>
            </select>
          </label>

          <div className="mt-4">
            <textarea
              placeholder="Brief character description..."
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              rows={5}
              cols={60}
              className="w-full bg-gray-800 text-gray-100 border border-gray-700 rounded p-3"
            />
          </div>

          <div className="mt-4">
            <button
              onClick={createSession}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white disabled:opacity-50"
            >
              Create Session
            </button>
          </div>
        </>
      )}

      {sessionId && (
        <>
          <p className="text-gray-400 mb-2">Session: {sessionId}</p>

          {operationMode === "manual" ? (
            <div className="mt-4 space-x-2">
              <button
                onClick={() => runStep("character")}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded disabled:opacity-50"
              >
                Generate Character Sheet
              </button>

              <button
                onClick={() => runStep("outline")}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded disabled:opacity-50"
              >
                Generate Outline
              </button>

              <button
                onClick={() => runStep("scenes")}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded disabled:opacity-50"
              >
                Generate Scenes
              </button>

              <button
                onClick={() => runStep("dialogue")}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded disabled:opacity-50"
              >
                Generate Dialogue
              </button>

              <button
                onClick={deleteSession}
                className="bg-red-600 hover:bg-red-700 px-3 py-1 rounded"
              >
                Delete Session
              </button>
            </div>
          ) : (
            <div className="mt-4 space-x-2">
              <button
                onClick={generateFull}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded disabled:opacity-50"
              >
                Generate Full Story
              </button>
              <button
                onClick={deleteSession}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              >
                Delete Session
              </button>
            </div>
          )}

          {loading && <p className="mt-4 text-yellow-400">Generating... please wait</p>}

          {state && (
            <div className="mt-8">
              <h3 className="text-xl font-semibold">Character Sheet</h3>
              <button
                onClick={() => readAloud(state.character_sheet)}
                className="mt-1 mb-2 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
              >
                🔊 Read Aloud
              </button>
              <pre className="whitespace-pre-wrap bg-gray-800 p-4 rounded border border-gray-700">
                {state.character_sheet}
              </pre>

              <h3 className="text-xl font-semibold mt-6">Outline</h3>
              <button
                onClick={() => readAloud(state.outline_text || state.outline)}
                className="mt-1 mb-2 bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded"
              >
                🔊 Read Aloud
              </button>
              <pre className="whitespace-pre-wrap bg-gray-800 p-4 rounded border border-gray-700">
                {state.outline_text || state.outline}
              </pre>

              <h3 className="text-xl font-semibold mt-6">Scenes</h3>
              <div>
                {(state.scenes || []).map((scene, i) => (
                  <div key={i} className="mb-6">
                    <strong>Scene {i + 1}:</strong>
                    <button
                      onClick={() => readAloud(scene)}
                      className="ml-2 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                    >
                      🔊 Read Scene
                    </button>
                    <pre className="whitespace-pre-wrap bg-gray-800 p-4 rounded border border-gray-700">
                      {scene}
                    </pre>
                  </div>
                ))}
              </div>

              <h3 className="text-xl font-semibold mt-6">Dialogues</h3>
              <div>
                {(state.dialogues || []).map((dialogue, i) => (
                  <div key={i} className="mb-6">
                    <strong>Dialogue {i + 1}:</strong>
                    <button
                      onClick={() => readAloud(dialogue)}
                      className="ml-2 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                    >
                      🔊 Read Dialogue
                    </button>
                    <pre className="whitespace-pre-wrap bg-gray-800 p-4 rounded border border-gray-700">
                      {dialogue}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
