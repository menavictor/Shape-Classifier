
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

    # 1. Circle Detection using HoughCircles (optimized for speed)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    
    # Adjusted parameters for faster and smarter circle detection
    circles = cv2.HoughCircles(
        blurred, 
        cv2.HOUGH_GRADIENT, 
        dp=1.2, 
        minDist=60,
        param1=40, 
        param2=25, 
        minRadius=15, 
        maxRadius=0
    )

    # 2. Contour detection
    edged = cv2.Canny(blurred, 30, 150)
    edged = cv2.dilate(edged, None, iterations=1)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Detect color
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    
    # Simple sampling of the center area for color
    center_y, center_x = img.shape[0] // 2, img.shape[1] // 2
    h_margin, w_margin = img.shape[0] // 6, img.shape[1] // 6
    sample = hsv[max(0, center_y-h_margin):min(img.shape[0], center_y+h_margin), 
                 max(0, center_x-w_margin):min(img.shape[1], center_x+w_margin)]

    if sample.size > 0:
        avg_hsv = np.mean(sample, axis=(0, 1))
        h, s, v = avg_hsv

        if s < 30:
            if v > 200: color = "White"
            elif v < 50: color = "Black"
            else: color = "Gray"
        else:
            if (h < 10 or h > 160): color = "Red"
            elif 10 <= h < 35: color = "Yellow"
            elif 35 <= h < 85: color = "Green"
            elif 85 <= h < 135: color = "Blue"
            elif 135 <= h < 160: color = "Purple"
    else:
        color = "Unknown"
        
    shape = "Other"
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
            if circularity > 0.8 or num_vertices > 8:
                shape = "Circle"
                color = "Green"
                confidence_msg = f"Contour circularity: {circularity:.2f}, Vertices: {num_vertices}"
            elif 4 <= num_vertices <= 4:
                x, y, w, h = cv2.boundingRect(approx)
                aspect_ratio = float(w)/h if h > 0 else 0
                solidity = float(area) / (w * h) if (w * h) > 0 else 0
                if solidity > 0.9 and 0.8 <= aspect_ratio <= 1.2:
                    shape = "Square"
                    color = "Blue"
                    confidence_msg = f"Solid square detected (Solidity: {solidity:.2f}, AR: {aspect_ratio:.2f})"
                else:
                    shape = "Rectangle"
                    color = "Yellow"
                    confidence_msg = f"Polygon detected with {num_vertices} vertices"
            elif num_vertices == 3:
                shape = "Triangle"
                color = "Yellow"
                confidence_msg = "Triangle vertices detected"

    return {
        "detected_shape": shape,
        "color": color,
        "confidence": confidence_msg
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
