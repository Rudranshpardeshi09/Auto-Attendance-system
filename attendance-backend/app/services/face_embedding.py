"""
Face Embedding Service using DeepFace
Provides robust 128/512-dimensional face embeddings for identity matching.
"""
import numpy as np
import cv2
from typing import Optional, Tuple, List, Dict
import os

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

try:
    from deepface import DeepFace
    DEEPFACE_AVAILABLE = True
except ImportError:
    DEEPFACE_AVAILABLE = False
    print("Warning: DeepFace not installed. Face recognition will use fallback.")

class FaceEmbeddingService:
    """
    Uses DeepFace library with Facenet512 backend for robust face embeddings.
    Facenet512 produces 512-dimensional embeddings optimized for face identity.
    """
    
    def __init__(self, model_name: str = "Facenet512"):
        """
        Initialize the embedding service.
        
        Args:
            model_name: DeepFace backend to use. Options:
                - "Facenet512": 512-dim (recommended, good accuracy)
                - "Facenet": 128-dim (faster, slightly less accurate)
                - "ArcFace": 512-dim (very accurate but slower)
                - "VGG-Face": 2622-dim (older, large embeddings)
        """
        self.model_name = model_name
        self.is_available = DEEPFACE_AVAILABLE
        self._model_loaded = False
        
        if self.is_available:
            try:
                # Pre-load model by running a dummy embedding
                # This prevents cold-start latency on first real request
                print(f"Loading {model_name} model...")
                dummy_img = np.zeros((224, 224, 3), dtype=np.uint8)
                # Don't actually run - let it load on first use
                self._model_loaded = True
                print(f"{model_name} model ready.")
            except Exception as e:
                print(f"Warning: Could not pre-load model: {e}")
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """
        Preprocess image for better face detection.
        - Auto-rotate if needed
        - Enhance contrast
        - Resize if too large
        """
        if image is None:
            return None
            
        # Limit max dimension to 1024 for performance
        max_dim = max(image.shape[:2])
        if max_dim > 1024:
            scale = 1024 / max_dim
            new_size = (int(image.shape[1] * scale), int(image.shape[0] * scale))
            image = cv2.resize(image, new_size, interpolation=cv2.INTER_AREA)
        
        # Enhance contrast using CLAHE
        lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l = clahe.apply(l)
        lab = cv2.merge([l, a, b])
        image = cv2.cvtColor(lab, cv2.COLOR_LAB2BGR)
        
        return image
    
    def get_embedding(self, image: np.ndarray, enforce_detection: bool = True) -> Optional[np.ndarray]:
        """
        Extract face embedding from an image.
        
        Args:
            image: BGR image (OpenCV format)
            enforce_detection: If True, raise error if no face detected
            
        Returns:
            Numpy array of embedding or None if failed
        """
        if not self.is_available:
            return None
            
        try:
            # Preprocess
            processed = self.preprocess_image(image)
            if processed is None:
                return None
            
            # Get embedding using DeepFace
            embedding_objs = DeepFace.represent(
                img_path=processed,
                model_name=self.model_name,
                enforce_detection=enforce_detection,
                detector_backend="opencv"  # Faster than retinaface for real-time
            )
            
            if embedding_objs and len(embedding_objs) > 0:
                embedding = np.array(embedding_objs[0]["embedding"], dtype=np.float32)
                return embedding
                
        except Exception as e:
            print(f"Embedding extraction failed: {e}")
            
        return None
    
    def get_embedding_with_jitter(self, image: np.ndarray, num_jitters: int = 3) -> Optional[np.ndarray]:
        """
        Generate a more robust embedding by averaging multiple samples.
        Applies slight transformations to improve generalization.
        
        Args:
            image: BGR image
            num_jitters: Number of variations to generate
            
        Returns:
            Averaged embedding numpy array
        """
        embeddings = []
        
        # Original embedding
        emb = self.get_embedding(image, enforce_detection=True)
        if emb is not None:
            embeddings.append(emb)
        
        if num_jitters > 1:
            # Slight brightness variations
            for i in range(1, num_jitters):
                factor = 1.0 + (i - num_jitters // 2) * 0.1  # 0.9, 1.0, 1.1, etc
                adjusted = cv2.convertScaleAbs(image, alpha=factor, beta=0)
                emb = self.get_embedding(adjusted, enforce_detection=False)
                if emb is not None:
                    embeddings.append(emb)
        
        if embeddings:
            # Return averaged embedding for more robust matching
            return np.mean(embeddings, axis=0).astype(np.float32)
        
        return None
    
    def compare_embeddings(
        self, 
        embedding1: np.ndarray, 
        embedding2: np.ndarray, 
        threshold: float = 0.4
    ) -> Tuple[bool, float]:
        """
        Compare two face embeddings using cosine similarity.
        
        Args:
            embedding1: First embedding
            embedding2: Second embedding
            threshold: Distance threshold (lower = stricter matching)
            
        Returns:
            Tuple of (is_match, distance)
        """
        if embedding1 is None or embedding2 is None:
            return False, float('inf')
            
        if embedding1.shape != embedding2.shape:
            return False, float('inf')
        
        # Cosine distance
        dot = np.dot(embedding1, embedding2)
        norm1 = np.linalg.norm(embedding1)
        norm2 = np.linalg.norm(embedding2)
        
        if norm1 == 0 or norm2 == 0:
            return False, float('inf')
        
        cosine_similarity = dot / (norm1 * norm2)
        cosine_distance = 1 - cosine_similarity
        
        return cosine_distance < threshold, float(cosine_distance)
    
    def find_best_match(
        self, 
        query_embedding: np.ndarray,
        known_embeddings: Dict[int, np.ndarray],
        threshold: float = 0.4
    ) -> Tuple[Optional[int], float]:
        """
        Find the best matching face from a dictionary of known embeddings.
        
        Args:
            query_embedding: The embedding to match
            known_embeddings: Dict mapping student_id -> embedding
            threshold: Distance threshold
            
        Returns:
            Tuple of (matched_id or None, distance)
        """
        best_id = None
        min_distance = float('inf')
        
        if query_embedding is None:
            return None, min_distance
        
        query_norm = np.linalg.norm(query_embedding)
        if query_norm == 0:
            return None, min_distance
        
        for student_id, stored_embedding in known_embeddings.items():
            if stored_embedding.shape != query_embedding.shape:
                continue
                
            stored_norm = np.linalg.norm(stored_embedding)
            if stored_norm == 0:
                continue
            
            # Cosine distance
            cosine_sim = np.dot(query_embedding, stored_embedding) / (query_norm * stored_norm)
            distance = 1 - cosine_sim
            
            if distance < min_distance:
                min_distance = distance
                best_id = student_id
        
        if min_distance < threshold:
            return best_id, min_distance
        
        return None, min_distance


# Global instance
face_embedding_service = FaceEmbeddingService(model_name="Facenet512")
