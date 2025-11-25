# backend/main.py
import time
import uuid
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# import your node functions (they should accept and return a dict state)
from graph.nodes import character_node, outline_node, scene_node, dialogue_node

app = FastAPI()

# CORS - must be added before routes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# In-memory session store
# ---------------------------
SESSIONS: Dict[str, Dict[str, Any]] = {}

# Limits (tunable)
MAX_CHAR_SHEET_CHARS = 1600   # ~200-300 words
MAX_SCENE_CHARS = 1000
MAX_DIALOGUE_CHARS = 800
MAX_OUTLINE_BEAT_SENTENCE_CHARS = 300

# ---------------------------
# Pydantic request models
# ---------------------------
class CreateSessionRequest(BaseModel):
    story_mode: Optional[str] = "cinematic"
    initial_character_description: Optional[str] = ""

class NextRequest(BaseModel):
    user_input: Optional[str] = None  # user's direction/choice to influence next generation

# ---------------------------
# Helpers
# ---------------------------
def _now_ts() -> float:
    return time.time()

def _make_session(mode: str, initial_desc: str) -> Dict[str, Any]:
    session_id = str(uuid.uuid4())
    mode = (mode or "cinematic").lower()
    now = _now_ts()
    session = {
        "id": session_id,
        "created_at": now,
        "updated_at": now,
        "mode": mode,
        # raw inputs
        "character_description": initial_desc or "",
        # generated content
        "character_sheet": "",
        # outline stored as text and as list of beats (for incremental generation)
        "outline_text": "",
        "outline_beats": [],  # each beat is a short string (1-2 sentences)
        # scenes and dialogues are lists in order
        "scenes": [],         # scene text per beat
        "dialogues": [],      # dialogue text per scene
        # progression control
        "current_step": 0,    # 0=character, 1=outline, 2=scenes/dialogue-phase
        "scene_index": 0,     # current scene index (0-based)
        "last_action": None,  # None | "character" | "outline" | "scene" | "dialogue"
        # temporary user override / instruction (consumed on next generation)
        "user_override": None,
    }
    SESSIONS[session_id] = session
    return session

def _parse_outline_to_beats(outline_text: str) -> List[str]:
    """
    Try to split outline text into beats.
    Heuristics:
    - split on newline and keep lines that look like "Beat" or just non-empty lines
    - if lines start with "Beat", keep the whole line
    - otherwise, split by double newline or sentences into short beats
    """
    if not outline_text:
        return []
    lines = [l.strip() for l in outline_text.splitlines() if l.strip()]
    beats = []
    # Prefer lines that start with 'Beat' (case-insensitive)
    for ln in lines:
        if ln.lower().startswith("beat"):
            beats.append(ln)
    if beats:
        return beats
    # Fallback: group lines into beats by blank-line separation
    paragraphs = [p.strip() for p in outline_text.split("\n\n") if p.strip()]
    if paragraphs:
        # further trim each paragraph to one or two sentences
        for p in paragraphs:
            # naive sentence split by '.' ; keep short
            sentences = [s.strip() for s in p.split('.') if s.strip()]
            if sentences:
                # join first 1-2 sentences as a beat
                beats.append('. '.join(sentences[:2]) + ('.' if sentences else ''))
        return beats
    # last fallback: return the whole outline as one beat
    return [outline_text.strip()]

def _truncate(text: str, max_chars: int) -> str:
    if not text:
        return text
    if len(text) <= max_chars:
        return text
    # try to cut at last newline or sentence boundary before limit
    cut = text[:max_chars]
    last_newline = cut.rfind('\n')
    if last_newline > max_chars // 2:
        return cut[:last_newline].rstrip() + "..."
    last_period = cut.rfind('.')
    if last_period > max_chars // 2:
        return cut[:last_period+1].rstrip() + "..."
    return cut.rstrip() + "..."

# ---------------------------
# Endpoints
# ---------------------------
@app.post("/session")
def create_session(req: CreateSessionRequest):
    session = _make_session(req.story_mode or "cinematic", req.initial_character_description or "")
    # initialize character_description into character_sheet input
    session["character_sheet"] = session["character_description"]
    return {"session_id": session["id"], "state": session}

@app.get("/session/{session_id}")
def get_session(session_id: str):
    s = SESSIONS.get(session_id)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s

@app.delete("/session/{session_id}")
def delete_session(session_id: str):
    if session_id in SESSIONS:
        del SESSIONS[session_id]
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Session not found")

