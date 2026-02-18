const panelId = window.location.pathname.split('/').pop();
let panel = null;
let annotations = [];
let dragging = null;
let currentMode = 'annotate'; // 'marker' or 'annotate'

// --- Access Control Panel annotation templates ---
const ANNOTATION_TEMPLATES = {
  'Terminals': {
    color: '#2563eb',
    items: [
      { label: '+12V DC Power', desc: 'Positive 12V DC power input terminal' },
      { label: '+24V DC Power', desc: 'Positive 24V DC power input terminal' },
      { label: 'GND', desc: 'Ground / negative power terminal' },
      { label: 'Data 0 (D0)', desc: 'Wiegand Data 0 line from card reader (green wire)' },
      { label: 'Data 1 (D1)', desc: 'Wiegand Data 1 line from card reader (white wire)' },
      { label: 'Door Contact', desc: 'Normally-closed door position sensor input' },
      { label: 'REX Input', desc: 'Request to Exit sensor input' },
      { label: 'Lock Relay', desc: 'Door lock relay output (electric strike / mag lock)' },
      { label: 'Tamper Switch', desc: 'Enclosure tamper detection switch' },
      { label: 'Shield Ground', desc: 'Cable shield / earth ground connection point' },
      { label: 'RS-485 A (+)', desc: 'RS-485 communication bus positive line' },
      { label: 'RS-485 B (-)', desc: 'RS-485 communication bus negative line' },
      { label: 'Aux Input', desc: 'Auxiliary general-purpose input' },
      { label: 'Aux Output', desc: 'Auxiliary general-purpose relay output' },
      { label: 'Bell / Siren', desc: 'Alarm bell or siren output terminal' },
    ]
  },
  'Components': {
    color: '#7c3aed',
    items: [
      { label: 'Controller Board', desc: 'Main access control processor board' },
      { label: 'Power Supply', desc: 'AC to DC power supply module' },
      { label: 'Backup Battery', desc: 'Backup battery (replace every 2-3 years)' },
      { label: 'Fuse', desc: 'Protective fuse - check rating before replacing' },
      { label: 'Relay Module', desc: 'Door lock relay module' },
      { label: 'Reader Interface', desc: 'Reader interface module (RIM)' },
      { label: 'Network Port', desc: 'RJ45 Ethernet network connection' },
      { label: 'Expansion Slot', desc: 'Slot for additional reader/input modules' },
      { label: 'DIP Switches', desc: 'Configuration DIP switches - see manual for settings' },
      { label: 'Reset Button', desc: 'Controller reset / factory default button' },
    ]
  },
  'Status LEDs': {
    color: '#059669',
    items: [
      { label: 'Power LED', desc: 'Solid green = normal power, off = no power' },
      { label: 'Network LED', desc: 'Blinking = network active, off = no link' },
      { label: 'Status LED', desc: 'Solid = normal operation, blinking = fault' },
      { label: 'Tamper LED', desc: 'Lit when enclosure tamper detected' },
      { label: 'Door Status LED', desc: 'Indicates door open/closed/locked state' },
      { label: 'Fault LED', desc: 'Lit when system fault detected - check event log' },
      { label: 'Comm LED', desc: 'Communication activity indicator' },
      { label: 'Reader 1 LED', desc: 'Reader 1 connection status indicator' },
      { label: 'Reader 2 LED', desc: 'Reader 2 connection status indicator' },
    ]
  },
  'Safety': {
    color: '#dc2626',
    items: [
      { label: 'AC MAINS - HIGH VOLTAGE', desc: 'DANGER: 120V/240V AC mains input - disconnect before servicing' },
      { label: 'ESD Sensitive', desc: 'Use grounding strap when handling exposed circuit boards' },
      { label: 'Do Not Remove Cover', desc: 'Panel cover protects energized components' },
      { label: 'Fuse Rating', desc: 'Replace only with same type and rating fuse' },
      { label: 'Disconnect Power First', desc: 'Turn off AC and disconnect battery before servicing' },
      { label: 'Fire Door - Do Not Block', desc: 'Connected to fire alarm - door must remain unobstructed' },
    ]
  },
  'Info': {
    color: '#d97706',
    items: [
      { label: 'Model / Serial #', desc: 'Record model and serial number for service calls' },
      { label: 'IP Address', desc: 'Controller network IP address' },
      { label: 'Door / Zone', desc: 'Door name and access zone assignment' },
      { label: 'Network Config', desc: 'IP, subnet, gateway, MAC address' },
      { label: 'Firmware Version', desc: 'Current firmware version - check for updates' },
      { label: 'Maintenance Schedule', desc: 'Next scheduled maintenance date and tasks' },
      { label: 'Emergency Contact', desc: 'Security system support contact information' },
      { label: 'Card Format', desc: 'Wiegand format: 26-bit / 37-bit / OSDP' },
      { label: 'Max Cable Length', desc: 'Maximum reader cable run distance' },
    ]
  },
  'Troubleshoot': {
    color: '#0891b2',
    items: [
      { label: 'Check Voltage Here', desc: 'Measure voltage at this point during troubleshooting' },
      { label: 'Test Card Here', desc: 'Present known-good test card at this reader' },
      { label: 'Check Continuity', desc: 'Test cable continuity from this terminal to device' },
      { label: 'Termination Resistor', desc: 'RS-485 bus termination - verify 120 ohm resistor' },
      { label: 'Common Fault Point', desc: 'Frequent failure location - inspect connections' },
      { label: 'LED Pattern Guide', desc: 'Refer to manual for LED blink code meanings' },
      { label: 'Battery Test Point', desc: 'Measure backup battery voltage (replace if below 12.0V)' },
      { label: 'Signal Test Point', desc: 'Test communication signal quality at this point' },
    ]
  }
};

