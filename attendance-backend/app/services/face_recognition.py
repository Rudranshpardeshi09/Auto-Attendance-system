"""
Face Recognition Service — Thin wrapper around FaceEmbeddingService.
Provides backward-compatible API for face matching using DeepFace Facenet512 embeddings.
"""
import numpy as np
from typing import Dict, Optional, Tuple
from app.services.face_embedding import face_embedding_service


class FaceRecognizer:
    """
    Wrapper around face_embedding_service that exposes a simple
    get_embedding / find_best_match interface for real-time recognition.
    """

    def get_embedding(self, face_region: np.ndarray) -> Optional[np.ndarray]:
        """
        Extract a 512-dim face embedding from a cropped face region.

        Args:
            face_region: BGR image of the face (can be full frame or crop)

        Returns:
            512-dim numpy array or None if extraction failed
        """
        if face_region is None or face_region.size == 0:
            return None

        return face_embedding_service.get_embedding(
            face_region, enforce_detection=False
        )

    def find_best_match(
        self,
        query_embedding: np.ndarray,
        known_embeddings: Dict[int, np.ndarray],
        threshold: float = 0.45,
    ) -> Tuple[Optional[int], float]:
        """
        Find the closest matching student from known embeddings.

        Args:
            query_embedding: 512-dim embedding to match
            known_embeddings: Dict mapping student_id -> stored embedding
            threshold: Maximum cosine distance to accept (lower = stricter)

        Returns:
            Tuple of (matched_student_id or None, cosine_distance)
        """
        return face_embedding_service.find_best_match(
            query_embedding, known_embeddings, threshold=threshold
        )


# Global singleton
face_recognizer = FaceRecognizer()
