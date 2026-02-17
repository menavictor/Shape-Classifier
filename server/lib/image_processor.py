
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

    # Blur to reduce noise
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # Apply threshold to get black and white image
    # Using Otsu's thresholding
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Find contours
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return {"shape": "Other", "color": "Red", "confidence": "No contours found"}

    # Find the largest contour (assuming it's the main object)
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Calculate perimeter
    peri = cv2.arcLength(largest_contour, True)
    
    # Approximate the polygon
    approx = cv2.approxPolyDP(largest_contour, 0.04 * peri, True)
    
    num_vertices = len(approx)
    
    shape = "Other"
    color = "Red"
    
    if num_vertices == 3:
        shape = "Triangle"
        color = "Yellow"
    elif num_vertices == 4:
        # Check aspect ratio to distinguish square from rectangle (optional, but requested Square)
        x, y, w, h = cv2.boundingRect(approx)
        aspect_ratio = float(w) / h
        if 0.9 <= aspect_ratio <= 1.1:
            shape = "Square"
            color = "Blue"
        else:
            # Treating rectangle as square/quad for this simple logic or "Other"
            # Requirement says "4 edges -> Square". Let's stick to the requirement simply.
            shape = "Square" 
            color = "Blue"
    elif num_vertices > 4:
        # A circle will have many vertices in approximation
        # Check circularity
        area = cv2.contourArea(largest_contour)
        if peri == 0:
             circularity = 0
        else:
             circularity = 4 * np.pi * (area / (peri * peri))
             
        if circularity > 0.7: # Tunable threshold
             shape = "Circle"
             color = "Green"
        else:
             # Could be a pentagon, hexagon, etc.
             shape = "Other"
             color = "Red"
    else:
        shape = "Other"
        color = "Red"

    return {
        "detected_shape": shape,
        "container_color": color,
        "confidence": f"Vertices: {num_vertices}"
    }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)
        
    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