// DOM elements
const panelTitle = document.getElementById('panel-title');
const panelImage = document.getElementById('panel-image');
const imageContainer = document.getElementById('image-container');
const overlay = document.getElementById('annotations-overlay');
const popup = document.getElementById('annotation-form-popup');
const popupTitle = document.getElementById('popup-title');
const annForm = document.getElementById('annotation-form');
const annIdInput = document.getElementById('ann-id');
const annXInput = document.getElementById('ann-x');
const annYInput = document.getElementById('ann-y');
const annLabelInput = document.getElementById('ann-label');
const annDescInput = document.getElementById('ann-desc');
const annColorInput = document.getElementById('ann-color');
const tbody = document.getElementById('annotations-tbody');
const markerIndicator = document.getElementById('marker-indicator');
const modeLabel = document.getElementById('mode-label');
const workflowSteps = document.getElementById('workflow-steps');
const btnMarkSticker = document.getElementById('btn-mark-sticker');
const btnAnnotate = document.getElementById('btn-annotate');
const stepMarker = document.getElementById('step-marker');
const stepAnnotate = document.getElementById('step-annotate');

// Mode switching
window.setMode = function(mode) {
  currentMode = mode;
  updateModeUI();
};

function updateModeUI() {
  if (currentMode === 'marker') {
    modeLabel.textContent = 'Click on the sticker in the photo';
    modeLabel.className = 'mode-label mode-marker';
    btnMarkSticker.classList.add('btn-active');
    btnMarkSticker.classList.remove('btn-secondary');
    btnAnnotate.classList.remove('btn-active');
    btnAnnotate.classList.add('btn-secondary');
    imageContainer.style.cursor = 'crosshair';
  } else {
    modeLabel.textContent = 'Click to place annotations';
    modeLabel.className = 'mode-label mode-annotate';
    btnAnnotate.classList.add('btn-active');
    btnAnnotate.classList.remove('btn-secondary');
    btnMarkSticker.classList.remove('btn-active');
    btnMarkSticker.classList.add('btn-secondary');
    imageContainer.style.cursor = 'crosshair';
  }
  // Highlight active step
  stepMarker.classList.toggle('step-active', currentMode === 'marker');
  stepAnnotate.classList.toggle('step-active', currentMode === 'annotate');
}

