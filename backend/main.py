from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from graph.graph_builder import create_story_graph

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

story_graph = create_story_graph()

@app.get("/ping")
def ping():
    return {"message": "pong"}

@app.post("/generate-story")
def generate_story(payload: dict):
    character_desc = payload.get("character_description", "")
    mode = payload.get("story_mode", "cinematic").lower()

    initial_state = {
        "mode": mode,
        "character_sheet": character_desc,
        "outline": "",
        "scenes": "",
        "dialogue": ""
    }
    
    result = story_graph.invoke(initial_state)
    return result
