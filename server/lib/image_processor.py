import cv2
import numpy as np
import sys
import json
import os


def detect_color_on_mask(img, contour):
    mask = np.zeros(img.shape[:2], dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, -1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.erode(mask, kernel, iterations=2)

    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    pixels = hsv[mask > 0]

    if len(pixels) < 10:
        return detect_color_center(img)

    avg_h = np.median(pixels[:, 0])
    avg_s = np.median(pixels[:, 1])
    avg_v = np.median(pixels[:, 2])

    return classify_hsv(avg_h, avg_s, avg_v)


def detect_color_center(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h_img, w_img = img.shape[:2]
    mask = np.zeros((h_img, w_img), dtype=np.uint8)
    center_y, center_x = h_img // 2, w_img // 2
    radius = min(h_img, w_img) // 4
    cv2.circle(mask, (center_x, center_y), radius, 255, -1)
    pixels = hsv[mask > 0]
    if len(pixels) == 0:
        return "Unknown"
    avg_h = np.median(pixels[:, 0])
    avg_s = np.median(pixels[:, 1])
    avg_v = np.median(pixels[:, 2])
    return classify_hsv(avg_h, avg_s, avg_v)


def classify_hsv(h, s, v):
    if s < 35:
        if v > 200:
            return "White"
        elif v < 50:
            return "Black"
        else:
            return "Gray"
    if v < 35:
        return "Black"
    if h < 10 or h > 165:
        return "Red"
    elif 10 <= h < 25:
        return "Orange"
    elif 25 <= h < 38:
        return "Yellow"
    elif 38 <= h < 80:
        return "Green"
    elif 80 <= h < 135:
        return "Blue"
    elif 135 <= h < 165:
        return "Purple"
    return "Unknown"


def smart_segment(img):
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
    blurred = cv2.GaussianBlur(bilateral, (5, 5), 0)

    results = []

    thresh1 = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV, 15, 3
    )
    results.append(("adaptive_gauss", thresh1))

    thresh2 = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY_INV, 15, 5
    )
    results.append(("adaptive_mean", thresh2))

    _, thresh3 = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    results.append(("otsu", thresh3))

    edges = cv2.Canny(blurred, 30, 100)
    kernel_edge = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    edges = cv2.dilate(edges, kernel_edge, iterations=2)
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel_edge, iterations=2)
    results.append(("canny", edges))

    try:
        mask_gc = np.zeros(img.shape[:2], np.uint8)
        border = max(5, min(h, w) // 20)
        rect = (border, border, w - 2 * border, h - 2 * border)
        bgd_model = np.zeros((1, 65), np.float64)
        fgd_model = np.zeros((1, 65), np.float64)
        small = cv2.resize(img, (min(w, 400), min(h, 400)))
        small_mask = np.zeros(small.shape[:2], np.uint8)
        sh, sw = small.shape[:2]
        sb = max(3, min(sh, sw) // 20)
        small_rect = (sb, sb, sw - 2 * sb, sh - 2 * sb)
        cv2.grabCut(small, small_mask, small_rect, bgd_model, fgd_model, 3, cv2.GC_INIT_WITH_RECT)
        fg_mask = np.where((small_mask == 2) | (small_mask == 0), 0, 1).astype('uint8')
        fg_mask = cv2.resize(fg_mask, (w, h), interpolation=cv2.INTER_NEAREST) * 255
        results.append(("grabcut", fg_mask))
    except Exception:
        pass

    cleaned = []
    for name, t in results:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        t = cv2.morphologyEx(t, cv2.MORPH_CLOSE, kernel, iterations=3)
        t = cv2.morphologyEx(t, cv2.MORPH_OPEN, kernel, iterations=1)
        cleaned.append((name, t))

    return gray, blurred, cleaned


def find_best_contour(thresholds, img_area):
    all_candidates = []

    for name, thresh in thresholds:
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            continue

        min_area = img_area * 0.005
        max_area = img_area * 0.98

        for c in contours:
            area = cv2.contourArea(c)
            if area < min_area or area > max_area:
                continue

            peri = cv2.arcLength(c, True)
            if peri == 0:
                continue

            hull = cv2.convexHull(c)
            hull_area = cv2.contourArea(hull)
            solidity = float(area) / hull_area if hull_area > 0 else 0

            area_ratio = area / img_area
            centrality = compute_centrality(c, thresh.shape)
            score = solidity * 0.3 + min(area_ratio * 3, 1.0) * 0.4 + centrality * 0.3

            all_candidates.append((score, c, name))

    if not all_candidates:
        return None, "none"

    all_candidates.sort(key=lambda x: x[0], reverse=True)
    return all_candidates[0][1], all_candidates[0][2]


def compute_centrality(contour, img_shape):
    M = cv2.moments(contour)
    if M["m00"] == 0:
        return 0.0
    cx = M["m10"] / M["m00"]
    cy = M["m01"] / M["m00"]
    h, w = img_shape[:2]
    dist_x = abs(cx - w / 2) / (w / 2)
    dist_y = abs(cy - h / 2) / (h / 2)
    return max(0, 1.0 - (dist_x + dist_y) / 2)


def detect_circles_hough(gray, img_area):
    h, w = gray.shape[:2]
    min_r = int(min(h, w) * 0.05)
    max_r = int(min(h, w) * 0.45)

    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min(h, w) // 4,
        param1=80,
        param2=40,
        minRadius=min_r,
        maxRadius=max_r
    )

    if circles is not None:
        circles = np.uint16(np.around(circles))
        best = None
        best_score = 0

        for c in circles[0, :]:
            cx, cy, r = c[0], c[1], c[2]
            circle_area = np.pi * r * r
            area_ratio = circle_area / img_area

            dist_x = abs(cx - w / 2) / (w / 2)
            dist_y = abs(cy - h / 2) / (h / 2)
            centrality = max(0, 1.0 - (dist_x + dist_y) / 2)

            score = min(area_ratio * 5, 1.0) * 0.5 + centrality * 0.5

            if score > best_score and area_ratio > 0.02:
                best_score = score
                best = (cx, cy, r, score)

        if best is not None:
            return best

    return None


def classify_shape_smart(contour, img_area, hough_circle=None):
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

    min_rect = cv2.minAreaRect(contour)
    min_rect_w, min_rect_h = min_rect[1]
    if min_rect_h > 0:
        min_ar = min(min_rect_w, min_rect_h) / max(min_rect_w, min_rect_h)
    else:
        min_ar = 0
    min_rect_area = min_rect_w * min_rect_h
    rect_fill = area / min_rect_area if min_rect_area > 0 else 0

    min_enclosing_center, min_enclosing_radius = cv2.minEnclosingCircle(contour)
    circle_area = np.pi * min_enclosing_radius ** 2
    circle_fill = area / circle_area if circle_area > 0 else 0

    votes = {"Circle": 0, "Square": 0, "Rectangle": 0, "Triangle": 0, "Other": 0}

    if hough_circle is not None:
        hcx, hcy, hr, hscore = hough_circle
        M = cv2.moments(contour)
        if M["m00"] > 0:
            ccx = M["m10"] / M["m00"]
            ccy = M["m01"] / M["m00"]
            dist = np.sqrt((hcx - ccx)**2 + (hcy - ccy)**2)
            hough_area = np.pi * hr * hr
            area_match = min(area, hough_area) / max(area, hough_area) if max(area, hough_area) > 0 else 0
            radius_match = min(min_enclosing_radius, float(hr)) / max(min_enclosing_radius, float(hr)) if max(min_enclosing_radius, float(hr)) > 0 else 0
            if dist < hr * 0.4 and area_match > 0.4 and radius_match > 0.5 and circularity > 0.55:
                votes["Circle"] += 2.5 * hscore

    if circle_fill > 0.85 and circularity > 0.75:
        votes["Circle"] += 2.0
    elif circle_fill > 0.80 and circularity > 0.65:
        votes["Circle"] += 1.0

    vertex_counts = []
    for eps in [0.015, 0.02, 0.025, 0.03, 0.04, 0.05]:
        approx = cv2.approxPolyDP(contour, eps * peri, True)
        vertex_counts.append(len(approx))

    tight_v = vertex_counts[0]
    mid_v = vertex_counts[2]
    loose_v = vertex_counts[4]

    tri_votes = sum(1 for v in vertex_counts if v == 3)
    quad_votes = sum(1 for v in vertex_counts if v == 4)
    many_votes = sum(1 for v in vertex_counts if v >= 7)

    if tri_votes >= 2 and circularity < 0.8:
        votes["Triangle"] += 2.5
    elif tri_votes >= 1 and circularity < 0.7:
        votes["Triangle"] += 1.5

    if quad_votes >= 2 and circularity < 0.88:
        if min_ar > 0.85 and rect_fill > 0.85:
            votes["Square"] += 2.5
        elif rect_fill > 0.8:
            votes["Rectangle"] += 2.5
    elif quad_votes >= 1:
        if min_ar > 0.85 and extent > 0.75:
            votes["Square"] += 1.5
        elif extent > 0.65:
            votes["Rectangle"] += 1.5

    if many_votes >= 3 and circularity > 0.7 and solidity > 0.85:
        votes["Circle"] += 2.0
    elif many_votes >= 2 and circularity > 0.65 and solidity > 0.80:
        votes["Circle"] += 1.0

    if solidity > 0.95 and circularity > 0.80:
        votes["Circle"] += 1.0
    if solidity > 0.90 and rect_fill > 0.90 and circularity < 0.85:
        if min_ar > 0.85:
            votes["Square"] += 1.0
        else:
            votes["Rectangle"] += 1.0

    if extent > 0.88 and circularity < 0.85:
        if 0.85 <= aspect_ratio <= 1.18:
            votes["Square"] += 0.5
        else:
            votes["Rectangle"] += 0.5

    best_shape = max(votes, key=votes.get)
    best_score = votes[best_shape]

    if best_score < 1.0:
        best_shape = "Other"

    container_map = {"Circle": "1", "Square": "2", "Triangle": "3", "Rectangle": "3", "Other": "4"}
    container = container_map.get(best_shape, "4")

    detail_parts = [
        f"v=[{tight_v},{mid_v},{loose_v}]",
        f"circ={circularity:.2f}",
        f"sol={solidity:.2f}",
        f"cfill={circle_fill:.2f}",
        f"rfill={rect_fill:.2f}",
        f"ar={aspect_ratio:.2f}"
    ]
    vote_str = ", ".join(f"{k}:{v:.1f}" for k, v in votes.items() if v > 0)
    reason = f"{best_shape} detected ({vote_str}) [{', '.join(detail_parts)}]"

    return best_shape, container, reason


def analyze_shape(image_path):
    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}

    img = cv2.imread(image_path)
    if img is None:
        return {"error": "Failed to load image"}

    h_img, w_img = img.shape[:2]

    max_dim = 800
    if max(h_img, w_img) > max_dim:
        scale = max_dim / max(h_img, w_img)
        img = cv2.resize(img, None, fx=scale, fy=scale)
        h_img, w_img = img.shape[:2]

    img_area = h_img * w_img

    gray, blurred, thresholds = smart_segment(img)

    main_contour, method = find_best_contour(thresholds, img_area)

    hough_circle = detect_circles_hough(gray, img_area)

    if main_contour is None:
        if hough_circle is not None:
            hcx, hcy, hr, _ = hough_circle
            color = detect_color_center(img)
            return {
                "detected_shape": "Circle",
                "color": color,
                "container": "1",
                "confidence": f"Circle detected via Hough transform (r={hr})"
            }
        color = detect_color_center(img)
        return {
            "detected_shape": "Other",
            "color": color,
            "container": "4",
            "confidence": "No clear shape contour detected in image"
        }

    color = detect_color_on_mask(img, main_contour)

    shape, container, reason = classify_shape_smart(main_contour, img_area, hough_circle)

    return {
        "detected_shape": shape,
        "color": color,
        "container": container,
        "confidence": f"{reason} [method: {method}]"
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No image path provided"}))
        sys.exit(1)

    image_path = sys.argv[1]
    result = analyze_shape(image_path)
    print(json.dumps(result))
