// frontend/src/App.js
import React, { useState } from "react";

const API_BASE = "http://localhost:8000";

function App() {
  const [sessionId, setSessionId] = useState(null);
  const [mode, setMode] = useState("cinematic");
  const [characterDescription, setCharacterDescription] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("character"); // character -> outline -> scenes -> dialogue

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
      const err = await res.json();
      alert("Server error: " + (err.detail || res.status));
      setLoading(false);
      return;
    }
    const data = await res.json();
    setState(data.state);
    setCurrentStep(nextStep(step));
    setLoading(false);
  }

  function nextStep(step) {
    if (step === "character") return "outline";
    if (step === "outline") return "scenes";
    if (step === "scenes") return "dialogue";
    return "done";
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>AI Director — Progressive Mode</h1>

      {!sessionId && (
        <>
          <label>
            Mode:
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="cinematic">Cinematic</option>
              <option value="comic">Comic</option>
              <option value="novel">Novel</option>
            </select>
          </label>

          <div>
            <textarea
              placeholder="Brief character description..."
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              rows={5}
              cols={60}
            />
          </div>

          <button onClick={createSession} disabled={loading}>
            Create Session
          </button>
        </>
      )}

      {sessionId && (
        <>
          <p>Session: {sessionId}</p>

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
            <button onClick={async () => {
              await fetch(`${API_BASE}/session/${sessionId}`, { method: "DELETE" });
              setSessionId(null); setState(null);
            }}> Delete Session </button>
          </div>

          {loading && <p>Generating... please wait</p>}

          {state && (
            <div style={{ marginTop: 20 }}>
              <h3>Character Sheet</h3>
              <pre>{state.character_sheet}</pre>

              <h3>Outline</h3>
              <pre>{state.outline}</pre>

              <h3>Scenes</h3>
              <pre>{state.scenes}</pre>

              <h3>Dialogue</h3>
              <pre>{state.dialogue}</pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
