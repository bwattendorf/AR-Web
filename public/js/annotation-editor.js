const panelId = window.location.pathname.split('/').pop();
let panel = null;
let annotations = [];
let dragging = null;
let markerMode = false;

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
  }
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

    // Label tooltip
    const label = document.createElement('span');
    label.className = 'dot-label';
    label.textContent = ann.label;
    label.style.borderColor = ann.color;
    dot.appendChild(label);

    // Drag support
    dot.addEventListener('mousedown', startDrag);
    dot.addEventListener('touchstart', startDrag, { passive: false });

    // Click to edit (not on drag)
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

// Click on image to add annotation
imageContainer.addEventListener('click', (e) => {
  if (markerMode) return;
  if (e.target !== panelImage && e.target !== overlay && e.target !== imageContainer) return;
  const rect = panelImage.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;

  openNewPopup(x, y);
});

function openNewPopup(x, y) {
  popupTitle.textContent = 'New Annotation';
  annIdInput.value = '';
  annXInput.value = x;
  annYInput.value = y;
  annLabelInput.value = '';
  annDescInput.value = '';
  annColorInput.value = '#ff0000';
  popup.style.display = 'flex';
  annLabelInput.focus();
}

function openEditPopup(ann) {
  popupTitle.textContent = 'Edit Annotation';
  annIdInput.value = ann.id;
  annXInput.value = ann.x_percent;
  annYInput.value = ann.y_percent;
  annLabelInput.value = ann.label;
  annDescInput.value = ann.description || '';
  annColorInput.value = ann.color;
  popup.style.display = 'flex';
  annLabelInput.focus();
}

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

// Drag to reposition
function startDrag(e) {
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
    panelImage.src = `/uploads/${updated.image_filename}?t=${Date.now()}`;
    panelImage.style.display = 'block';
    input.value = '';
  }
});

// --- Marker placement on photo ---

const markerOverlay = document.getElementById('marker-overlay');
const markerOverlayImg = document.getElementById('marker-overlay-img');
const toggleMarkerBtn = document.getElementById('toggle-marker-btn');

window.toggleMarkerMode = function() {
  markerMode = !markerMode;
  if (markerMode) {
    toggleMarkerBtn.textContent = 'Done Placing Marker';
    toggleMarkerBtn.classList.remove('btn-secondary');
    toggleMarkerBtn.classList.add('btn-danger');
    showMarkerOverlay();
  } else {
    toggleMarkerBtn.textContent = 'Place Marker';
    toggleMarkerBtn.classList.remove('btn-danger');
    toggleMarkerBtn.classList.add('btn-secondary');
    markerOverlay.style.display = 'none';
  }
};

function showMarkerOverlay() {
  if (!panel) return;
  // Load marker SVG
  markerOverlayImg.src = `/api/marker/${panel.marker_value}.svg`;
  markerOverlay.style.display = 'block';
  // Position at saved location or center
  const x = panel.marker_x_percent != null ? panel.marker_x_percent : 0.5;
  const y = panel.marker_y_percent != null ? panel.marker_y_percent : 0.5;
  markerOverlay.style.left = `${x * 100}%`;
  markerOverlay.style.top = `${y * 100}%`;
}

// Drag marker overlay
markerOverlay.addEventListener('mousedown', startMarkerDrag);
markerOverlay.addEventListener('touchstart', startMarkerDrag, { passive: false });

function startMarkerDrag(e) {
  if (!markerMode) return;
  e.preventDefault();
  e.stopPropagation();

  const onMove = (ev) => {
    const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
    const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
    const rect = panelImage.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    markerOverlay.style.left = `${x * 100}%`;
    markerOverlay.style.top = `${y * 100}%`;
    markerOverlay._pos = { x, y };
  };

  const onEnd = async () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);

    if (markerOverlay._pos) {
      await fetch(`/api/panels/${panelId}/marker-position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marker_x_percent: markerOverlay._pos.x,
          marker_y_percent: markerOverlay._pos.y
        })
      });
      panel.marker_x_percent = markerOverlay._pos.x;
      panel.marker_y_percent = markerOverlay._pos.y;
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
}

// Click on image in marker mode places the marker
const origClickHandler = imageContainer.onclick;
imageContainer.addEventListener('click', (e) => {
  if (!markerMode) return;
  if (e.target === markerOverlay || markerOverlay.contains(e.target)) return;
  const rect = panelImage.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return;
  e.stopPropagation();

  markerOverlay.style.left = `${x * 100}%`;
  markerOverlay.style.top = `${y * 100}%`;
  markerOverlay._pos = { x, y };

  fetch(`/api/panels/${panelId}/marker-position`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marker_x_percent: x, marker_y_percent: y })
  });
  panel.marker_x_percent = x;
  panel.marker_y_percent = y;
}, true); // capture phase so it fires before the annotation click

// Init
loadPanel();
loadAnnotations();
