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

  // Load annotations
  const annRes = await fetch(`/api/panels/${panelId}/annotations`);
  const annotations = await annRes.json();

  // Create AR entities for each annotation
  annotations.forEach((ann, index) => {
    // Map 2D percentages (0-1) to 3D coordinates
    // x_percent 0→1 maps to x -1→+1
    // y_percent 0→1 maps to z -1→+1 (depth on the marker plane)
    // y (height) is above the marker
    const x = (ann.x_percent - 0.5) * 2;
    const z = (ann.y_percent - 0.5) * 2;
    const y = 0.3 + (index * 0.05); // stagger heights slightly

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

    // Connecting line (thin cylinder from label down to marker surface)
    const line = document.createElement('a-entity');
    const lineHeight = y;
    line.setAttribute('geometry', `primitive: cylinder; radius: 0.008; height: ${lineHeight}`);
    line.setAttribute('material', `color: ${ann.color}; opacity: 0.6`);
    line.setAttribute('position', `0 ${-lineHeight / 2} 0`);

    // Small dot at the base
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