// Load panel data
async function loadPanel() {
  const res = await fetch(`/api/panels/${panelId}`);
  if (!res.ok) { alert('Panel not found'); return; }
  panel = await res.json();
  panelTitle.textContent = `Edit: ${panel.name}`;
  document.getElementById('view-link').href = `/view/${panel.id}`;
  document.getElementById('print-link').href = `/print/${panel.id}`;

  if (panel.image_filename) {
    panelImage.src = `/uploads/${panel.image_filename}`;
    panelImage.style.display = 'block';
    showEditorUI();
  }

  // Show marker indicator if position is already set
  showMarkerIndicator();
}

function showEditorUI() {
  workflowSteps.style.display = '';
  btnMarkSticker.style.display = '';
  btnAnnotate.style.display = '';

  // If marker hasn't been placed yet, start in marker mode
  if (panel && (panel.marker_x_percent == null || panel.marker_x_percent === 0.5 && panel.marker_y_percent === 0.5)) {
    // Check if it's truly unset (default 0.5,0.5) vs intentionally placed at center
    // Start in marker mode to prompt user
    setMode('marker');
  } else {
    setMode('annotate');
  }
}

function showMarkerIndicator() {
  if (!panel || panel.marker_x_percent == null) return;
  markerIndicator.style.display = '';
  markerIndicator.style.left = `${panel.marker_x_percent * 100}%`;
  markerIndicator.style.top = `${panel.marker_y_percent * 100}%`;
}

// Load annotations
async function loadAnnotations() {
  const res = await fetch(`/api/panels/${panelId}/annotations`);
  annotations = await res.json();
  renderAnnotations();
  renderTable();
}

// Render annotation dots on the image
function renderAnnotations() {
  overlay.innerHTML = '';
  annotations.forEach(ann => {
    const dot = document.createElement('div');
    dot.className = 'annotation-dot';
    dot.style.left = `${ann.x_percent * 100}%`;
    dot.style.top = `${ann.y_percent * 100}%`;
    dot.style.backgroundColor = ann.color;
    dot.title = ann.label;
    dot.dataset.id = ann.id;

    const label = document.createElement('span');
    label.className = 'dot-label';
    label.textContent = ann.label;
    label.style.borderColor = ann.color;
    dot.appendChild(label);

    dot.addEventListener('mousedown', startDrag);
    dot.addEventListener('touchstart', startDrag, { passive: false });

    dot.addEventListener('click', (e) => {
      if (dot.dataset.dragged) {
        delete dot.dataset.dragged;
        return;
      }
      e.stopPropagation();
      openEditPopup(ann);
    });

    overlay.appendChild(dot);
  });
}

