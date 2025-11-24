from utils.gemini_llm import GeminiLLM
from pathlib import Path
import os

PROMPTS_DIR = Path(__file__).parent.parent / "prompts"
llm = GeminiLLM()

def _load_prompt(mode: str, filename: str, **kwargs):
    file_path = PROMPTS_DIR / mode / filename
    if not file_path.exists():
        raise FileNotFoundError(f"Prompt not found: {file_path}")

    text = file_path.read_text(encoding="utf-8")
    return text.format(**kwargs)


def character_node(state):
    mode = state.get("story_mode", "cinematic").lower()
    desc = state["character_sheet"]

    prompt = _load_prompt(mode, "character_prompt.txt",
                          character_description=desc)

    state["character_sheet"] = llm.invoke(prompt)
    return state


def outline_node(state):
    mode = state.get("story_mode", "cinematic").lower()
    prompt = _load_prompt(mode, "outline_prompt.txt",
                          character_sheet=state["character_sheet"])

    state["outline"] = llm.invoke(prompt)
    return state


def scene_node(state):
    mode = state.get("story_mode", "cinematic").lower()
    prompt = _load_prompt(mode, "scene_prompt.txt",
                          outline=state["outline"])

    state["scenes"] = llm.invoke(prompt)
    return state


def dialogue_node(state):
    mode = state.get("story_mode", "cinematic").lower()
    prompt = _load_prompt(mode, "dialogue_prompt.txt",
                          scenes=state["scenes"])

    state["dialogue"] = llm.invoke(prompt)
    return state
