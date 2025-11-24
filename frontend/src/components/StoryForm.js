// frontend/src/components/StoryForm.js
import StoryViewer from "./StoryViewer";


import React, { useState } from "react";
import axios from "axios";

const StoryForm = () => {
    const [character, setCharacter] = useState("");
    const [mode, setMode] = useState("cinematic");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const handleSubmit = async () => {
        if (!character.trim()) return alert("Character description is required");

        setLoading(true);
        try {
            const response = await axios.post("http://127.0.0.1:8000/generate-story", {
                character,
                mode,
            });

            setResult(response.data);
        } catch (err) {
            alert("Backend error: " + err.message);
        }
        setLoading(false);
    };

    return (
        <div className="story-form">
            <h2>🎬 AI Director</h2>

            <label>Story Mode</label>
            <select value={storyMode} onChange={(e) => setStoryMode(e.target.value)}>
                <option value="cinematic">Cinematic Story</option>
                <option value="comic">Comic</option>
                <option value="novel">Novel Chapter</option>
                <option value="thriller">Thriller</option>
            </select>


            <label>Character Description</label>
            <textarea
                value={character}
                onChange={(e) => setCharacter(e.target.value)}
                placeholder="Describe your characters..."
            />

            <button onClick={handleSubmit} disabled={loading}>
                {loading ? "Generating..." : "Generate Story"}
            </button>

            {result && <StoryViewer data={result} />}

        </div>
    );
};

export default StoryForm;