# Main interactive endpoint - advances exactly one generation step
@app.post("/session/{session_id}/next")
def generate_next(session_id: str, req: NextRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Attach user override if provided (will be read by nodes via session)
    if req and req.user_input:
        # store and the nodes / prompt templates can read {user_override} if they support it
        session["user_override"] = req.user_input

    # Safety: ensure mode is set
    session["mode"] = session.get("mode", "cinematic")

    # Decide what to generate next based on `current_step`, `scene_index`, `last_action`, and outline length
    try:
        next_output = None
        step_name = None

        # Step 0: generate character sheet
        if session["current_step"] == 0:
            step_name = "character"
            # ensure we have a seed description in character_sheet (user provided or empty)
            if not session.get("character_sheet"):
                session["character_sheet"] = session.get("character_description", "")
            # nodes expect a state dict with keys - we pass a shallow copy to node and take result
            state_input = {
                "mode": session["mode"],
                "character": session["character_sheet"],  # some prompt templates expect 'character' or 'character_sheet'
                "character_sheet": session["character_sheet"],
                "user_override": session.get("user_override"),
            }
            out_state = character_node(state_input)  # should populate character_sheet
            # store and truncate
            gen = out_state.get("character_sheet", "") or out_state.get("character", "")
            gen = _truncate(gen, MAX_CHAR_SHEET_CHARS)
            session["character_sheet"] = gen
            session["last_action"] = "character"
            session["current_step"] = 1  # next will be outline
            # consume override
            session["user_override"] = None
            next_output = gen

        # Step 1: generate outline (beat-by-beat text)
        elif session["current_step"] == 1:
            step_name = "outline"
            state_input = {
                "mode": session["mode"],
                "character_sheet": session.get("character_sheet", ""),
                "user_override": session.get("user_override"),
            }
            out_state = outline_node(state_input)  # should populate 'outline' or 'outline_text'
            # the node may write state['outline'] or state['outline_text'], handle both
            outline_text = out_state.get("outline") or out_state.get("outline_text") or ""
            outline_text = _truncate(outline_text, MAX_CHAR_SHEET_CHARS * 2)
            session["outline_text"] = outline_text
            # parse into beats
            beats = _parse_outline_to_beats(outline_text)
            # enforce beat length limits
            beats = [ _truncate(b, MAX_OUTLINE_BEAT_SENTENCE_CHARS) for b in beats ]
            session["outline_beats"] = beats
            session["last_action"] = "outline"
            # after outline, move to scene phase
            session["current_step"] = 2
            session["scene_index"] = 0
            session["user_override"] = None
            next_output = outline_text

        # Step 2+: scene/dialogue alternating phase
        else:
            # if outline_beats empty => cannot generate scenes
            beats: List[str] = session.get("outline_beats") or []
            if not beats:
                raise HTTPException(status_code=400, detail="Outline missing; generate outline first")

            # Determine if we should generate a scene or dialogue next.
            # We will alternate: for scene_index = i:
            #   if last_action is not "scene" for this index -> generate scene i
            #   else -> generate dialogue for scene i and then increment scene_index
            si = session.get("scene_index", 0)
            last = session.get("last_action")

            # Bound check: if scene_index >= number of beats => finished
            if si >= len(beats):
                return {
                    "status": "finished",
                    "message": "All beats processed",
                    "full_state": session,
                }

            # Generate Scene for beat si if last action wasn't 'scene' for this index
            if last != "scene" or len(session.get("scenes", [])) <= si:
                step_name = f"scene_{si+1}"
                # Prepare a state input for scene generation
                state_input = {
                    "mode": session["mode"],
                    "outline": session["outline_text"],
                    "beat": beats[si],
                    "beat_index": si,
                    "character_sheet": session.get("character_sheet"),
                    "user_override": session.get("user_override"),
                }
                out_state = scene_node(state_input)  # should set "scenes" or return text
                gen = out_state.get("scenes") or out_state.get("scene") or out_state.get("scenes_text") or ""
                gen = gen.strip()
                gen = _truncate(gen, MAX_SCENE_CHARS)
                # ensure scenes list is long enough
                scenes = session.get("scenes", [])
                if len(scenes) <= si:
                    scenes.extend([""] * (si - len(scenes) + 1))
                scenes[si] = gen
                session["scenes"] = scenes
                session["last_action"] = "scene"
                # consume user override for this action
                session["user_override"] = None
                next_output = {"type": "scene", "index": si, "text": gen}

            else:
                # Generate Dialogue for the same scene index
                step_name = f"dialogue_{si+1}"
                state_input = {
                    "mode": session["mode"],
                    "scene": session["scenes"][si] if len(session.get("scenes", []))>si else "",
                    "beat": beats[si],
                    "beat_index": si,
                    "character_sheet": session.get("character_sheet"),
                    "user_override": session.get("user_override"),
                }
                out_state = dialogue_node(state_input)
                gen = out_state.get("dialogue") or out_state.get("dialogues") or out_state.get("dialogue_text") or ""
                gen = gen.strip()
                gen = _truncate(gen, MAX_DIALOGUE_CHARS)
                dialogues = session.get("dialogues", [])
                if len(dialogues) <= si:
                    dialogues.extend([""] * (si - len(dialogues) + 1))
                dialogues[si] = gen
                session["dialogues"] = dialogues
                session["last_action"] = "dialogue"
                # after dialogue, move to next scene index
                session["scene_index"] = si + 1
                session["user_override"] = None
                next_output = {"type": "dialogue", "index": si, "text": gen}

        # update timestamps and store
        session["updated_at"] = _now_ts()
        SESSIONS[session_id] = session

        # Build response
        return {
            "session_id": session_id,
            "step_name": step_name,
            "output": next_output,
            "full_state": session,
        }

    except HTTPException:
        # re-raise HTTPException as-is
        raise
    except Exception as e:
        # catch other exceptions and report helpful message
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")

# Small utility route to list sessions (debug)
@app.get("/session")
def list_sessions():
    return {"count": len(SESSIONS), "sessions": list(SESSIONS.keys())}
