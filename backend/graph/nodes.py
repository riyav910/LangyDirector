# backend/graph/nodes.py
import logging
from pathlib import Path
from typing import Dict, Any
from utils.gemini_llm import GeminiLLM

logger = logging.getLogger(__name__)
PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
llm = GeminiLLM()

def _load_prompt(mode: str, filename: str, **kwargs) -> str:
    file_path = PROMPTS_DIR / mode / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Prompt not found: {file_path}")
    text = file_path.read_text(encoding="utf-8")
    try:
        return text.format(**kwargs)
    except Exception as e:
        # If formatting fails, include debug info
        logger.exception("Prompt formatting failed for %s with kwargs %s", file_path, kwargs)
        raise

def _safe_invoke(prompt: str) -> Dict[str, Any]:
    """
    Call the LLM and return a dict with a consistent shape:
      {"text": "<result string>", "error": None}
    If it fails, return {"text": "", "error": "<error message>"} and log the exception.
    """
    try:
        res = llm.invoke(prompt)
        # if the LLM returns a dict/object sometimes, convert to string safely
        if isinstance(res, dict):
            # prefer 'text' or 'output' keys if present
            text = res.get("text") or res.get("output") or str(res)
        else:
            text = str(res or "")
        return {"text": text, "error": None}
    except Exception as e:
        logger.exception("LLM invocation failed")
        return {"text": "", "error": str(e)}

def character_node(state: Dict[str, Any]) -> Dict[str, Any]:
    mode = state.get("mode", state.get("story_mode", "cinematic")).lower()
    desc = state.get("character_sheet") or state.get("character") or ""
    prompt = _load_prompt(mode, "character_prompt.txt", character_description=desc)
    result = _safe_invoke(prompt)
    # Attach results in a consistent way
    state_out = dict(state)
    state_out["character_sheet"] = result["text"]
    if result["error"]:
        state_out["_error"] = {"node": "character", "message": result["error"]}
    return state_out

def outline_node(state: Dict[str, Any]) -> Dict[str, Any]:
    mode = state.get("mode", state.get("story_mode", "cinematic")).lower()
    prompt = _load_prompt(mode, "outline_prompt.txt",
                          character_sheet=state.get("character_sheet", ""))
    result = _safe_invoke(prompt)
    state_out = dict(state)
    # store what main expects: outline_text OR outline
    state_out["outline_text"] = result["text"]
    state_out["outline"] = result["text"]
    if result["error"]:
        state_out["_error"] = {"node": "outline", "message": result["error"]}
    return state_out

def scene_node(state: Dict[str, Any]) -> Dict[str, Any]:
    mode = state.get("mode", state.get("story_mode", "cinematic")).lower()
    # Give the node access to beat, beat_index, outline_text, character_sheet etc.
    prompt = _load_prompt(mode, "scene_prompt.txt",
                          outline=state.get("outline_text", state.get("outline", "")),
                          beat=state.get("beat", ""),
                          beat_index=state.get("beat_index", 0),
                          character_sheet=state.get("character_sheet", ""))
    result = _safe_invoke(prompt)
    state_out = dict(state)
    # store in keys main checks for (scenes / scene / scenes_text)
    state_out["scenes"] = result["text"]
    state_out["scene"] = result["text"]
    state_out["scenes_text"] = result["text"]
    if result["error"]:
        state_out["_error"] = {"node": "scene", "message": result["error"]}
    return state_out

def dialogue_node(state: Dict[str, Any]) -> Dict[str, Any]:
    mode = state.get("mode", state.get("story_mode", "cinematic")).lower()
    prompt = _load_prompt(mode, "dialogue_prompt.txt",
                          scene=state.get("scene", state.get("scenes", "")),
                          beat=state.get("beat", ""),
                          beat_index=state.get("beat_index", 0),
                          character_sheet=state.get("character_sheet", ""))
    result = _safe_invoke(prompt)
    state_out = dict(state)
    state_out["dialogue"] = result["text"]
    state_out["dialogues"] = result["text"]
    state_out["dialogue_text"] = result["text"]
    if result["error"]:
        state_out["_error"] = {"node": "dialogue", "message": result["error"]}
    return state_out
