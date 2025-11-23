import google.generativeai as genai
from langchain_core.language_models import LLM
from typing import Optional, List, Any, Dict
import os
from dotenv import load_dotenv
import logging

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class GeminiLLM(LLM):
    model: str = "gemini-2.5-flash"

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-2.5-flash"):
        super().__init__()
        api_key = api_key or os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY missing")
        genai.configure(api_key=api_key)
        self.model = model

    @property
    def _llm_type(self) -> str:
        return "gemini"

    def _call(self, prompt: str, stop: Optional[List[str]] = None, **kwargs: Any) -> str:
        """
        Call the Gemini client. Some client versions don't accept kwargs like
        temperature/max_output_tokens directly on generate_content(), so we:
          1) Try passing kwargs (most flexible)
          2) If that raises TypeError, call without kwargs (fallback)
        """
        gen_model = genai.GenerativeModel(self.model)

        # Build request_kwargs only with keys we expect to be safe to try.
        # We'll attempt to pass them, but gracefully fall back if unsupported.
        request_kwargs: Dict[str, Any] = {}
        for k in ("temperature", "candidate_count", "max_output_tokens", "top_k", "top_p"):
            if k in kwargs:
                request_kwargs[k] = kwargs[k]

        # Attempt 1: try passing kwargs (works if client supports them)
        try:
            if request_kwargs:
                logger.info(f"Calling generate_content with kwargs: {list(request_kwargs.keys())}")
                response = gen_model.generate_content(prompt, **request_kwargs)
            else:
                logger.info("Calling generate_content without extra kwargs (no request_kwargs found).")
                response = gen_model.generate_content(prompt)
        except TypeError as e:
            # Some versions of the client raise TypeError for unexpected kwargs.
            logger.warning("generate_content() refused kwargs, retrying without them. Error: %s", e)
            response = gen_model.generate_content(prompt)
        except Exception as e:
            # Bubble up other exceptions so they can be diagnosed (quota, auth, etc.)
            logger.exception("Error while calling Gemini generate_content: %s", e)
            raise

        # Normalize response -> string
        # Different client versions expose results differently.
        try:
            # Newer clients often have .text
            text = response.text
            if isinstance(text, str) and text.strip():
                return text
        except Exception:
            pass

        # Fallback: some responses include candidates list/objects
        if hasattr(response, "candidates"):
            try:
                candidates = response.candidates
                joined = "\n".join([getattr(c, "text", str(c)) for c in candidates if getattr(c, "text", None)])
                if joined.strip():
                    return joined
            except Exception:
                pass

        # Final fallback: try stringifying the whole response object
        try:
            return str(response)
        except Exception:
            raise RuntimeError("Could not extract text from Gemini response.")
