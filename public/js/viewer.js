const panelId = window.location.pathname.split('/').pop();
const marker = document.getElementById('ar-marker');
const loadingOverlay = document.getElementById('loading-overlay');
const panelNameEl = document.getElementById('panel-name');

async function init() {
  // Load panel info
  const panelRes = await fetch(`/api/panels/${panelId}`);
  if (!panelRes.ok) {
    loadingOverlay.innerHTML = '<div>Panel not found</div>';
    return;
  }
  const panel = await panelRes.json();
  panelNameEl.textContent = panel.name;

  // Set marker value to match this panel's assigned marker
  marker.setAttribute('value', panel.marker_value);

  // Marker position in the photo (where the sticker was placed)
  const markerX = panel.marker_x_percent != null ? panel.marker_x_percent : 0.5;
  const markerY = panel.marker_y_percent != null ? panel.marker_y_percent : 0.5;

  // Load annotations
  const annRes = await fetch(`/api/panels/${panelId}/annotations`);
  const annotations = await annRes.json();

  // Create AR entities for each annotation
  // Annotations are positioned RELATIVE to the marker position in the photo
  // so the AR overlay matches the physical panel layout
  const scale = 2.5; // controls how spread out annotations are in 3D space

  annotations.forEach((ann, index) => {
    // Offset from marker position in image space
    const dx = ann.x_percent - markerX;
    const dy = ann.y_percent - markerY;

    // Map to 3D: x stays x, image-y maps to z (depth), y (up) is for label height
    const x = dx * scale;
    const z = dy * scale;
    const y = 0.3 + (index * 0.05); // stagger label heights

    // Container entity
    const entity = document.createElement('a-entity');
    entity.setAttribute('position', `${x} ${y} ${z}`);

    // Background plane for readability
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

    // Connecting line from label down to marker surface
    const line = document.createElement('a-entity');
    const lineHeight = y;
    line.setAttribute('geometry', `primitive: cylinder; radius: 0.008; height: ${lineHeight}`);
    line.setAttribute('material', `color: ${ann.color}; opacity: 0.6`);
    line.setAttribute('position', `0 ${-lineHeight / 2} 0`);

    // Small dot at the base showing where on the panel this annotation points
    const dot = document.createElement('a-sphere');
    dot.setAttribute('radius', '0.025');
    dot.setAttribute('color', ann.color);
    dot.setAttribute('position', `0 ${-lineHeight} 0`);

    entity.appendChild(bg);
    entity.appendChild(text);
    entity.appendChild(line);
    entity.appendChild(dot);
    marker.appendChild(entity);
  });

  // Hide loading after a short delay to allow camera init
  setTimeout(() => {
    loadingOverlay.classList.add('hidden');
  }, 2000);
}

init();
