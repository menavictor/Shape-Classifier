
import cv2
import numpy as np
import sys
import json

def analyze_shape(image_path):
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Failed to load image"}

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Use adaptive thresholding for better contrast handling (shadows/textures)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # Try Canny edge detection which is often more robust for solid objects on textured backgrounds
    edged = cv2.Canny(blurred, 50, 150)
    
    # Dilate to close gaps in edges
    edged = cv2.dilate(edged, None, iterations=1)
    edged = cv2.erode(edged, None, iterations=1)

    # Find contours
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        # Fallback to simple threshold if Canny failed to find anything
        _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return {"detected_shape": "Other", "container_color": "Red", "confidence": "No contours found"}

    # Find the largest contour by area
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Calculate perimeter
    peri = cv2.arcLength(largest_contour, True)
    
    # Approximate the polygon - using a slightly more aggressive approximation for noisy edges
    approx = cv2.approxPolyDP(largest_contour, 0.03 * peri, True)
    
    num_vertices = len(approx)
    
    shape = "Other"
    color = "Red"
    
    # Circularity check
    area = cv2.contourArea(largest_contour)
    circularity = 0
    if peri > 0:
        circularity = 4 * np.pi * (area / (peri * peri))

    if num_vertices == 3:
        shape = "Triangle"
        color = "Yellow"
    elif 4 <= num_vertices <= 6:
        # Many real-world squares/rectangles might get 5 or 6 vertices due to rounded corners or noise
        # We check the bounding box vs contour area ratio (solidity)
        x, y, w, h = cv2.boundingRect(approx)
        rect_area = w * h
        solidity = float(area) / rect_area if rect_area > 0 else 0
        
        # Squares/Rectangles have high solidity (> 0.8)
        if solidity > 0.8:
            shape = "Square"
            color = "Blue"
        else:
            shape = "Other"
            color = "Red"
    elif num_vertices > 6:
        if circularity > 0.7:
             shape = "Circle"
             color = "Green"
        else:
             shape = "Other"
             color = "Red"
    else:
        shape = "Other"
        color = "Red"

    return {
        "detected_shape": shape,
        "container_color": color,
        "confidence": f"Vertices: {num_vertices}, Circularity: {circularity:.2f}"
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
