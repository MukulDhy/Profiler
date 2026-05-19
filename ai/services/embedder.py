import asyncio
from typing import List
from sentence_transformers import SentenceTransformer
import numpy as np
from config.settings import settings
from utils.logger import logger
from models.schemas import ResumeChunk, EmbeddedChunk

class Embedder:
    def __init__(self):
        self._model = None
        self._model_name = settings.EMBEDDING_MODEL

    def _get_model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info(f"Loading embedding model: {self._model_name}")
            self._model = SentenceTransformer(self._model_name)
        return self._model

    def _compute_embeddings(self, texts: List[str]) -> List[List[float]]:
        model = self._get_model()
        embeddings = model.encode(texts)
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1e-10, norms)
        normalized_embeddings = embeddings / norms
        return normalized_embeddings.tolist()

    async def embed_chunks(self, chunks: List[ResumeChunk]) -> List[EmbeddedChunk]:
        if not chunks:
            return []
            
        texts = [chunk.content for chunk in chunks]
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(None, self._compute_embeddings, texts)
        
        embedded_chunks = []
        for chunk, embedding in zip(chunks, embeddings):
            embedded_chunks.append(EmbeddedChunk(
                chunk_id=chunk.chunk_id,
                section=chunk.section,
                content=chunk.content,
                metadata=chunk.metadata,
                embedding=embedding
            ))
        return embedded_chunks
    
    async def embed_query(self, query: str) -> List[float]:
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(None, self._compute_embeddings, [query])
        return embeddings[0]

embedder = Embedder()
