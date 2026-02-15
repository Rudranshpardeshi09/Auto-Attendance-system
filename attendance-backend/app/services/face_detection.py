"""
Face Detection Service using OpenCV DNN
Uses OpenCV's built-in DNN face detector (ResNet SSD) which is much more
accurate than Haar Cascade and has no protobuf dependency issues.
Falls back to Haar Cascade if DNN model files are unavailable.
"""
import cv2
import numpy as np
import os


class FaceDetector:
    """
    Face detector using OpenCV DNN (primary) with Haar Cascade fallback.
    The DNN detector uses a pre-trained Caffe model (ResNet SSD) that ships
    with OpenCV, providing significantly better precision than Haar.
    """

    def __init__(self):
        self.dnn_net = None
        self.face_cascade = None
        self.use_dnn = False
        self.confidence_threshold = 0.5

        # Try to initialize OpenCV DNN face detector
        try:
            model_dir = os.path.join(os.path.dirname(__file__), "models")
            prototxt = os.path.join(model_dir, "deploy.prototxt")
            model = os.path.join(model_dir, "res10_300x300_ssd_iter_140000.caffemodel")

            if os.path.exists(prototxt) and os.path.exists(model):
                self.dnn_net = cv2.dnn.readNetFromCaffe(prototxt, model)
                self.use_dnn = True
                print("Using OpenCV DNN Face Detector (ResNet SSD)")
            else:
                print(f"DNN model files not found at {model_dir}, trying download...")
                self._download_dnn_model(model_dir, prototxt, model)
        except Exception as e:
            print(f"Failed to initialize DNN detector: {e}")

        # Fallback: Haar Cascade
        if not self.use_dnn:
            print("Using Haar Cascade Fallback")
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if os.path.exists(cascade_path):
                self.face_cascade = cv2.CascadeClassifier(cascade_path)
            else:
                print(f"Warning: Haar Cascade file not found at {cascade_path}")

    def _download_dnn_model(self, model_dir, prototxt_path, model_path):
        """Download the DNN model files if not present."""
        import urllib.request

        os.makedirs(model_dir, exist_ok=True)

        prototxt_url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
        model_url = "https://raw.githubusercontent.com/opencv/opencv_3rdparty/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

        try:
            print("Downloading DNN face detector model...")
            urllib.request.urlretrieve(prototxt_url, prototxt_path)
            urllib.request.urlretrieve(model_url, model_path)
            self.dnn_net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)
            self.use_dnn = True
            print("DNN face detector model downloaded and loaded successfully!")
        except Exception as e:
            print(f"Failed to download DNN model: {e}. Using Haar Cascade fallback.")
            # Initialize Haar Cascade as fallback
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            if os.path.exists(cascade_path):
                self.face_cascade = cv2.CascadeClassifier(cascade_path)

    def _dnn_detect(self, frame):
        """Detect faces using OpenCV DNN (ResNet SSD)."""
        h, w = frame.shape[:2]
        blob = cv2.dnn.blobFromImage(
            cv2.resize(frame, (300, 300)),
            1.0, (300, 300),
            (104.0, 177.0, 123.0)
        )
        self.dnn_net.setInput(blob)
        detections = self.dnn_net.forward()

        faces = []
        for i in range(detections.shape[2]):
            confidence = float(detections[0, 0, i, 2])
            if confidence > self.confidence_threshold:
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                x1, y1, x2, y2 = box.astype("int")
                # Clamp to frame boundaries
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(w, x2)
                y2 = min(h, y2)
                faces.append((x1, y1, x2 - x1, y2 - y1))

        return faces, None

    def _haar_detect(self, frame):
        """Detect faces using Haar Cascade (fallback)."""
        if self.face_cascade is None:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)
        rects = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=6, minSize=(80, 80)
        )
        faces = [(x, y, w, h) for (x, y, w, h) in rects]
        return faces, None

    def process_frame(self, frame):
        """
        Detect faces in a frame.
        Returns: (faces_list, results_metadata)
        Each face is a tuple (x, y, w, h).
        """
        if self.use_dnn:
            try:
                return self._dnn_detect(frame)
            except Exception as e:
                print(f"DNN detection error: {e}. Falling back to Haar.")
                self.use_dnn = False
                return self._haar_detect(frame)
        else:
            return self._haar_detect(frame)


face_detector = FaceDetector()
