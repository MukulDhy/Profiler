from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.resume_routes import router as resume_router
from config.settings import settings
from services.embedder import embedder

app = FastAPI(title="ProfileGPT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_router)

@app.get("/api/v1/health")
async def health_check():
    model_loaded = embedder._model is not None
    return {
        "status": "healthy",
        "embedding_model": settings.EMBEDDING_MODEL,
        "model_loaded": model_loaded,
        "faiss_store_path": settings.FAISS_STORE_PATH,
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
