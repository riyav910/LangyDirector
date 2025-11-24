import { useState } from "react";

function App() {
  const [characterDescription, setCharacterDescription] = useState("");
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [storyMode, setStoryMode] = useState("Cinematic Story");


  const generateStory = async () => {
    setLoading(true);
    setStory(null);

    try {
      const response = await fetch("http://localhost:8000/generate-story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          character_description: characterDescription,
          story_mode: storyMode,
        }),
      });

      if (!response.ok) {
        throw new Error("Server error: " + response.status);
      }

      const data = await response.json();
      setStory(data);
    } catch (err) {
      console.error(err);
      alert("Error generating story. Check backend logs!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>🎬 AI Director</h1>

      <select
        value={storyMode}
        onChange={(e) => setStoryMode(e.target.value)}
      >
        <option value="cinematic">Cinematic Story</option>
        <option value="comic">Comic</option>
        <option value="novel">Novel Chapter</option>
        <option value="thriller">Thriller</option>
      </select>

      <textarea
        placeholder="Describe your characters..."
        value={characterDescription}
        onChange={(e) => setCharacterDescription(e.target.value)}
        style={{ width: "300px", height: "80px" }}
      />

      <button onClick={generateStory} style={{ marginLeft: "10px" }}>
        Generate Story
      </button>

      {loading && <p>⏳ Generating story...</p>}

      {story && (
        <div style={{ marginTop: "20px", whiteSpace: "pre-line" }}>
          <h2>🧍 Character Sheet</h2>
          <p>{story.character_sheet}</p>

          <h2>📘 Story Outline</h2>
          <p>{story.outline}</p>

          <h2>🎬 Scenes</h2>
          <p>{story.scenes}</p>

          <h2>💬 Dialogue</h2>
          <p>{story.dialogue}</p>
        </div>
      )}
    </div>
  );
}

export default App;
