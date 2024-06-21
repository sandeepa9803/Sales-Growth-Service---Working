# components/image_fetcher.py
import requests
from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from io import BytesIO

router = APIRouter()

@router.get("/fetch-image")
async def fetch_image(url: str):
    try:
        # Log the incoming request URL
        print(f"Fetching image from URL: {url}")
        
        response = requests.get(url)
        response.raise_for_status()

        # Log the response status
        print(f"Fetched image with status: {response.status_code}")

        return StreamingResponse(BytesIO(response.content), media_type="image/png")
    except requests.exceptions.RequestException as e:
        # Log the error
        print(f"Error fetching image: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
