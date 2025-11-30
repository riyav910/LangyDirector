# LangyDirector — Story Generation Engine

**LangyDirector** is a full-stack application that generates character sheets, outlines, scenes, and dialogues using Google's Gemini LLM. It features a robust session-based architecture that supports both manual step-by-step control for granular editing and an automatic mode for one-click full-story generation.

## 🚀 Features

### 📖 Story Generation Modes
* **Manual Mode:** Step-by-step generation giving you full control over the narrative flow.
    * Character Sheet
    * Outline
    * Scene (beat-by-beat)
    * Dialogue
* **Auto Mode:** Generate an entire story from start to finish with a single click.

### 🧠 Session-Based Architecture
* Every user interaction runs inside an **isolated, unique session**.
* **Backend State Tracking:**
    * Character sheets & Outlines
    * Parsed outline beats
    * Scene & Dialogue lists
    * Current generation step index

### 🤖 LLM Capabilities
* Powered by **Google Gemini API** (via REST).
* Supports multiple storytelling styles: **Cinematic, Novel, and Comic**.
* **Modular LLM Nodes:**
    * `character_node`
    * `outline_node`
    * `scene_node`
    * `dialogue_node`

### 💻 Frontend Experience
* Built with **React** & **Tailwind CSS**.
* Dark-themed, distraction-free UI.
* Toggle between **Story Modes** and **Operation Modes** (Manual/Auto).
* Real-time display of generated content.

---

## 📁 Folder Structure

```text
LANGY_DIRECTOR/
│
├── backend/
│   ├── __pycache__/
│   ├── graph/                # Logic nodes
│   ├── prompts/              # Style-specific prompt templates
│   ├── utils/                # Helper functions (Gemini wrapper)
│   ├── venv/                 # Virtual environment
│   ├── .gitignore
│   ├── Dockerfile            # Containerization setup
│   ├── main.py               # FastAPI entry point
│   ├── models.py             # Pydantic data models
│   ├── Procfile              # Deployment configuration
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── node_modules/
│   ├── public/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page layouts
│   │   ├── App.css
│   │   ├── App.js            # Main React UI logic
│   │   ├── App.test.js
│   │   ├── index.css         # Global styles
│   │   ├── index.js
│   │   ├── logo.svg
│   │   ├── reportWebVitals.js
│   │   └── setupTests.js
│   ├── .gitignore
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── README.md
│   └── tailwind.config.js    # Tailwind CSS configuration
│
└── .gitignore


