const panelId = window.location.pathname.split('/').pop();
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const panelNameEl = document.getElementById('panel-name');
const sceneContainer = document.getElementById('scene-container');
const log = window._debugLog || console.log;

// --- Wiring overlay ---
const wiringOverlay = document.getElementById('wiring-overlay');
const wiringTitle = document.getElementById('wiring-title');
const wiringDesc = document.getElementById('wiring-desc');
const wiringTbody = document.getElementById('wiring-tbody');

// Wire color name to CSS color mapping
const WIRE_COLORS = {
  red: '#dc2626', blue: '#2563eb', green: '#16a34a', yellow: '#eab308',
  orange: '#ea580c', white: '#f5f5f5', black: '#1f2937', brown: '#92400e',
  purple: '#7c3aed', pink: '#ec4899', gray: '#6b7280', grey: '#6b7280',
  violet: '#7c3aed', tan: '#d2b48c',
};

function showWiringOverlay(ann) {
  wiringTitle.textContent = ann.label;
  wiringDesc.textContent = ann.description || '';
  wiringTbody.innerHTML = '';

  if (!ann.wiring_points || ann.wiring_points.length === 0) {
    wiringTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No wiring points defined</td></tr>';
  } else {
    ann.wiring_points.forEach(pt => {
      const tr = document.createElement('tr');
      const colorLower = (pt.wire_color || '').toLowerCase().trim();
      const cssColor = WIRE_COLORS[colorLower] || colorLower;
      const dot = cssColor ? `<span class="wire-color-dot" style="background:${cssColor}"></span>` : '';
      tr.innerHTML = `
        <td><strong>${pt.pin}</strong></td>
        <td>${pt.label}</td>
        <td>${dot}${pt.wire_color}</td>
        <td>${pt.description || ''}</td>
      `;
      wiringTbody.appendChild(tr);
    });
  }

  wiringOverlay.classList.add('visible');
}

window.closeWiringOverlay = function() {
  wiringOverlay.classList.remove('visible');
};

// Store annotations data and their A-Frame entities for tap detection
let annotationsData = [];
let clickableEntities = []; // { entity, annId }

