// frontend/src/components/StoryViewer.js

import React, { useState } from "react";

const StoryViewer = ({ data }) => {
    const [openBeat, setOpenBeat] = useState(null);
    const [openScene, setOpenScene] = useState(null);

    return (
        <div className="story-viewer">

            {/* CHARACTER SHEET */}
            <section>
                <h2>🧬 Character Sheet</h2>
                <pre>{data.character_sheet}</pre>
            </section>

            {/* OUTLINE */}
            <section>
                <h2>📘 Story Outline (Beats)</h2>
                {data.outline.split("\n").map((beat, i) => (
                    <div key={i}>
                        <button
                            className="accordion-btn"
                            onClick={() => setOpenBeat(openBeat === i ? null : i)}
                        >
                            Beat {i + 1}
                        </button>

                        {openBeat === i && <pre>{beat}</pre>}
                    </div>
                ))}
            </section>

            {/* SCENES */}
            <section>
                <h2>🎥 Scene Breakdown</h2>
                {data.scenes.split("\n").map((scene, i) => (
                    <div key={i}>
                        <button
                            className="accordion-btn"
                            onClick={() => setOpenScene(openScene === i ? null : i)}
                        >
                            Scene {i + 1}
                        </button>

                        {openScene === i && <pre>{scene}</pre>}
                    </div>
                ))}
            </section>

            {/* DIALOGUE */}
            <section>
                <h2>💬 Dialogue</h2>
                <pre>{data.dialogue}</pre>
            </section>

        </div>
    );
};

export default StoryViewer;
