"""
Liveness Detection Service
Detects if a real person is present vs a static photo/video.
"""
import numpy as np
import cv2
from typing import Tuple, List, Optional
from dataclasses import dataclass
from collections import deque
import time

# Try to import MediaPipe for landmark detection
try:
    import mediapipe as mp
    mp_face_mesh = mp.solutions.face_mesh
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False


@dataclass
class LivenessResult:
    """Result of liveness detection check."""
    is_live: bool
    confidence: float
    reason: str
    blink_detected: bool = False
    movement_detected: bool = False


class LivenessDetector:
    """
    Detects liveness using multiple techniques:
    1. Eye Aspect Ratio (EAR) for blink detection
    2. Head movement tracking
    3. Texture analysis for detecting flat/screen surfaces
    """
    
    # MediaPipe face mesh landmark indices
    # Left eye landmarks
    LEFT_EYE = [362, 385, 387, 263, 373, 380]
    # Right eye landmarks  
    RIGHT_EYE = [33, 160, 158, 133, 153, 144]
    # Nose tip for movement tracking
    NOSE_TIP = 1
    
    def __init__(self):
        self.face_mesh = None
        if MEDIAPIPE_AVAILABLE:
            self.face_mesh = mp_face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5
            )
        
        # Tracking state for movement detection
        self.position_history: deque = deque(maxlen=30)  # ~1 second at 30fps
        self.ear_history: deque = deque(maxlen=30)
        self.last_blink_time: float = 0
        self.blink_count: int = 0
        
        # Thresholds
        self.EAR_THRESHOLD = 0.21  # Below this = eye closed
        self.BLINK_CONSECUTIVE_FRAMES = 2
        self.MOVEMENT_THRESHOLD = 0.02  # Normalized movement threshold
        
        # Frame counter for consecutive closed eyes
        self.closed_eye_frames = 0
    
    def _calculate_ear(self, eye_landmarks: List[Tuple[float, float]]) -> float:
        """
        Calculate Eye Aspect Ratio (EAR).
        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        """
        # Vertical distances
        v1 = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        v2 = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))
        # Horizontal distance
        h = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))
        
        if h == 0:
            return 0.3  # Default open value
        
        ear = (v1 + v2) / (2.0 * h)
        return ear
    
    def _get_landmark_coords(self, landmarks, indices: List[int], img_shape: Tuple[int, int]) -> List[Tuple[float, float]]:
        """Get normalized landmark coordinates."""
        h, w = img_shape[:2]
        coords = []
        for idx in indices:
            lm = landmarks.landmark[idx]
            coords.append((lm.x * w, lm.y * h))
        return coords
    
    def _analyze_texture(self, image: np.ndarray, face_region: Optional[Tuple] = None) -> float:
        """
        Analyze texture to detect flat surfaces (photos on screens).
        Returns a score 0-1 (higher = more likely real).
        """
        if image is None:
            return 0.5
        
        # Convert to grayscale
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Calculate Laplacian variance (measure of texture/edges)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        
        # Real faces typically have variance > 100
        # Photos/screens tend to have lower variance due to smoothing
        # Normalize to 0-1 range
        texture_score = min(variance / 500.0, 1.0)
        
        return texture_score
    
    def process_frame(self, frame: np.ndarray) -> LivenessResult:
        """
        Process a single frame for liveness detection.
        
        Args:
            frame: BGR image (OpenCV format)
            
        Returns:
            LivenessResult with detection status
        """
        if not MEDIAPIPE_AVAILABLE or self.face_mesh is None:
            return LivenessResult(
                is_live=True,  # Fallback: assume live
                confidence=0.5,
                reason="Liveness detection unavailable (MediaPipe not installed)"
            )
        
        # Convert to RGB for MediaPipe
        try:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(rgb_frame)
        except (AttributeError, RuntimeError) as e:
            # Protobuf v5+ incompatibility - degrade gracefully
            print(f"MediaPipe liveness error: {e}. Skipping liveness check.")
            return LivenessResult(
                is_live=True,
                confidence=0.5,
                reason=f"Liveness detection unavailable (protobuf incompatibility)"
            )
        
        if not results.multi_face_landmarks:
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                reason="No face detected"
            )
        
        landmarks = results.multi_face_landmarks[0]
        h, w = frame.shape[:2]
        
        # 1. Calculate EAR for blink detection
        left_eye_coords = self._get_landmark_coords(landmarks, self.LEFT_EYE, frame.shape)
        right_eye_coords = self._get_landmark_coords(landmarks, self.RIGHT_EYE, frame.shape)
        
        left_ear = self._calculate_ear(left_eye_coords)
        right_ear = self._calculate_ear(right_eye_coords)
        avg_ear = (left_ear + right_ear) / 2.0
        
        self.ear_history.append(avg_ear)
        
        # Detect blink
        blink_detected = False
        if avg_ear < self.EAR_THRESHOLD:
            self.closed_eye_frames += 1
        else:
            if self.closed_eye_frames >= self.BLINK_CONSECUTIVE_FRAMES:
                blink_detected = True
                self.blink_count += 1
                self.last_blink_time = time.time()
            self.closed_eye_frames = 0
        
        # 2. Track head movement
        nose = landmarks.landmark[self.NOSE_TIP]
        current_pos = (nose.x, nose.y)
        self.position_history.append(current_pos)
        
        movement_detected = False
        if len(self.position_history) >= 10:
            positions = np.array(list(self.position_history))
            movement_range = np.max(positions, axis=0) - np.min(positions, axis=0)
            if np.max(movement_range) > self.MOVEMENT_THRESHOLD:
                movement_detected = True
        
        # 3. Texture analysis
        texture_score = self._analyze_texture(frame)
        
        # Combined liveness decision
        # Require at least one of: blink, movement, or good texture
        confidence = 0.0
        reasons = []
        
        if blink_detected or self.blink_count > 0:
            confidence += 0.4
            reasons.append("blink detected")
        
        if movement_detected:
            confidence += 0.3
            reasons.append("movement detected")
        
        if texture_score > 0.3:
            confidence += 0.3
            reasons.append(f"texture score: {texture_score:.2f}")
        
        is_live = confidence >= 0.5
        reason = ", ".join(reasons) if reasons else "No liveness indicators"
        
        return LivenessResult(
            is_live=is_live,
            confidence=min(confidence, 1.0),
            reason=reason,
            blink_detected=blink_detected,
            movement_detected=movement_detected
        )
    
    def check_liveness_multi_frame(self, frames: List[np.ndarray], required_confidence: float = 0.6) -> LivenessResult:
        """
        Check liveness across multiple frames for more reliable detection.
        
        Args:
            frames: List of BGR images
            required_confidence: Minimum confidence to consider as live
            
        Returns:
            Aggregated LivenessResult
        """
        if not frames:
            return LivenessResult(
                is_live=False,
                confidence=0.0,
                reason="No frames provided"
            )
        
        # Reset tracking state
        self.position_history.clear()
        self.ear_history.clear()
        self.blink_count = 0
        self.closed_eye_frames = 0
        
        # Process all frames
        results = []
        for frame in frames:
            result = self.process_frame(frame)
            results.append(result)
        
        # Aggregate results
        total_confidence = sum(r.confidence for r in results) / len(results)
        any_blink = any(r.blink_detected for r in results) or self.blink_count > 0
        any_movement = any(r.movement_detected for r in results)
        
        is_live = total_confidence >= required_confidence or (any_blink and any_movement)
        
        reasons = []
        if any_blink:
            reasons.append(f"blinks: {self.blink_count}")
        if any_movement:
            reasons.append("head movement")
        reasons.append(f"avg confidence: {total_confidence:.2f}")
        
        return LivenessResult(
            is_live=is_live,
            confidence=total_confidence,
            reason=", ".join(reasons),
            blink_detected=any_blink,
            movement_detected=any_movement
        )
    
    def reset(self):
        """Reset tracking state for a new session."""
        self.position_history.clear()
        self.ear_history.clear()
        self.blink_count = 0
        self.closed_eye_frames = 0
        self.last_blink_time = 0


# Global instance
liveness_detector = LivenessDetector()
