# AR Marker + QR Code Research for Access Control Panel Labels

## Executive Summary

**Goal**: Create a single printable sticker for access control panels that:
1. Contains a **QR code** (scannable by any phone camera to open the AR viewer)
2. Contains an **AR marker** (detected by the web app for 3D overlay)
3. Can be **printed on a label printer** (thermal transfer, 2-3" square)
4. Is **durable** enough for indoor access panel environments

**Current implementation**: AR.js 3x3 barcode marker embedded in the center of a QR code with H-level error correction. This approach works but has known reliability issues.

**Recommended path forward**: Switch from AR.js 3x3 barcode markers to **ArUco DICT_4X4_50** markers detected via **js-aruco2** (pure JavaScript library) running alongside the existing QR code. This gives better error correction, more reliable detection, and a larger body of working documentation.

---

## Table of Contents

1. [Current Implementation Analysis](#1-current-implementation-analysis)
2. [Why the Current 3x3 Barcode Approach Has Problems](#2-why-the-current-3x3-barcode-approach-has-problems)
3. [Approach Comparison Matrix](#3-approach-comparison-matrix)
4. [Recommended Approach: ArUco 4x4 Inside QR Code](#4-recommended-approach-aruco-4x4-inside-qr-code)
5. [Alternative: AR.js 4x4 Barcode with BCH Error Correction](#5-alternative-arjs-4x4-barcode-with-bch-error-correction)
6. [How QR + AR Marker Coexistence Works](#6-how-qr--ar-marker-coexistence-works)
7. [Label Printer Requirements](#7-label-printer-requirements)
8. [Physical Marker Size vs Detection Distance](#8-physical-marker-size-vs-detection-distance)
9. [Marker Durability on Access Panels](#9-marker-durability-on-access-panels)
10. [Sticker Placement on Access Control Panels](#10-sticker-placement-on-access-control-panels)
11. [SVG Generation for Combined Marker](#11-svg-generation-for-combined-marker)
12. [Detection Architecture Options](#12-detection-architecture-options)
13. [Key Technical Constraints Summary](#13-key-technical-constraints-summary)

---

## 1. Current Implementation Analysis

### What You Have Now (`routes/api.js` + `viewer.js`)

- **AR Framework**: AR.js 3.4.5 with A-Frame 1.3.0
- **Marker Type**: ARToolKit 3x3 barcode markers (values 0-63)
- **Detection Mode**: `mono_and_matrix` with `matrixCodeType: 3x3`
- **QR Integration**: 3x3 barcode embedded in center of QR code
- **QR Error Correction**: Level H (30% recovery)
- **Center Cleared Area**: 128px = ~23.5% of QR area (within 30% budget)
- **Barcode Size**: 96x96px total (48px inner pattern + 24px border each side)
- **Smoothing**: `smoothCount: 10`, `smoothTolerance: 0.1`, `smoothThreshold: 15`
- **Max Panels**: 64 (limited by 3x3 = 6 bits)

### Previous Attempts (from git history)

1. **Pattern markers** (commit 9f88ec2): Used QR code image as `.patt` file. **Abandoned** because ARToolKit downsamples pattern interiors to 16x16 pixels, destroying QR code detail and making different QR codes indistinguishable.
2. **Return to barcode** (commit 600bf54): Current approach. Works better but has reliability issues.

---

## 2. Why the Current 3x3 Barcode Approach Has Problems

### Problem 1: Zero Error Correction
The `3x3` matrixCodeType has **Hamming distance 0** -- no error correction at all. The AR.js documentation itself states markers with Hamming distance 0 are "practically unusable." Any single bit misread causes wrong marker identification.

### Problem 2: Known AR.js Barcode Bugs
Multiple GitHub issues report barcode detection failures:
- **Issue #54**: "Barcode markers may be broken"
- **Issue #664**: `idMatrix` returns -1 for all markers
- **Issue #105**: Marker detected but no 3D content displayed
- **Issue #523**: Previously working code breaks after updates

These are bugs in the underlying **jsartoolkit5** library, not in the marker design.

### Problem 3: Only 64 Unique Markers
3x3 = 9 bits but only 6 are data bits = 64 markers max. If the system grows, this becomes a hard limit.

### Problem 4: Rotational Ambiguity
Some 3x3 patterns look similar when rotated, causing orientation flickering. The "preferred markers" list in `api.js` tries to avoid this, but it's an inherent limitation of the tiny grid.

### Problem 5: Embedded Position Conflicts
The 96px barcode in the QR center, while within the H-level error correction budget, still reduces QR scannability. Some phone cameras struggle with the obstructed center, especially in poor lighting.

---

## 3. Approach Comparison Matrix

| Approach | Detection Reliability | Error Correction | Max Markers | Browser Support | Complexity | QR Coexistence |
|----------|----------------------|-----------------|-------------|----------------|------------|---------------|
| **AR.js 3x3 barcode** (current) | Low-Medium | None (HD=0) | 64 | Built-in | Low | Center embed |
| **AR.js 3x3_HAMMING63** | Medium | 1-bit (HD=3) | 8 | Built-in | Low | Center embed |
| **AR.js 4x4_BCH_13_9_3** | Medium-High | BCH (HD=3) | 512 | Built-in | Low | Center embed |
| **AR.js 4x4_BCH_13_5_5** | High | BCH (HD=5) | 32 | Built-in | Low | Center embed |
| **js-aruco2 DICT_4X4_50** | High | 1-bit correction | 50 | Pure JS library | Medium | Side-by-side or center embed |
| **OpenCV.js ArUco** | Highest | Full OpenCV | 50-1000 | WASM (~8MB) | High | Any layout |
| **AR.js pattern marker** | Low for QR images | N/A | Unlimited | Built-in | Low | QR IS the marker |
| **MindAR NFT** | Very Low for QR images | N/A | Unlimited | Library | Medium | QR IS the marker |

### Verdict

**Best drop-in fix**: Switch to `4x4_BCH_13_5_5` in AR.js (32 markers, highest error correction, minimal code changes).

**Best overall**: Switch to **js-aruco2** with `DICT_4X4_50` for custom detection pipeline with more control, better reliability, and the ability to do QR + ArUco detection simultaneously from the same camera feed.

---

## 4. Recommended Approach: ArUco 4x4 Inside QR Code

### Design: ArUco Marker as QR Code "Logo"

```
┌──────────────────────────────────┐
│ ▄▄▄▄▄▄▄  ▄▄▄ ▄▄▄  ▄▄▄▄▄▄▄      │  QR code with H-level
│ █ ▄▄▄ █ ▄ █▄▀ █▄▀  █ ▄▄▄ █      │  error correction
│ █ ███ █ █▄  ▀▄ ▄▀  █ ███ █      │
│ █▄▄▄▄▄█ ▄▀█▄▀▄█▀▄  █▄▄▄▄▄█     │  Encodes URL:
│  ▄▄▄▄▄ ▀█ ▄ ▀▄▀▄▀  ▄ ▄ ▄       │  https://yourapp/viewer/123
│ █▄ ██▀▄  ┌─────────┐ ▀▄▄ █      │
│ ▄██▄▄▄▀  │ ■ □ ■ ■ │ ▄▀█▄▀     │  Center: 4x4 ArUco marker
│  ▀█▀▄▄█  │ □ ■ □ ■ │ █▀▄▄█     │  (6x6 with border)
│ █▀ █▄ ▄  │ □ □ ■ ■ │  ▄▀▄▀     │  ~20% of QR area
│ ▄▄▄▄▄▄▄  │ □ □ ■ □ │ ██▀▄▄     │
│ █ ▄▄▄ █  └─────────┘ █▀ ▀█     │
│ █ ███ █ ▀▄█▀▄▀█▄▀▄  ▄██▀▀     │
│ █▄▄▄▄▄█ ▄ ▀▄ █▀▄▀▄ ▄█▀▄▀     │
└──────────────────────────────────┘
```

### Why This Works

1. **QR Level H** tolerates 30% damage. A 4x4 ArUco marker (6x6 modules with border) occupies ~15-20% of the QR center — well within budget.
2. **ArUco detection** looks for black-bordered squares with binary interiors — the surrounding QR modules don't confuse it because QR data modules don't form clean bordered squares.
3. **QR scanners** look for the 1:1:3:1:1 ratio finder patterns in the three corners — the ArUco marker in the center doesn't have this pattern and is ignored.
4. **Both detectors are looking for fundamentally different geometric features**, so they don't interfere.

### ArUco DICT_4X4_50 Specifics

- **Grid**: 4x4 internal data bits + 1-module black border = 6x6 total modules
- **Markers available**: 50 unique IDs (0-49)
- **Error correction**: 1-bit correction built into dictionary design
- **Minimum camera pixels**: 20x20px per marker side (30x30 optimal)
- **Inter-marker Hamming distance**: Maximized by the dictionary algorithm — much more robust than AR.js 3x3

### Key js-aruco2 Library Details

- **Repository**: https://github.com/damianofalcioni/js-aruco2
- **Size**: ~50-100KB (pure JavaScript, no WASM)
- **Dictionaries**: Supports ARUCO, ARUCO_MIP_36h12, AprilTag, ARTag, plus all OpenCV-compatible dictionaries (4x4, 5x5, 6x6, 7x7)
- **SVG generation**: Built-in `dictionary.generateSVG(markerId)`
- **Streaming API**: `detectStreamInit()` / `detectStream()` for real-time video
- **Pose estimation**: Yes, included
- **Node.js support**: Yes (can generate markers server-side)
- **Live demo**: https://damianofalcioni.github.io/js-aruco2/

### What Changes in the Code

| Component | Current | Proposed |
|-----------|---------|----------|
| `viewer.js` | AR.js A-Frame scene with `a-marker type=barcode` | Custom camera + canvas + js-aruco2 detection + Three.js overlay |
| `api.js` marker SVG | 3x3 barcode grid in QR center | 4x4 ArUco from DICT_4X4_50 in QR center |
| `api.js` marker values | 0-63 (3x3) | 0-49 (DICT_4X4_50) |
| Detection mode | AR.js built-in | js-aruco2 `detect()` on canvas imageData |
| 3D rendering | A-Frame entities | Three.js with pose from js-aruco2 |

### Trade-off

This is a larger refactor than the AR.js-only fix. The AR.js approach wraps everything in A-Frame declarative elements. Switching to js-aruco2 requires building a custom detection-and-rendering pipeline. The benefit is dramatically better detection reliability and full control over the detection process.

---

## 5. Alternative: AR.js 4x4 Barcode with BCH Error Correction

**Minimal code change, significant reliability improvement.**

### What to Change

```javascript
// viewer.js line 35 — BEFORE:
scene.setAttribute('arjs', `sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 3x3; debugUIEnabled: true;`);

// AFTER:
scene.setAttribute('arjs', `sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 4x4_BCH_13_5_5; debugUIEnabled: true;`);
```

```javascript
// api.js — BEFORE:
// marker_value range: 0-63
// AFTER:
// marker_value range: 0-31
```

### 4x4_BCH_13_5_5 Details

- **Grid**: 4x4 (16 cells)
- **Hamming distance**: 5 (can detect 4-bit errors, correct 2-bit errors)
- **Unique markers**: 32
- **Encoding**: BCH(13,5,5) — 5 data bits, 8 parity bits, using 13 of 16 cells

### SVG Generation Changes

The barcode SVG generator in `api.js` needs to change from drawing a 3x3 grid to a 4x4 grid. The `markerValueToGrid()` function must implement 4x4_BCH_13_5_5 encoding instead of the simple 3x3 binary encoding.

### The BCH(13,5,5) encoding

The encoding uses a generator polynomial over GF(2). The 32 valid codewords for BCH_13_5_5 can be looked up from the ARToolKit source code or generated. Each marker value (0-31) maps to a specific 4x4 bit pattern.

### Barcode Size Adjustment

```
Current 3x3:  border + 3×3 + border = 5×5 cells
New 4x4:      border + 4×4 + border = 6×6 cells
```

The 4x4 marker needs slightly more space per cell to maintain the same total size, or the total barcode area grows slightly. Since the QR's H-level budget is 30% and we're at ~23.5%, there's room to grow.

---

## 6. How QR + AR Marker Coexistence Works

### Why They Don't Interfere

| Feature | QR Code Scanner | ArUco/Barcode Detector |
|---------|----------------|----------------------|
| **Looks for** | Three 7x7 finder patterns in corners (1:1:3:1:1 ratio) | Single black-bordered square with binary interior |
| **Corner dependency** | Relies on three specific corner positions | Finds any qualifying rectangle anywhere in frame |
| **Data extraction** | Zigzag path through entire code | Binary grid read from single bordered square |
| **Error tolerance** | Level H: 30% codeword recovery | Hamming distance / BCH depending on dictionary |

The QR finder patterns (three large concentric squares in corners) look nothing like an ArUco marker border (single thin frame). The ArUco marker in the center has no 1:1:3:1:1 ratio pattern, so QR scanners ignore it. The QR data modules surrounding the ArUco marker don't form clean bordered rectangles, so the ArUco detector ignores them.

### Design Rules for the Combined Sticker

1. **ArUco marker must not overlap QR finder patterns** (corners)
2. **ArUco marker must not overlap QR alignment patterns** (if QR version >= 2)
3. **ArUco marker should occupy ≤20-25%** of QR area for safe scanning
4. **Both need adequate quiet zones**: QR needs 4 modules of white border; ArUco needs ~1 module of white around its black border
5. **White gap between ArUco border and surrounding QR modules** is critical for ArUco detection

### QR Code Structure Reference

For a Version 3 QR code (29×29 modules, typical for a URL like `https://app.example.com/v/123`):

```
Finder patterns: (0,0)→(6,6), (0,22)→(6,28), (22,0)→(28,6)
Timing patterns: Row 6 and Column 6
Alignment pattern: Center at (22,22) — a 5×5 square
Safe center zone for logo: approximately modules (10,10) to (18,18) = 9×9 modules
9×9 = 81 modules out of 841 total = ~9.6% of area (well within 30% budget)
```

For a 4x4 ArUco marker (6×6 modules with border), you need 6 QR modules of space. A 9×9 module center zone comfortably fits a 6×6 ArUco marker with 1.5 modules of quiet zone on each side.

---

## 7. Label Printer Requirements

### Resolution

| DPI | Suitability | Notes |
|-----|-------------|-------|
| 203 | Adequate for ≥3" markers | Each module of a 4x4 ArUco on a 2" label gets ~25 dots |
| **300** | **Recommended minimum** | Each module gets ~37 dots — sharp edges |
| 600 | Ideal for <2" markers | Each module gets ~75 dots — maximum sharpness |

### Printing Technology

| Technology | Contrast | Durability | AR Suitability |
|-----------|---------|------------|---------------|
| Direct thermal | High initially | 6-8 months, fades with heat/UV | **Not recommended** — degrades too fast |
| **Thermal transfer (resin ribbon)** | **High (OD ~1.1)** | **2-5+ years indoor** | **Recommended** |
| Inkjet | High | Variable | OK with lamination |
| Laser | High | Good | OK |

### Recommended Printers

| Printer | DPI | Width | Type | Price Range |
|---------|-----|-------|------|-------------|
| **Brady i5300** | 300 or **600** | 4" | Thermal transfer | ~$3,000-5,000 |
| Brady BMP71 | 300 | 2" | Thermal transfer | ~$700-1,000 |
| Brady BMP51 | 300 | 1.5" | Thermal transfer | ~$400-600 |
| Zebra ZT610 | 300 or 600 | 4" | Thermal transfer | ~$2,000-4,000 |
| Zebra ZD420 | 300 | 4" | Thermal transfer | ~$500-800 |
| Brother QL-820NWB | 300 | 2.3" | Direct thermal | ~$200 (not recommended for durability) |

### Label Material Stack (Recommended)

```
Top:     Matte polyester overlaminate (UV + scratch protection, NO GLOSS)
Print:   Resin ribbon thermal transfer ink (optical density ~1.1)
Base:    White matte polyester label stock
Bottom:  Industrial-grade permanent acrylic adhesive
```

**Critical: Use MATTE finish only.** Glossy lamination causes specular reflections that wash out the marker in the camera image and cause complete detection failure at certain angles.

### Label Sizes

| Size | Best For |
|------|---------|
| 2" × 2" | Small panels, indoor use at 1-2 ft detection distance |
| **3" × 3"** | **Recommended default** — good balance for 1-3 ft detection |
| 4" × 4" | Large panels, door labels, 1-5 ft detection range |

---

## 8. Physical Marker Size vs Detection Distance

### Formula

```
Max Detection Distance ≈ (Marker Size × Camera Focal Length in px) / Min Pixels Needed
```

For a typical 1080p phone camera (~60° FOV, ~1800px focal length):

| Marker Size | Min Reliable Distance | Max Reliable Distance | Use Case |
|------------|----------------------|----------------------|----------|
| 1" (25mm) | ~4" | ~1.5 ft | Inside panel door |
| **2" (50mm)** | **~6"** | **~3 ft** | **Small panel face labels** |
| **3" (75mm)** | **~6"** | **~5 ft** | **Standard panel labels** |
| 4" (100mm) | ~6" | ~7 ft | Large panels, distant ID |

### Key Points

- **ArUco DICT_4X4_50** needs minimum **20×20 pixels** in the camera image; **30×30 is optimal**
- At 3 feet with a 1080p camera, a 2" marker occupies ~100 pixels — well above minimum
- **Smaller dictionaries (4x4 vs 6x6) allow smaller physical markers** because each cell is larger relative to total marker size
- The 4x4 grid with 1-cell border = 6×6 total modules is the coarsest ArUco option, meaning each module can be the largest for a given physical size

### For Access Control Panels Specifically

Typical use: technician holds phone 1-3 feet from panel.

- **2" sticker**: Works for 1-3 feet. Fits on most panel labels.
- **3" sticker**: Works for 1-5 feet. Gives comfortable margin. **Recommended.**
- Combined QR+ArUco on a 3" sticker: QR at ~29×29 modules at 3" = each module is ~2.6mm. ArUco marker in center at 6×6 modules = ~16mm (0.6") — detectable at 3+ feet.

---

## 9. Marker Durability on Access Panels

### Indoor Access Panel Environment

- Temperature: 60-90°F typically (near electrical equipment may be warmer)
- Lighting: fluorescent overhead
- Exposure: occasional cleaning, physical contact during maintenance
- Lifespan needed: 2-5 years minimum

### Material Durability Comparison

| Material | Indoor Life | UV Resistance | Chemical Resistance | AR Marker Suitability |
|---------|------------|--------------|--------------------|-----------------------|
| Direct thermal paper | 6-8 months | None | None | **Not suitable** |
| **Thermal transfer on polyester** | **5+ years** | **Good** | **Good** | **Excellent** |
| Thermal transfer on vinyl | 5-7 years | Good | Excellent | Excellent |
| Laminated polyester | 7-10 years | Excellent | Excellent | Excellent (if matte) |

### Degradation Factors

| Factor | Risk Level (Indoor) | Mitigation |
|--------|-------------------|------------|
| UV from fluorescent lights | Low | Polyester substrate, matte laminate |
| Heat from nearby equipment | Medium | Thermal transfer ink (stable to 300°F) |
| Cleaning chemicals | Medium | Polyester + matte overlaminate |
| Physical abrasion | Low-Medium | Matte laminate overlay |
| Adhesive failure | Low | Industrial permanent acrylic adhesive |

### Recommended Material

**White matte polyester** with **resin ribbon thermal transfer** printing and **matte polyester overlaminate**. This combination provides:
- 5+ year indoor lifespan
- High contrast maintained (OD ~1.1 black, ~0.05 white = >20:1 ratio)
- Matte surface prevents camera glare
- Chemical and abrasion resistance
- Temperature tolerance -40°F to +300°F

---

## 10. Sticker Placement on Access Control Panels

### Placement Rules

1. **On the panel door face** (visible with door closed)
2. **At approximately eye level** or near the main disconnect/breaker
3. **On a flat surface** — curved or textured surfaces degrade AR detection
4. **Not obscured by** conduit, cable trays, or adjacent equipment
5. **Near cover lockscrews** so it's visible when approaching with tools
6. **Clean the surface** with isopropyl alcohol before applying

### Regulatory Considerations

- Labels must be **legible from 5 feet** (NFPA 70E) — applies to safety labels, not necessarily AR markers
- Must be **permanently attached** per UL 508A Section 52.4
- Should not interfere with existing arc flash, voltage, or safety labels
- All labels must match the panel documentation

### Backup Marker

Consider placing a **second marker inside the panel door** (visible when open). This provides:
- Redundancy if the exterior marker is damaged
- AR overlay for internal wiring (different viewing angle)
- Protection from external damage

---

## 11. SVG Generation for Combined Marker

### Current Implementation (api.js lines 314-389)

The current code generates a combined SVG by:
1. Generating QR code grid via the `qrcode` npm library
2. Drawing QR modules as SVG rectangles, skipping center area
3. Drawing 3x3 barcode marker in the cleared center

### Proposed Changes for ArUco 4x4

#### Option A: Use js-aruco2 for SVG Generation

```javascript
// Server-side (Node.js)
const AR = require('js-aruco2');
const dictionary = new AR.Dictionary('DICT_4X4_50');
const markerSVG = dictionary.generateSVG(markerId);
// Then embed this SVG into the QR code center
```

#### Option B: Generate ArUco Grid Manually

ArUco DICT_4X4_50 marker patterns can be stored as a lookup table (50 entries of 16 bits each). The SVG generation would change from 3x3 to 4x4:

```javascript
// Pseudocode for the changed marker center
const ARUCO_4X4_50 = [
  [181, 50],  // ID 0
  [15, 154],  // ID 1
  [51, 45],   // ID 2
  // ... 47 more entries
];

function arucoToGrid(markerId) {
  const bytes = ARUCO_4X4_50[markerId];
  const bits = ((bytes[0] << 8) | bytes[1]);
  const grid = [];
  for (let row = 0; row < 4; row++) {
    grid[row] = [];
    for (let col = 0; col < 4; col++) {
      grid[row][col] = (bits >> (15 - (row * 4 + col))) & 1;
    }
  }
  return grid; // 1 = black, 0 = white
}
```

#### SVG Structure (4x4 with border = 6x6)

```javascript
// 6x6 total modules: 1 border + 4x4 inner + 1 border
const totalCells = 6; // 4 inner + 2 border
const cellSize = Math.floor(barcodeInner / 4); // 4 cells instead of 3

// Draw black border (full square)
// Draw white inner (4x4 area)
// Draw 4x4 data cells
for (let row = 0; row < 4; row++) {
  for (let col = 0; col < 4; col++) {
    const color = grid[row][col] ? 'black' : 'white';
    // draw rect at (innerX + col*cellSize, innerY + row*cellSize)
  }
}
```

### Center Area Budget

For a Version 3 QR (29×29 modules, moduleSize=8px):
- QR total: 29×8 = 232px
- ArUco 6×6 cells at 16px each = 96px
- Quiet zone: 16px each side
- Total cleared: 128px = 16 modules
- 16/29 = 55% of a row, but (16×16)/(29×29) = 30.4% of area

This is right at the H-level budget. To be safe, reduce:
- ArUco cells to 14px each: 6×14 = 84px
- Quiet zone: 14px each side
- Total cleared: 112px = 14 modules
- (14×14)/(29×29) = 23.3% of area — safe

---

## 12. Detection Architecture Options

### Option A: Stay with AR.js (Minimal Change)

```
Phone Camera → AR.js (ARToolKit) → Barcode Detection → A-Frame 3D Overlay
```

**Changes**: Switch from `3x3` to `4x4_BCH_13_5_5`.

**Pros**: Minimal code changes, keep existing A-Frame scene structure.
**Cons**: Still dependent on buggy jsartoolkit5 barcode detection.

### Option B: js-aruco2 + Three.js (Recommended)

```
Phone Camera → Canvas → js-aruco2 detect() → Pose Estimation → Three.js 3D Overlay
                     ↘ jsQR decode() → Panel ID (fallback)
```

**Pros**: Full control, better detection, lighter than OpenCV.js (~100KB vs 8MB).
**Cons**: Requires rewriting viewer from A-Frame to Three.js + custom rendering.

### Option C: js-aruco2 Detection + A-Frame Rendering (Hybrid)

```
Phone Camera → Canvas → js-aruco2 detect() → Custom A-Frame component → 3D Overlay
```

**Pros**: Keep A-Frame's declarative approach for 3D content, use js-aruco2 for reliable detection.
**Cons**: Requires writing a custom A-Frame component that bridges js-aruco2 pose data to A-Frame entity positions.

### Option D: OpenCV.js Full Pipeline (Maximum Reliability)

```
Phone Camera → Canvas → OpenCV.js WASM → ArUco detectMarkers() → Pose → Three.js
```

**Pros**: Identical detection to desktop OpenCV, maximum reliability.
**Cons**: 8MB WASM download, slower startup, higher complexity.

### Option E: Web Worker Pipeline (Best Performance)

```
Main Thread: Camera → Canvas → Transfer ImageData → [receive pose] → Three.js render
Web Worker:  [receive ImageData] → js-aruco2 detect() → [send pose back]
```

**Pros**: Detection doesn't block rendering — smooth 60fps.
**Cons**: More complex architecture, data transfer overhead.

### Recommendation

**Start with Option A** (switch to `4x4_BCH_13_5_5`) as an immediate improvement with minimal risk. If that doesn't resolve the detection issues, **move to Option B or C** using js-aruco2.

---

## 13. Key Technical Constraints Summary

### Must-Have Requirements

| Requirement | Constraint | Solution |
|------------|-----------|---------|
| QR scannable by any phone | QR Level H with ≤25% center obstruction | Keep center ArUco under 20-25% area |
| AR marker detectable | Minimum 20×20px in camera at working distance | 2-3" physical marker, 4x4 grid |
| Printable on label printer | 300+ DPI, thermal transfer on polyester | Brady/Zebra printer with resin ribbon |
| Durable on access panel | 2-5 year indoor life, matte finish | Polyester + matte overlaminate |
| Unique per panel | Enough marker IDs for all panels | DICT_4X4_50 = 50 panels, BCH_13_5_5 = 32 |

### Critical Design Rules

1. **MATTE finish only** — glossy surfaces cause specular reflections that kill detection
2. **White quiet zone** between ArUco border and QR modules — minimum 1 module width
3. **ArUco must not overlap QR finder patterns** (the three 7×7 corner squares)
4. **Test both QR scanning AND AR detection** on every generated sticker design
5. **Print markers, never rely on screen display** for real-world use
6. **Use the simplest/coarsest grid available** (4x4) for maximum cell size at a given physical marker size

### What NOT to Attempt

- **QR code as NFT image target**: QR codes have too little visual complexity for natural feature tracking. MindAR, AR.js NFT, and similar systems explicitly warn against low-complexity images.
- **QR code as ARToolKit pattern marker**: The 16×16 downsampling destroys QR detail. Different QR codes become indistinguishable. You already tried this and it failed (commit 9f88ec2).
- **STag markers in browser**: No JavaScript implementation exists. Would require custom WASM compilation from C++ source.
- **Glossy labels**: Camera glare makes detection intermittent or impossible.
- **Direct thermal printing**: Labels fade in months, especially near warm electrical equipment.

---

## Appendix A: ArUco DICT_4X4_50 Byte Patterns (First 32)

These are the raw byte pairs for generating each marker's 4x4 grid:

```
ID  0: [181, 50]    ID  8: [254, 218]   ID 16: [167, 117]   ID 24: [92, 126]
ID  1: [15, 154]    ID  9: [207, 86]    ID 17: [86, 54]     ID 25: [217, 19]
ID  2: [51, 45]     ID 10: [97, 236]    ID 18: [118, 209]   ID 26: [238, 115]
ID  3: [153, 70]    ID 11: [241, 125]   ID 19: [164, 78]    ID 27: [156, 164]
ID  4: [84, 158]    ID 12: [186, 209]   ID 20: [180, 215]   ID 28: [37, 220]
ID  5: [121, 205]   ID 13: [199, 19]    ID 21: [117, 228]   ID 29: [91, 124]
ID  6: [158, 46]    ID 14: [220, 167]   ID 22: [163, 57]    ID 30: [180, 71]
ID  7: [196, 242]   ID 15: [185, 108]   ID 23: [227, 90]    ID 31: [46, 125]
```

Decode: `bits = (byte0 << 8) | byte1`, then read bits 15→0 as row0col0→row3col3.

## Appendix B: Useful Tools and Libraries

| Tool | URL | Purpose |
|------|-----|---------|
| js-aruco2 | https://github.com/damianofalcioni/js-aruco2 | Pure JS ArUco detection + SVG generation |
| aruco-marker npm | https://www.npmjs.com/package/aruco-marker | SVG marker generation (original dict only) |
| Online ArUco Generator | https://chev.me/arucogen/ | Generate and download ArUco marker images |
| AR.js Marker Trainer | https://jeromeetienne.github.io/AR.js/three.js/examples/marker-training/examples/generator.html | Generate .patt files from images |
| QR Code Monkey | https://www.qrcodemonkey.com/ | Generate QR codes with embedded logos |
| qrcode-svg npm | https://www.npmjs.com/package/qrcode-svg | Pure JS QR code SVG generation |
| @akamfoad/qrcode | https://github.com/akamfoad/qrcode | QR SVG with native logo embedding support |
| qr-code-styling | https://www.npmjs.com/package/qr-code-styling | Highly customizable QR with logo |
| Labelary ZPL Viewer | https://labelary.com/viewer.html | Preview ZPL label code |

## Appendix C: AR.js Barcode Matrix Type Quick Reference

| Type | Grid | Markers | Hamming Dist | Error Correction |
|------|------|---------|-------------|-----------------|
| `3x3` | 3×3 | 64 | 0 | None |
| `3x3_PARITY65` | 3×3 | 32 | 1 | Parity only |
| `3x3_HAMMING63` | 3×3 | 8 | 3 | 1-bit correct |
| `4x4` | 4×4 | 8,192 | 0 | None |
| `4x4_BCH_13_9_3` | 4×4 | 512 | 3 | BCH |
| `4x4_BCH_13_5_5` | 4×4 | 32 | 5 | BCH (strongest) |