async function init() {
  try {
    // Load panel info
    const panelRes = await fetch(`/api/panels/${panelId}`);
    if (!panelRes.ok) {
      loadingText.textContent = 'Panel not found';
      log('ERROR: Panel not found');
      return;
    }
    const panel = await panelRes.json();
    panelNameEl.textContent = panel.name;
    log(`Panel: ${panel.name}, marker: ${panel.marker_value}`);

    // Manual button
    const manualBtn = document.getElementById('manual-btn');
    if (panel.manual_url) {
      manualBtn.href = panel.manual_url;
      manualBtn.style.display = '';
    } else if (panel.manual_filename) {
      manualBtn.href = `/api/panels/${panelId}/manual.pdf`;
      manualBtn.style.display = '';
    }

    // Check that .mind target file exists
    const targetUrl = `/api/panels/${panelId}/target.mind`;
    const targetCheck = await fetch(targetUrl, { method: 'HEAD' });
    if (!targetCheck.ok) {
      loadingText.textContent = 'AR target not compiled yet. Open the editor and click "Compile AR Target".';
      log('ERROR: .mind target file not found');
      return;
    }

    // Marker position in the photo
    const markerX = panel.marker_x_percent != null ? panel.marker_x_percent : 0.5;
    const markerY = panel.marker_y_percent != null ? panel.marker_y_percent : 0.5;

    // Load annotations with wiring points
    const annRes = await fetch(`/api/panels/${panelId}/annotations-with-wiring`);
    annotationsData = await annRes.json();
    log(`Loaded ${annotationsData.length} annotations`);

    loadingText.textContent = 'Starting camera...';

    const scale = 2.5;

    // Build annotation entities HTML
    // MindAR coordinate system: XY plane facing camera, Z toward camera
    // Target width is normalized to 1
    let annotationHTML = '';
    annotationsData.forEach((ann, index) => {
      const x = ((ann.x_percent - markerX) * scale).toFixed(3);
      const y = (-(ann.y_percent - markerY) * scale).toFixed(3);
      const z = (0.3 + index * 0.05).toFixed(3);

      const fontSize = ann.font_size || 16;
      const textWidth = (fontSize / 16 * 1.8).toFixed(2);
      const bgW = Math.max(0.7, ann.label.length * (fontSize / 16) * 0.08 + 0.2).toFixed(2);
      const bgH = (fontSize / 16 * 0.22).toFixed(2);

      const rotation = ann.rotation || 0;
      const fontFamily = ann.font_family || '';

      // Map font_family to A-Frame font
      let fontAttr = '';
      if (fontFamily === 'monospace') fontAttr = 'font: monoid';
      else if (fontFamily === 'serif') fontAttr = 'font: sourcecodepro';

      // Stem height matches z (toward camera)
      const stemH = parseFloat(z);

      const hasWiring = ann.wiring_points && ann.wiring_points.length > 0;

      // Rotation around the anchor: rotate the whole annotation entity around its Z axis
      const entityRotation = `0 0 ${rotation}`;

      annotationHTML += `
        <a-entity position="${x} ${y} 0" rotation="0 0 0" data-ann-id="${ann.id}" ${hasWiring ? 'data-has-wiring="true"' : ''}>
          <a-entity rotation="${entityRotation}">
            <a-entity position="0 0 ${z}">
              <a-plane width="${bgW}" height="${bgH}" color="${ann.color}" opacity="0.9" position="0 0 0.001"></a-plane>
              <a-text value="${ann.label}" color="#fff" align="center" width="${textWidth}" position="0 0 0.002" ${fontAttr}></a-text>
            </a-entity>
            <a-entity geometry="primitive: cylinder; radius: 0.01; height: ${stemH}" material="color: ${ann.color}; opacity: 0.8" rotation="90 0 0" position="0 0 ${(stemH / 2).toFixed(3)}"></a-entity>
          </a-entity>
          <a-sphere radius="0.03" color="${ann.color}" position="0 0 0"></a-sphere>
        </a-entity>
      `;

      log(`Annotation "${ann.label}" at (${x}, ${y}, ${z}) rot=${rotation}° font=${fontSize}px${hasWiring ? ` [${ann.wiring_points.length} wiring pts]` : ''}`);
    });

    // Insert MindAR scene
    sceneContainer.innerHTML = `
      <a-scene
        mindar-image="imageTargetSrc: ${targetUrl}"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        renderer="precision: mediump; antialias: true;"
      >
        <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>

        <a-entity mindar-image-target="targetIndex: 0">
          <!-- Annotations -->
          ${annotationHTML}
        </a-entity>
      </a-scene>
    `;

    log('Scene HTML injected (MindAR)');

    // Wait for scene to initialize
    const scene = sceneContainer.querySelector('a-scene');
    if (scene) {
      const target = scene.querySelector('[mindar-image-target]');

      target.addEventListener('targetFound', () => {
        log('TARGET FOUND!');
        document.getElementById('info-bar').style.background = 'rgba(0,128,0,0.7)';
      });
      target.addEventListener('targetLost', () => {
        log('Target lost');
        document.getElementById('info-bar').style.background = 'rgba(0,0,0,0.7)';
      });

      scene.addEventListener('loaded', () => {
        log('A-Frame scene loaded');
        setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 1500);

        // Collect clickable annotation entities for screen-tap detection
        const annEntities = scene.querySelectorAll('[data-has-wiring]');
        annEntities.forEach(el => {
          clickableEntities.push({
            entity: el,
            annId: parseInt(el.getAttribute('data-ann-id'))
          });
        });
        log(`${clickableEntities.length} clickable annotations registered`);

        // Screen-tap detection: project 3D positions to 2D and find tapped annotation
        const canvas = scene.canvas;
        if (canvas) {
          canvas.addEventListener('click', onCanvasTap);
          canvas.addEventListener('touchend', onCanvasTap);
          log('Tap handlers attached to canvas');
        }
      });
    }

    // Fallback: hide overlay after 5s
    setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 5000);

  } catch (err) {
    loadingText.textContent = 'Error: ' + err.message;
    log('ERROR: ' + err.message);
  }
}

// Screen-space tap detection
function onCanvasTap(e) {
  // Don't process if wiring overlay is open
  if (wiringOverlay.classList.contains('visible')) return;

  // Get tap position on screen
  let clientX, clientY;
  if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length > 0) {
    clientX = e.changedTouches[0].clientX;
    clientY = e.changedTouches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  if (clientX == null || clientY == null) return;

  const scene = sceneContainer.querySelector('a-scene');
  if (!scene || !scene.camera) return;

  const camera = scene.camera;
  const canvas = scene.canvas;
  const rect = canvas.getBoundingClientRect();

  // Threshold in pixels for tap proximity
  const TAP_THRESHOLD = 60;
  let closest = null;
  let closestDist = Infinity;

  const THREE = AFRAME.THREE;
  const worldPos = new THREE.Vector3();

  clickableEntities.forEach(({ entity, annId }) => {
    // Get world position of the annotation entity
    entity.object3D.getWorldPosition(worldPos);

    // Project to screen coordinates
    const projected = worldPos.clone().project(camera);

    // Convert from NDC (-1 to 1) to pixel coordinates
    const screenX = (projected.x + 1) / 2 * rect.width + rect.left;
    const screenY = (-projected.y + 1) / 2 * rect.height + rect.top;

    // Check if annotation is in front of camera (z < 1)
    if (projected.z > 1) return;

    const dist = Math.hypot(clientX - screenX, clientY - screenY);
    if (dist < TAP_THRESHOLD && dist < closestDist) {
      closestDist = dist;
      closest = annId;
    }
  });

  if (closest != null) {
    const ann = annotationsData.find(a => a.id === closest);
    if (ann) {
      log(`Tapped annotation: "${ann.label}"`);
      showWiringOverlay(ann);
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

init();
