import os
import pickle
import faiss
import numpy as np
import asyncio
from typing import List
from config.settings import settings
from utils.logger import logger
from models.schemas import EmbeddedChunk, SearchResult

class FAISSVectorStore:
    def __init__(self):
        self.base_path = settings.FAISS_STORE_PATH
        os.makedirs(self.base_path, exist_ok=True)

    def _get_candidate_dir(self, candidate_id: str) -> str:
        return os.path.join(self.base_path, candidate_id)

    def _build_and_save(self, candidate_id: str, chunks: List[EmbeddedChunk]):
        if not chunks:
            return
            
        candidate_dir = self._get_candidate_dir(candidate_id)
        os.makedirs(candidate_dir, exist_ok=True)
        
        dimension = len(chunks[0].embedding)
        index = faiss.IndexFlatIP(dimension)
        
        embeddings_np = np.array([c.embedding for c in chunks], dtype=np.float32)
        index.add(embeddings_np)
        
        index_path = os.path.join(candidate_dir, "index.faiss")
        faiss.write_index(index, index_path)
        
        metadata_path = os.path.join(candidate_dir, "metadata.pkl")
        metadata_list = [
            {
                "chunk_id": c.chunk_id,
                "section": c.section,
                "content": c.content,
                "metadata": c.metadata
            } for c in chunks
        ]
        with open(metadata_path, "wb") as f:
            pickle.dump(metadata_list, f)
            
        logger.info(f"Saved FAISS index for {candidate_id} at {candidate_dir}")

    async def build_index(self, candidate_id: str, chunks: List[EmbeddedChunk]):
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._build_and_save, candidate_id, chunks)

    def _load_and_search(self, candidate_id: str, query_embedding: List[float], top_k: int) -> List[SearchResult]:
        candidate_dir = self._get_candidate_dir(candidate_id)
        index_path = os.path.join(candidate_dir, "index.faiss")
        metadata_path = os.path.join(candidate_dir, "metadata.pkl")
        
        if not os.path.exists(index_path) or not os.path.exists(metadata_path):
            raise ValueError(f"No FAISS index found for candidate {candidate_id}")
            
        index = faiss.read_index(index_path)
        with open(metadata_path, "rb") as f:
            metadata_list = pickle.load(f)
            
        query_np = np.array([query_embedding], dtype=np.float32)
        distances, indices = index.search(query_np, top_k)
        
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx < len(metadata_list):
                meta = metadata_list[idx]
                results.append(SearchResult(
                    chunk_id=meta["chunk_id"],
                    section=meta["section"],
                    content=meta["content"],
                    metadata=meta["metadata"],
                    score=float(dist)
                ))
        return results

    async def search(self, candidate_id: str, query_embedding: List[float], top_k: int = 5) -> List[SearchResult]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._load_and_search, candidate_id, query_embedding, top_k)

vector_store = FAISSVectorStore()
