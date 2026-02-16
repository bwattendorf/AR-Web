const panelId = window.location.pathname.split('/').pop();
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const panelNameEl = document.getElementById('panel-name');
const sceneContainer = document.getElementById('scene-container');
const log = window._debugLog || console.log;

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

    // Marker position in the photo
    const markerX = panel.marker_x_percent != null ? panel.marker_x_percent : 0.5;
    const markerY = panel.marker_y_percent != null ? panel.marker_y_percent : 0.5;

    // Load annotations
    const annRes = await fetch(`/api/panels/${panelId}/annotations`);
    const annotations = await annRes.json();
    log(`Loaded ${annotations.length} annotations`);

    loadingText.textContent = 'Starting camera...';

    // Build scene as HTML string matching official AR.js examples exactly
    const markerVal = panel.marker_value;
    const scale = 2.5;

    // Build annotation entities HTML
    let annotationHTML = '';
    annotations.forEach((ann, index) => {
      const dx = ann.x_percent - markerX;
      const dy = ann.y_percent - markerY;
      const x = (dx * scale).toFixed(3);
      const z = (dy * scale).toFixed(3);
      const y = (0.3 + index * 0.05).toFixed(3);
      const bgW = Math.max(0.6, ann.label.length * 0.06 + 0.15).toFixed(2);

      annotationHTML += `
        <a-entity position="${x} ${y} ${z}">
          <a-plane width="${bgW}" height="0.18" color="#000" opacity="0.7" position="0 0 0.001"></a-plane>
          <a-text value="${ann.label}" color="${ann.color}" align="center" width="1.5" position="0 0 0.002"></a-text>
          <a-entity geometry="primitive: cylinder; radius: 0.008; height: ${y}" material="color: ${ann.color}; opacity: 0.6" position="0 ${(-y / 2).toFixed(3)} 0"></a-entity>
          <a-sphere radius="0.025" color="${ann.color}" position="0 ${(-y).toFixed(3)} 0"></a-sphere>
        </a-entity>
      `;

      log(`Annotation "${ann.label}" at (${x}, ${y}, ${z})`);
    });

    // Insert scene as HTML (more reliable than dynamic createElement for A-Frame)
    sceneContainer.innerHTML = `
      <a-scene
        embedded
        arjs="sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 4x4_BCH_13_5_5; debugUIEnabled: true;"
        renderer="precision: mediump; antialias: true;"
        vr-mode-ui="enabled: false"
      >
        <a-marker
          type="barcode"
          value="${markerVal}"
          smooth="true"
          smoothCount="5"
          smoothTolerance="0.05"
          smoothThreshold="5"
        >
          <!-- Test cube - should always be visible when marker detected -->
          <a-box position="0 0.5 0" color="#FF0000" scale="0.5 0.5 0.5"></a-box>

          <!-- Annotations -->
          ${annotationHTML}
        </a-marker>

        <a-entity camera></a-entity>
      </a-scene>
    `;

    log(`Scene HTML injected, marker value=${markerVal}`);

    // Wait for scene to initialize
    const scene = sceneContainer.querySelector('a-scene');
    if (scene) {
      const marker = scene.querySelector('a-marker');

      marker.addEventListener('markerFound', () => {
        log('MARKER FOUND! value=' + markerVal);
        document.getElementById('info-bar').style.background = 'rgba(0,128,0,0.7)';
      });
      marker.addEventListener('markerLost', () => {
        log('Marker lost');
        document.getElementById('info-bar').style.background = 'rgba(0,0,0,0.7)';
      });

      scene.addEventListener('loaded', () => {
        log('A-Frame scene loaded');
        setTimeout(() => { loadingOverlay.classList.add('hidden'); }, 1500);
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
