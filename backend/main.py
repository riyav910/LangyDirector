# backend/main.py
import time
import uuid
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Literal, Dict, Any, List
# import google.generativeai as genai
# from fastapi import Response
# import requests
# import traceback
from dotenv import load_dotenv
import os

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

from graph.nodes import character_node, outline_node, scene_node, dialogue_node                    

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # TEMP: allow everything for testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------
# In-memory session store
# ---------------------------
SESSIONS: Dict[str, Dict[str, Any]] = {}

# Limits (tunable) - INCREASED TO PREVENT CUTOFFS
MAX_CHAR_SHEET_CHARS = 5000   
MAX_SCENE_CHARS = 5000
MAX_DIALOGUE_CHARS = 5000
MAX_OUTLINE_BEAT_SENTENCE_CHARS = 2500

# ---------------------------
# Pydantic request models
# ---------------------------
class CreateSessionRequest(BaseModel):
    story_mode: Optional[str] = "cinematic"
    initial_character_description: Optional[str] = ""

class NextRequest(BaseModel):
    user_input: Optional[str] = None  # user's direction/choice to influence next generation

class StepRequest(BaseModel):
    step: str  # "character", "outline", "scenes", "dialogue"

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
    for ln in lines:
        if ln.lower().startswith("beat"):
            beats.append(ln)
    if beats:
        return beats
    paragraphs = [p.strip() for p in outline_text.split("\n\n") if p.strip()]
    if paragraphs:
        for p in paragraphs:
            sentences = [s.strip() for s in p.split('.') if s.strip()]
            if sentences:
                beats.append('. '.join(sentences[:2]) + ('.' if sentences else ''))
        return beats
    return [outline_text.strip()]

def _truncate(text: str, max_chars: int) -> str:
    if not text:
        return text
    if len(text) <= max_chars:
        return text
    cut = text[:max_chars]
    last_newline = cut.rfind('\n')
    if last_newline > max_chars // 2:
        return cut[:last_newline].rstrip() + "..."
    last_period = cut.rfind('.')
    if last_period > max_chars // 2:
        return cut[:last_period+1].rstrip() + "..."
    return cut.rstrip() + "..."

# ---------------------------
# Generation Logic Helpers
# ---------------------------
def _run_character_gen(session: Dict[str, Any]) -> str:
    if not session.get("character_sheet"):
        session["character_sheet"] = session.get("character_description", "")

    state_input = {
        "mode": session["mode"],
        "character": session["character_sheet"],
        "character_sheet": session["character_sheet"],
        "user_override": session.get("user_override"),
    }

    out_state = character_node(state_input)

    if isinstance(out_state, dict) and out_state.get("_error"):
        err = out_state["_error"]
        raise HTTPException(status_code=500, detail=f"LLM node error (character): {err.get('message')}")

    gen = (
        out_state.get("character_sheet")
        or out_state.get("character")
        or out_state.get("text")
        or ""
    )

    gen = _truncate(gen, MAX_CHAR_SHEET_CHARS)
    session["character_sheet"] = gen
    return gen

