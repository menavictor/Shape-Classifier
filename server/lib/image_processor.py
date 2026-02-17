
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

    # 1. Circle Detection using HoughCircles (highly specific for circles)
    blurred = cv2.GaussianBlur(gray, (9, 9), 0)
    
    # Adjusted parameters for HoughCircles to be more sensitive to various circle sizes
    circles = cv2.HoughCircles(
        blurred, 
        cv2.HOUGH_GRADIENT, 
        dp=1.2, 
        minDist=50,
        param1=50, 
        param2=30, 
        minRadius=10, 
        maxRadius=0
    )

    # 2. Contour detection
    edged = cv2.Canny(blurred, 30, 150)
    edged = cv2.dilate(edged, None, iterations=1)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    shape = "Other"
    color = "Red"
    confidence_msg = "No distinct shape found"

    if circles is not None:
        # HoughCircles is very strong evidence for a circle
        shape = "Circle"
        color = "Green"
        confidence_msg = f"HoughCircles detected {len(circles[0])} circle(s)"
    elif contours:
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)
        peri = cv2.arcLength(largest_contour, True)
        
        if peri > 0:
            # Circularity formula: 4 * pi * area / perimeter^2
            circularity = (4 * np.pi * area) / (peri * peri)
            
            # Approximation to check for polygons
            approx = cv2.approxPolyDP(largest_contour, 0.03 * peri, True)
            num_vertices = len(approx)
            
            # Lowered circularity threshold and increased vertex tolerance for circles
            if circularity > 0.6 or num_vertices > 7:
                shape = "Circle"
                color = "Green"
                confidence_msg = f"Contour circularity: {circularity:.2f}, Vertices: {num_vertices}"
            elif 3 <= num_vertices <= 6:
                x, y, w, h = cv2.boundingRect(approx)
                solidity = float(area) / (w * h) if (w * h) > 0 else 0
                if solidity > 0.8:
                    shape = "Square"
                    color = "Blue"
                    confidence_msg = f"Solid quad detected (Solidity: {solidity:.2f})"
                elif num_vertices == 3:
                    shape = "Triangle"
                    color = "Yellow"
                    confidence_msg = "Triangle vertices detected"

    return {
        "detected_shape": shape,
        "container_color": color,
        "confidence": confidence_msg
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
