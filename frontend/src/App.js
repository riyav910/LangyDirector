// frontend/src/App.js
import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinematic");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [operationMode, setOperationMode] = useState("manual"); // "manual" | "auto"

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

    // Convert streamed MP3 to a Blob and play
    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
  };


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
    // backend returns `state` inside response as "state"
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
    <div style={{ padding: 20 }}>
      <h1>AI Director — Progressive Mode</h1>

      {!sessionId && (
        <>
          <label style={{ marginRight: 10 }}>
            Mode:
            <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="cinematic">Cinematic</option>
              <option value="comic">Comic</option>
              <option value="novel">Novel</option>
            </select>
          </label>

          <label style={{ marginLeft: 16 }}>
            Operation:
            <select value={operationMode} onChange={(e) => setOperationMode(e.target.value)} style={{ marginLeft: 8 }}>
              <option value="manual">Manual (step-by-step)</option>
              <option value="auto">Auto (generate full story)</option>
            </select>
          </label>

          <div style={{ marginTop: 10 }}>
            <textarea
              placeholder="Brief character description..."
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              rows={5}
              cols={60}
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={createSession} disabled={loading}>
              Create Session
            </button>
          </div>
        </>
      )}

      {sessionId && (
        <>
          <p>Session: {sessionId}</p>

          {operationMode === "manual" ? (
            <div style={{ marginTop: 10 }}>
              <button onClick={() => runStep("character")} disabled={loading}>
                Generate Character Sheet
              </button>
              <button onClick={() => runStep("outline")} disabled={loading}>
                Generate Outline
              </button>
              <button onClick={() => runStep("scenes")} disabled={loading}>
                Generate Scenes
              </button>
              <button onClick={() => runStep("dialogue")} disabled={loading}>
                Generate Dialogue
              </button>
              <button onClick={deleteSession} style={{ marginLeft: 8 }}>
                Delete Session
              </button>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <button onClick={generateFull} disabled={loading}>
                Generate Full Story
              </button>
              <button onClick={deleteSession} style={{ marginLeft: 8 }}>
                Delete Session
              </button>
            </div>
          )}

          {loading && <p>Generating... please wait</p>}

          {state && (
            <div style={{ marginTop: 20 }}>
              {/* ------------------------- CHARACTER SHEET ------------------------- */}
              <h3>Character Sheet</h3>
              <button
                onClick={() => readAloud(state.character_sheet)}
                style={{ marginBottom: 5 }}
              >
                🔊 Read Aloud
              </button>
              <pre style={{ whiteSpace: "pre-wrap" }}>{state.character_sheet}</pre>

              {/* ------------------------- OUTLINE ------------------------- */}
              <h3>Outline</h3>
              <button
                onClick={() => readAloud(state.outline_text || state.outline)}
                style={{ marginBottom: 5 }}
              >
                🔊 Read Aloud
              </button>
              <pre style={{ whiteSpace: "pre-wrap" }}>
                {state.outline_text || state.outline}
              </pre>

              {/* ------------------------- SCENES ------------------------- */}
              <h3>Scenes</h3>
              <div>
                {(state.scenes || []).map((scene, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <strong>Scene {i + 1}:</strong>
                    <button
                      onClick={() => readAloud(scene)}
                      style={{ marginLeft: 10 }}
                    >
                      🔊 Read Scene
                    </button>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{scene}</pre>
                  </div>
                ))}
              </div>

              {/* ------------------------- DIALOGUES ------------------------- */}
              <h3>Dialogues</h3>
              <div>
                {(state.dialogues || []).map((dialogue, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <strong>Dialogue {i + 1}:</strong>
                    <button
                      onClick={() => readAloud(dialogue)}
                      style={{ marginLeft: 10 }}
                    >
                      🔊 Read Dialogue
                    </button>
                    <pre style={{ whiteSpace: "pre-wrap" }}>{dialogue}</pre>
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