// Render annotations table
function renderTable() {
  tbody.innerHTML = '';
  annotations.forEach(ann => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="color-swatch" style="background:${ann.color}"></span></td>
      <td>${ann.label}</td>
      <td>${ann.description || '-'}</td>
      <td>${(ann.x_percent * 100).toFixed(1)}%, ${(ann.y_percent * 100).toFixed(1)}%</td>
      <td>
        <button class="btn btn-small" onclick="openEditPopup(annotations.find(a=>a.id===${ann.id}))">Edit</button>
        <button class="btn btn-small btn-danger" onclick="deleteAnnotation(${ann.id})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Click on image — either place marker or add annotation
imageContainer.addEventListener('click', (e) => {
  if (e.target.closest('.annotation-dot')) return;
  const rect = panelImage.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  if (currentMode === 'marker') {
    placeMarker(x, y);
  } else {
    openNewPopup(x, y);
  }
});

async function placeMarker(x, y) {
  await fetch(`/api/panels/${panelId}/marker-position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marker_x_percent: x, marker_y_percent: y })
  });
  panel.marker_x_percent = x;
  panel.marker_y_percent = y;
  showMarkerIndicator();
  // Auto-switch to annotation mode after placing marker
  setMode('annotate');
}

function openNewPopup(x, y) {
  popupTitle.textContent = 'New Annotation';
  annIdInput.value = '';
  annXInput.value = x;
  annYInput.value = y;
  annLabelInput.value = '';
  annDescInput.value = '';
  annColorInput.value = '#ff0000';
  showTemplatePicker(true);
  renderTemplatePicker();
  popup.style.display = 'flex';
}

// --- Template picker ---
const templateTabs = document.getElementById('template-tabs');
const templateItems = document.getElementById('template-items');
const templatePicker = document.getElementById('template-picker');
const templateDivider = document.getElementById('template-divider');
let activeTemplateTab = Object.keys(ANNOTATION_TEMPLATES)[0];

function showTemplatePicker(show) {
  templatePicker.style.display = show ? '' : 'none';
  templateDivider.style.display = show ? '' : 'none';
}

function renderTemplatePicker() {
  // Render category tabs
  templateTabs.innerHTML = '';
  for (const cat of Object.keys(ANNOTATION_TEMPLATES)) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'template-tab' + (cat === activeTemplateTab ? ' active' : '');
    tab.style.setProperty('--tab-color', ANNOTATION_TEMPLATES[cat].color);
    tab.textContent = cat;
    tab.addEventListener('click', () => {
      activeTemplateTab = cat;
      renderTemplatePicker();
    });
    templateTabs.appendChild(tab);
  }

  // Render items for active tab
  const tmpl = ANNOTATION_TEMPLATES[activeTemplateTab];
  templateItems.innerHTML = '';
  tmpl.items.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'template-item';
    btn.style.setProperty('--item-color', tmpl.color);
    btn.innerHTML = `<span class="template-item-dot" style="background:${tmpl.color}"></span>${item.label}`;
    btn.title = item.desc;
    btn.addEventListener('click', () => {
      applyTemplate(item, tmpl.color);
    });
    templateItems.appendChild(btn);
  });
}

function applyTemplate(item, color) {
  annLabelInput.value = item.label;
  annDescInput.value = item.desc;
  annColorInput.value = color;
  annLabelInput.focus();
}

window.openEditPopup = function(ann) {
  popupTitle.textContent = 'Edit Annotation';
  annIdInput.value = ann.id;
  annXInput.value = ann.x_percent;
  annYInput.value = ann.y_percent;
  annLabelInput.value = ann.label;
  annDescInput.value = ann.description || '';
  annColorInput.value = ann.color;
  showTemplatePicker(false);
  popup.style.display = 'flex';
  annLabelInput.focus();
};

window.closePopup = function() {
  popup.style.display = 'none';
};

// Save annotation (create or update)
annForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = {
    x_percent: parseFloat(annXInput.value),
    y_percent: parseFloat(annYInput.value),
    label: annLabelInput.value,
    description: annDescInput.value,
    color: annColorInput.value
  };

  const id = annIdInput.value;
  if (id) {
    await fetch(`/api/annotations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } else {
    await fetch(`/api/panels/${panelId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }

  closePopup();
  loadAnnotations();
});

// Delete annotation
window.deleteAnnotation = async function(id) {
  if (!confirm('Delete this annotation?')) return;
  await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
  loadAnnotations();
};

// Drag to reposition annotations
function startDrag(e) {
  if (currentMode === 'marker') return;
  e.preventDefault();
  const dot = e.currentTarget;
  dragging = {
    dot,
    id: parseInt(dot.dataset.id),
    moved: false
  };

  const onMove = (ev) => {
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const rect = panelImage.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    dot.style.left = `${x * 100}%`;
    dot.style.top = `${y * 100}%`;
    dragging.x = x;
    dragging.y = y;
    dragging.moved = true;
  };

  const onEnd = async () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);

    if (dragging && dragging.moved) {
      dot.dataset.dragged = 'true';
      await fetch(`/api/annotations/${dragging.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x_percent: dragging.x, y_percent: dragging.y })
      });
      loadAnnotations();
    }
    dragging = null;
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

// Upload image
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('image-input');
  if (!input.files[0]) return;

  const formData = new FormData();
  formData.append('image', input.files[0]);

  const res = await fetch(`/api/panels/${panelId}/image`, { method: 'POST', body: formData });
  if (res.ok) {
    const updated = await res.json();
    panel.image_filename = updated.image_filename;
    panelImage.src = `/uploads/${updated.image_filename}?t=${Date.now()}`;
    panelImage.style.display = 'block';
    input.value = '';
    showEditorUI();
    setMode('marker');
  }
});

