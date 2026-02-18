import cv2
import numpy as np
import sys
import json
import os


def detect_color(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h_img, w_img = img.shape[:2]

    mask = np.zeros((h_img, w_img), dtype=np.uint8)
    center_y, center_x = h_img // 2, w_img // 2
    radius = min(h_img, w_img) // 4
    cv2.circle(mask, (center_x, center_y), radius, 255, -1)

    masked_hsv = cv2.bitwise_and(hsv, hsv, mask=mask)
    pixels = masked_hsv[mask > 0]

    if len(pixels) == 0:
        return "Unknown"

    avg_h = np.mean(pixels[:, 0])
    avg_s = np.mean(pixels[:, 1])
    avg_v = np.mean(pixels[:, 2])

    if avg_s < 40:
        if avg_v > 200:
            return "White"
        elif avg_v < 50:
            return "Black"
        else:
            return "Gray"

    if avg_v < 40:
        return "Black"

    if avg_h < 10 or avg_h > 165:
        return "Red"
    elif 10 <= avg_h < 25:
        return "Orange"
    elif 25 <= avg_h < 38:
        return "Yellow"
    elif 38 <= avg_h < 80:
        return "Green"
    elif 80 <= avg_h < 135:
        return "Blue"
    elif 135 <= avg_h < 165:
        return "Purple"

    return "Unknown"


def preprocess_image(img):
    # Convert to YUV to equalize brightness (better for varying camera light)
    img_yuv = cv2.cvtColor(img, cv2.COLOR_BGR2YUV)
    img_yuv[:,:,0] = cv2.equalizeHist(img_yuv[:,:,0])
    img = cv2.cvtColor(img_yuv, cv2.COLOR_YUV2BGR)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0) # Slightly more blur for noise

    # Adaptive threshold with slightly larger block size for real images
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 15, 3
    )

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=3)
    thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

    return gray, blurred, thresh


def find_main_contour(thresh, img_area):
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    min_area = img_area * 0.01
    valid_contours = [c for c in contours if cv2.contourArea(c) > min_area]

    if not valid_contours:
        valid_contours = contours

    return max(valid_contours, key=cv2.contourArea)


def classify_shape(contour, img_area):
    area = cv2.contourArea(contour)
    peri = cv2.arcLength(contour, True)

    if peri == 0:
        return "Other", "4", "No perimeter detected"

    circularity = (4 * np.pi * area) / (peri * peri)

    x, y, w, h = cv2.boundingRect(contour)
    aspect_ratio = float(w) / h if h > 0 else 0
    extent = float(area) / (w * h) if (w * h) > 0 else 0

    hull = cv2.convexHull(contour)
    hull_area = cv2.contourArea(hull)
    solidity = float(area) / hull_area if hull_area > 0 else 0

    for epsilon_factor in [0.02, 0.03, 0.04]:
        approx = cv2.approxPolyDP(contour, epsilon_factor * peri, True)
        num_vertices = len(approx)

        if num_vertices == 3 and circularity < 0.75:
            return "Triangle", "3", f"Triangle detected ({num_vertices} vertices, circularity: {circularity:.2f})"

        if num_vertices == 4 and circularity < 0.85:
            if 0.85 <= aspect_ratio <= 1.15 and extent > 0.8:
                return "Square", "2", f"Square detected ({num_vertices} vertices, AR: {aspect_ratio:.2f}, extent: {extent:.2f})"
            else:
                return "Rectangle", "3", f"Rectangle detected ({num_vertices} vertices, AR: {aspect_ratio:.2f})"

        if num_vertices >= 7 and circularity > 0.7:
            break

    approx_final = cv2.approxPolyDP(contour, 0.03 * peri, True)
    nv = len(approx_final)

    if nv == 3:
        return "Triangle", "3", f"Triangle detected ({nv} vertices, circularity: {circularity:.2f})"
    elif nv == 4:
        if 0.85 <= aspect_ratio <= 1.15 and extent > 0.8:
            return "Square", "2", f"Square detected ({nv} vertices, AR: {aspect_ratio:.2f})"
        else:
            return "Rectangle", "3", f"Rectangle detected ({nv} vertices, AR: {aspect_ratio:.2f})"
    elif nv == 5:
        return "Pentagon", "4", f"Pentagon detected ({nv} vertices)"
    elif nv == 6:
        return "Hexagon", "4", f"Hexagon detected ({nv} vertices)"

    if circularity > 0.85 and solidity > 0.85 and nv > 6:
        return "Circle", "1", f"Circle detected (circularity: {circularity:.2f}, solidity: {solidity:.2f}, vertices: {nv})"

    if nv > 6 and circularity > 0.65:
        return "Circle", "1", f"Circle detected (many vertices: {nv}, circularity: {circularity:.2f})"

    return "Other", "4", f"Complex shape ({nv} vertices, circularity: {circularity:.2f})"


def analyze_shape(image_path):
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Failed to load image"}

    h_img, w_img = img.shape[:2]
    img_area = h_img * w_img

    max_dim = 800
    if max(h_img, w_img) > max_dim:
        scale = max_dim / max(h_img, w_img)
        img = cv2.resize(img, None, fx=scale, fy=scale)
        h_img, w_img = img.shape[:2]
        img_area = h_img * w_img

    color = detect_color(img)

    gray, blurred, thresh = preprocess_image(img)

    main_contour = find_main_contour(thresh, img_area)

    if main_contour is None:
        _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
        main_contour = find_main_contour(binary, img_area)

    if main_contour is None:
        edges = cv2.Canny(blurred, 50, 150)
        edges = cv2.dilate(edges, None, iterations=2)
        main_contour = find_main_contour(edges, img_area)

    if main_contour is None:
        return {
            "detected_shape": "Other",
            "color": color,
            "container": "4",
            "confidence": "No clear shape contour detected in image"
        }

    shape, container, reason = classify_shape(main_contour, img_area)

    return {
        "detected_shape": shape,
        "color": color,
        "container": container,
        "confidence": reason
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
