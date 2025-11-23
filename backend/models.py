from pydantic import BaseModel

class StoryRequest(BaseModel):
    character_description: str
    story_mode: str   # NEW
