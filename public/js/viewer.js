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

// Store annotations data for click handler
let annotationsData = [];

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
      const bgW = Math.max(0.7, ann.label.length * 0.08 + 0.2).toFixed(2);

      // Stem height matches z (toward camera)
      const stemH = parseFloat(z);

      const hasWiring = ann.wiring_points && ann.wiring_points.length > 0;
      const clickClass = hasWiring ? 'clickable' : '';

      annotationHTML += `
        <a-entity position="${x} ${y} ${z}" class="${clickClass}" data-ann-id="${ann.id}">
          <a-plane width="${bgW}" height="0.22" color="${ann.color}" opacity="0.9" position="0 0 0.001" class="${clickClass}" data-ann-id="${ann.id}"></a-plane>
          <a-text value="${ann.label}" color="#fff" align="center" width="1.8" position="0 0 0.002"></a-text>
          <a-entity geometry="primitive: cylinder; radius: 0.01; height: ${stemH}" material="color: ${ann.color}; opacity: 0.8" rotation="90 0 0" position="0 0 ${(-stemH / 2).toFixed(3)}"></a-entity>
          <a-sphere radius="0.03" color="${ann.color}" position="0 0 ${(-stemH).toFixed(3)}"></a-sphere>
        </a-entity>
      `;

      log(`Annotation "${ann.label}" at (${x}, ${y}, ${z})${hasWiring ? ` [${ann.wiring_points.length} wiring pts]` : ''}`);
    });

    // Insert MindAR scene
    sceneContainer.innerHTML = `
      <a-scene
        mindar-image="imageTargetSrc: ${targetUrl}"
        vr-mode-ui="enabled: false"
        device-orientation-permission-ui="enabled: false"
        renderer="precision: mediump; antialias: true;"
      >
        <a-camera position="0 0 0" look-controls="enabled: false"
          cursor="fuse: false; rayOrigin: mouse"
          raycaster="objects: .clickable"></a-camera>

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

        // Attach click handlers to clickable annotations
        const clickables = scene.querySelectorAll('.clickable[data-ann-id]');
        clickables.forEach(el => {
          el.addEventListener('click', () => {
            const annId = parseInt(el.getAttribute('data-ann-id'));
            const ann = annotationsData.find(a => a.id === annId);
            if (ann) showWiringOverlay(ann);
          });
        });
      });
    }

    // Fallback: hide overlay after 5s
    setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 5000);

  } catch (err) {
    loadingText.textContent = 'Error: ' + err.message;
    log('ERROR: ' + err.message);
  }
}

init();
