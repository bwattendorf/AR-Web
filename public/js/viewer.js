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

    // Load annotations
    const annRes = await fetch(`/api/panels/${panelId}/annotations`);
    const annotations = await annRes.json();
    log(`Loaded ${annotations.length} annotations`);

    loadingText.textContent = 'Starting camera...';

    const scale = 2.5;

    // Build annotation entities HTML
    // MindAR coordinate system: XY plane facing camera, Z toward camera
    // Target width is normalized to 1
    let annotationHTML = '';
    annotations.forEach((ann, index) => {
      const x = ((ann.x_percent - markerX) * scale).toFixed(3);
      const y = (-(ann.y_percent - markerY) * scale).toFixed(3);
      const z = (0.3 + index * 0.05).toFixed(3);
      const bgW = Math.max(0.6, ann.label.length * 0.06 + 0.15).toFixed(2);

      // Stem height matches z (toward camera)
      const stemH = parseFloat(z);

      annotationHTML += `
        <a-entity position="${x} ${y} ${z}">
          <a-plane width="${bgW}" height="0.18" color="#000" opacity="0.7" position="0 0 0.001"></a-plane>
          <a-text value="${ann.label}" color="${ann.color}" align="center" width="1.5" position="0 0 0.002"></a-text>
          <a-entity geometry="primitive: cylinder; radius: 0.008; height: ${stemH}" material="color: ${ann.color}; opacity: 0.6" rotation="90 0 0" position="0 0 ${(-stemH / 2).toFixed(3)}"></a-entity>
          <a-sphere radius="0.025" color="${ann.color}" position="0 0 ${(-stemH).toFixed(3)}"></a-sphere>
        </a-entity>
      `;

      log(`Annotation "${ann.label}" at (${x}, ${y}, ${z})`);
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
