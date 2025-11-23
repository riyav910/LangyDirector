from langgraph.graph import StateGraph
from graph.state import StoryState
from graph.nodes import character_node, outline_node, scene_node, dialogue_node

def create_story_graph():
    graph = StateGraph(StoryState)

    graph.add_node("character", character_node)
    graph.add_node("outline", outline_node)
    graph.add_node("scenes", scene_node)
    graph.add_node("dialogue", dialogue_node)

    graph.set_entry_point("character")
    graph.add_edge("character", "outline")
    graph.add_edge("outline", "scenes")
    graph.add_edge("scenes", "dialogue")

    return graph.compile()
