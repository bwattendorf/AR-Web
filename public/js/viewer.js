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

    // Build A-Frame scene dynamically so marker is correct from the start
    loadingText.textContent = 'Starting camera...';

    const scene = document.createElement('a-scene');
    scene.setAttribute('embedded', '');
    scene.setAttribute('arjs', `sourceType: webcam; detectionMode: mono_and_matrix; matrixCodeType: 3x3; debugUIEnabled: true;`);
    scene.setAttribute('renderer', 'logarithmicDepthBuffer: true; antialias: true;');
    scene.setAttribute('vr-mode-ui', 'enabled: false');

    // Create barcode marker using the panel's marker_value
    const marker = document.createElement('a-marker');
    marker.setAttribute('type', 'barcode');
    marker.setAttribute('value', panel.marker_value);
    marker.setAttribute('smooth', 'true');
    marker.setAttribute('smoothCount', '5');
    marker.setAttribute('smoothTolerance', '0.05');
    marker.setAttribute('smoothThreshold', '5');

    log(`Created a-marker type=barcode value=${panel.marker_value}`);
    log(`AR.js config: detectionMode=mono_and_matrix, matrixCodeType=3x3`);

    // Listen for marker found/lost events
    marker.addEventListener('markerFound', () => {
      log('Marker FOUND!');
      document.getElementById('info-bar').style.background = 'rgba(0,128,0,0.7)';
    });
    marker.addEventListener('markerLost', () => {
      log('Marker lost');
      document.getElementById('info-bar').style.background = 'rgba(0,0,0,0.7)';
    });

    // Add annotation entities relative to marker position
    const scale = 2.5;

    annotations.forEach((ann, index) => {
      const dx = ann.x_percent - markerX;
      const dy = ann.y_percent - markerY;

      const x = dx * scale;
      const z = dy * scale;
      const y = 0.3 + (index * 0.05);

      const entity = document.createElement('a-entity');
      entity.setAttribute('position', `${x} ${y} ${z}`);

      // Background plane
      const bg = document.createElement('a-plane');
      bg.setAttribute('width', Math.max(0.6, ann.label.length * 0.06 + 0.15));
      bg.setAttribute('height', '0.18');
      bg.setAttribute('color', '#000000');
      bg.setAttribute('opacity', '0.7');
      bg.setAttribute('position', '0 0 0.001');

      // Text label
      const text = document.createElement('a-text');
      text.setAttribute('value', ann.label);
      text.setAttribute('color', ann.color);
      text.setAttribute('align', 'center');
      text.setAttribute('width', '1.5');
      text.setAttribute('position', '0 0 0.002');

      // Connecting line
      const line = document.createElement('a-entity');
      line.setAttribute('geometry', `primitive: cylinder; radius: 0.008; height: ${y}`);
      line.setAttribute('material', `color: ${ann.color}; opacity: 0.6`);
      line.setAttribute('position', `0 ${-y / 2} 0`);

      // Base dot
      const dot = document.createElement('a-sphere');
      dot.setAttribute('radius', '0.025');
      dot.setAttribute('color', ann.color);
      dot.setAttribute('position', `0 ${-y} 0`);

      entity.appendChild(bg);
      entity.appendChild(text);
      entity.appendChild(line);
      entity.appendChild(dot);
      marker.appendChild(entity);

      log(`Annotation "${ann.label}" at (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
    });

    scene.appendChild(marker);

    // Camera
    const cam = document.createElement('a-entity');
    cam.setAttribute('camera', '');
    scene.appendChild(cam);

    // Add scene to DOM
    sceneContainer.appendChild(scene);

    log('Scene created, waiting for camera...');

    // Hide loading overlay once scene is running
    scene.addEventListener('loaded', () => {
      log('Scene loaded');
      setTimeout(() => {
        loadingOverlay.classList.add('hidden');
      }, 1500);
    });

    // Fallback: hide overlay after 5s regardless
    setTimeout(() => {
      loadingOverlay.classList.add('hidden');
    }, 5000);

  } catch (err) {
    loadingText.textContent = 'Error: ' + err.message;
    log('ERROR: ' + err.message);
  }
}

init();
