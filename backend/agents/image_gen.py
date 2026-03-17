"""Showcase image generation — Nano Banana muscular transformation.

Takes a user photo and generates a muscular version using Gemini
image generation model. Called from ToolRouter, not from ADK agent
(Live mode doesn't support sub-agents).
"""
import base64
import os
from google import genai
from google.genai import types


async def generate_muscle_image(photo_base64: str) -> str | None:
    """Take a base64 JPEG photo and return a muscular version as base64.

    Returns base64 JPEG string or None on failure.
    """
    client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

    # Decode the input photo
    photo_bytes = base64.b64decode(photo_base64)

    prompt = (
        "Edit this photo to make the person look extremely muscular and ripped. "
        "Add visible muscle definition — bigger biceps, defined chest, six-pack abs, "
        "broader shoulders, visible veins. Keep the same person, same pose, same "
        "background, same clothing. Make it look natural and realistic, not cartoonish. "
        "The result should look like the same person after years of intense bodybuilding."
    )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash-image",
            contents=[
                types.Content(
                    role="user",
                    parts=[
                        types.Part(text=prompt),
                        types.Part(inline_data=types.Blob(
                            mime_type="image/jpeg",
                            data=photo_bytes,
                        )),
                    ],
                ),
            ],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
            ),
        )

        # Extract generated image
        if response.candidates:
            for part in response.candidates[0].content.parts:
                if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                    return base64.b64encode(part.inline_data.data).decode()

        print("[ImageGen] No image in response")
        return None

    except Exception as e:
        print(f"[ImageGen] Error: {e}")
        return None