// --- MindAR Target Compilation ---

function loadModuleScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.type = 'module';
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

window.compileARTarget = async function() {
  const btn = document.getElementById('compile-btn');
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Loading compiler...';

  try {
    // 1. Load MindAR compiler (ES module — sets window.MINDAR)
    await loadModuleScript('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
    // Module scripts execute deferred — wait for window.MINDAR to appear
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        if (window.MINDAR && window.MINDAR.IMAGE) { resolve(); return; }
        if (++attempts > 50) { reject(new Error('MindAR compiler did not load')); return; }
        setTimeout(check, 100);
      };
      check();
    });
    btn.textContent = 'Fetching sticker...';

    // 2. Fetch the sticker SVG
    const svgRes = await fetch(`/api/panels/${panelId}/marker.svg`);
    if (!svgRes.ok) throw new Error('Failed to fetch sticker SVG');
    const svgText = await svgRes.text();

    btn.textContent = 'Rendering image...';

    // 3. Render SVG to an Image element for MindAR compiler
    const image = await svgToImage(svgText);

    btn.textContent = 'Compiling target (this may take a minute)...';

    // 4. Compile with MindAR (expects Image elements, not ImageData)
    const compiler = new window.MINDAR.IMAGE.Compiler();
    await compiler.compileImageTargets([image], (progress) => {
      btn.textContent = `Compiling... ${Math.round(progress)}%`;
    });
    const buffer = await compiler.exportData();

    btn.textContent = 'Uploading...';

    // 5. Upload .mind file
    const formData = new FormData();
    formData.append('target', new Blob([buffer], { type: 'application/octet-stream' }), 'target.mind');

    const uploadRes = await fetch(`/api/panels/${panelId}/compile-target`, {
      method: 'POST',
      body: formData
    });

    if (!uploadRes.ok) throw new Error('Upload failed');

    btn.textContent = 'Compiled!';
    btn.style.background = '#059669';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = origText;
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
    }, 3000);

  } catch (err) {
    console.error('Compile error:', err);
    btn.textContent = 'Error: ' + err.message;
    btn.style.background = '#dc2626';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.textContent = origText;
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
    }, 5000);
  }
};

function svgToImage(svgText) {
  return new Promise((resolve, reject) => {
    // Rasterize SVG to a PNG data URL via canvas, then load as Image
    // MindAR compiler needs a raster Image element, not an SVG
    const blob = new Blob([svgText], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const svgImg = new Image();
    svgImg.onload = () => {
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(svgImg, 0, 0, size, size);
      URL.revokeObjectURL(url);

      const rasterImg = new Image();
      rasterImg.onload = () => resolve(rasterImg);
      rasterImg.onerror = () => reject(new Error('Failed to create raster image'));
      rasterImg.src = canvas.toDataURL('image/png');
    };
    svgImg.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG to image'));
    };
    svgImg.src = url;
  });
}

// Init
loadPanel();
loadAnnotations();