def _run_outline_gen(session: Dict[str, Any]) -> str:
    state_input = {
        "mode": session["mode"],
        "character_sheet": session.get("character_sheet", ""),
        "user_override": session.get("user_override"),
    }

    out_state = outline_node(state_input)

    if isinstance(out_state, dict) and out_state.get("_error"):
        err = out_state["_error"]
        raise HTTPException(status_code=500, detail=f"LLM node error (outline): {err.get('message')}")

    outline_text = (
        out_state.get("outline")
        or out_state.get("outline_text")
        or out_state.get("text")
        or ""
    )

    outline_text = _truncate(outline_text, MAX_CHAR_SHEET_CHARS * 2)
    session["outline_text"] = outline_text

    beats = _parse_outline_to_beats(outline_text)
    beats = [_truncate(b, MAX_OUTLINE_BEAT_SENTENCE_CHARS) for b in beats]
    session["outline_beats"] = beats
    return outline_text


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
def generate_next(session_id: str, req: NextRequest = NextRequest()):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Store override if passed
    if req and req.user_input:
        session["user_override"] = req.user_input

    session["mode"] = session.get("mode", "cinematic")

    try:
        next_output = None
        step_name = None

        # --------------------------------------------------
        # STEP 0 — CHARACTER SHEET
        # --------------------------------------------------
        if session["current_step"] == 0:
            step_name = "character"
            gen = _run_character_gen(session)
            session["last_action"] = "character"
            session["current_step"] = 1
            session["user_override"] = None
            next_output = gen

        # --------------------------------------------------
        # STEP 1 — OUTLINE
        # --------------------------------------------------
        elif session["current_step"] == 1:
            step_name = "outline"
            gen = _run_outline_gen(session)
            session["last_action"] = "outline"
            session["current_step"] = 2
            session["scene_index"] = 0
            session["user_override"] = None
            next_output = gen

        # --------------------------------------------------
        # STEP 2+ — SCENE / DIALOGUE GENERATION
        # --------------------------------------------------
        else:
            # SAFETY CHECK: If we jumped here manually, ensure prerequisites exist.
            if not session.get("character_sheet"):
                _run_character_gen(session)
            
            # If outline is missing, generate it first!
            if not session.get("outline_beats"):
                _run_outline_gen(session)
            
            # Now retrieve the guaranteed beats
            beats: List[str] = session.get("outline_beats") or []
            
            # Double check in case outline generation failed silently or produced nothing
            if not beats:
                raise HTTPException(status_code=500, detail="Failed to generate outline dependencies.")

            si = session.get("scene_index", 0)
            last = session.get("last_action")

            # Finished all beats
            if si >= len(beats):
                return {"status": "finished", "message": "All beats processed", "state": session}

            # -------------------------
            # Generate SCENE
            # -------------------------
            if last != "scene" or len(session.get("scenes", [])) <= si:
                step_name = f"scene_{si+1}"

                state_input = {
                    "mode": session["mode"],
                    "outline": session["outline_text"],
                    "beat": beats[si],
                    "beat_index": si,
                    "character_sheet": session.get("character_sheet"),
                    "user_override": session.get("user_override"),
                }

                out_state = scene_node(state_input)

                if isinstance(out_state, dict) and out_state.get("_error"):
                    err = out_state["_error"]
                    raise HTTPException(status_code=500,
                        detail=f"LLM node error (scene): {err.get('message')}")

                if isinstance(out_state, dict):
                    gen = (
                        out_state.get("scenes")
                        or out_state.get("scene")
                        or out_state.get("scenes_text")
                        or out_state.get("text")
                        or ""
                    )
                else:
                    gen = str(out_state)

                gen = gen.strip()
                gen = _truncate(gen, MAX_SCENE_CHARS)

                scenes = session.get("scenes", [])
                if len(scenes) <= si:
                    scenes.extend([""] * (si - len(scenes) + 1))
                scenes[si] = gen
                session["scenes"] = scenes

                session["last_action"] = "scene"
                session["user_override"] = None
                next_output = {"type": "scene", "index": si, "text": gen}

            # -------------------------
            # Generate DIALOGUE
            # -------------------------
            else:
                step_name = f"dialogue_{si+1}"

                state_input = {
                    "mode": session["mode"],
                    "scene": session["scenes"][si] if len(session.get("scenes", [])) > si else "",
                    "beat": beats[si],
                    "beat_index": si,
                    "character_sheet": session.get("character_sheet"),
                    "user_override": session.get("user_override"),
                }

                out_state = dialogue_node(state_input)

                if isinstance(out_state, dict) and out_state.get("_error"):
                    err = out_state["_error"]
                    raise HTTPException(status_code=500,
                        detail=f"LLM node error (dialogue): {err.get('message')}")

                if isinstance(out_state, dict):
                    gen = (
                        out_state.get("dialogue")
                        or out_state.get("dialogues")
                        or out_state.get("dialogue_text")
                        or out_state.get("text")
                        or ""
                    )
                else:
                    gen = str(out_state)

                gen = gen.strip()
                gen = _truncate(gen, MAX_DIALOGUE_CHARS)

                dialogues = session.get("dialogues", [])
                if len(dialogues) <= si:
                    dialogues.extend([""] * (si - len(dialogues) + 1))
                dialogues[si] = gen
                session["dialogues"] = dialogues

                session["last_action"] = "dialogue"
                session["scene_index"] = si + 1
                session["user_override"] = None
                next_output = {"type": "dialogue", "index": si, "text": gen}

        # --------------------------------------------------
        # Save session and return
        # --------------------------------------------------
        session["updated_at"] = _now_ts()
        SESSIONS[session_id] = session

        return {
            "status": "ok",
            "step_name": step_name,
            "output": next_output,
            "state": session,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Generation error: {e}")


@app.post("/session/{session_id}/step")
def manual_step(session_id: str, req: StepRequest):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    step = req.step.lower()
    # map frontend step -> backend internal control
    if step == "character":
        session["current_step"] = 0
        session["last_action"] = None
        SESSIONS[session_id] = session
        return generate_next(session_id, NextRequest(user_input=None))
    if step == "outline":
        session["current_step"] = 1
        session["last_action"] = None
        SESSIONS[session_id] = session
        return generate_next(session_id, NextRequest(user_input=None))
    if step == "scenes":
        session["current_step"] = 2
        session["last_action"] = None  # ensure next is scene
        SESSIONS[session_id] = session
        return generate_next(session_id, NextRequest(user_input=None))
    if step == "dialogue":
        session["current_step"] = 2
        session["last_action"] = "scene"  # force dialogue next
        SESSIONS[session_id] = session
        return generate_next(session_id, NextRequest(user_input=None))

    raise HTTPException(status_code=400, detail="Invalid step name")

# Auto-generate full story: repeatedly call internal generate_next until finished.
@app.post("/session/{session_id}/generate_full")
def generate_full(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    outputs = []
    # Safety limit to avoid infinite loops
    max_iterations = 50
    iterations = 0

    while iterations < max_iterations:
        iterations += 1
        try:
            resp = generate_next(session_id, NextRequest(user_input=None))
        except HTTPException as he:
            # bubble up the node error in the outputs so the frontend can display it
            return {"status": "error", "message": "generation failed", "detail": he.detail, "state": SESSIONS.get(session_id)}
        except Exception as e:
            return {"status": "error", "message": "unexpected error", "detail": str(e), "state": SESSIONS.get(session_id)}
        # If generate_next returns finished shape (it returned dict with status finished)
        if isinstance(resp, dict) and resp.get("status") in ("finished", "ok") and resp.get("message") == "All beats processed":
            outputs.append({"status": "finished"})
            break
        outputs.append(resp)
        # check if scene/dialogues finished done via resp or session state
        session = SESSIONS.get(session_id)
        if session is None:
            break
        beats = session.get("outline_beats") or []
        if session.get("scene_index", 0) >= len(beats) and session.get("current_step", 0) >= 2:
            # finished
            break

    return {"status": "ok", "outputs": outputs, "state": SESSIONS.get(session_id)}

# Small utility route to list sessions (debug)
@app.get("/session")
def list_sessions():
    return {"count": len(SESSIONS), "sessions": list(SESSIONS.keys())}

# @app.post("/tts")
# def tts_endpoint(payload: dict):
#     import requests, traceback

#     text = payload.get("text", "").strip()
#     if not text:
#         raise HTTPException(status_code=400, detail="Text is required")

#     if not GOOGLE_API_KEY:
#         raise HTTPException(status_code=500, detail="Missing Google API Key")

#     try:
#         url = (
#             "https://generativelanguage.googleapis.com/v1beta/"
#             "models/gemini-2.0-flash-tts:generateContent"
#         )

#         body = {
#             "contents": [
#                 {
#                     "parts": [
#                         {"text": text}
#                     ]
#                 }
#             ],
#             "generationConfig": {
#                 "audioOutputConfig": {
#                     "audioEncoding": "mp3"
#                 }
#             }
#         }

#         print("TTS REQUEST BODY:", body)

#         resp = requests.post(url, params={"key": GOOGLE_API_KEY}, json=body)

#         print("TTS STATUS:", resp.status_code)
#         print("TTS RAW RESPONSE:", resp.text[:500])

#         if resp.status_code != 200:
#             raise HTTPException(status_code=500, detail=resp.text)

#         # In older versions, audio is base64 encoded inside JSON
#         data = resp.json()

#         # Extract base64 audio
#         b64_audio = data["candidates"][0]["content"]["parts"][0]["audio"]["data"]

#         import base64
#         audio_bytes = base64.b64decode(b64_audio)

#         return Response(content=audio_bytes, media_type="audio/mpeg")

#     except Exception as e:
#         print("TTS FULL ERROR:", e)
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))
