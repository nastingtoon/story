(() => {
  const stage = document.getElementById('stage');
  const imageWrap = document.getElementById('imageWrap');
  const stageImage = document.getElementById('stageImage');
  const emptyState = document.getElementById('emptyState');
  const imagePicker = document.getElementById('imagePicker');
  const pickImageEmpty = document.getElementById('pickImageEmpty');
  const pickImageTop = document.getElementById('pickImageTop');
  const addTextBtn = document.getElementById('addTextBtn');
  const duplicateBtn = document.getElementById('duplicateBtn');
  const deleteBtn = document.getElementById('deleteBtn');
  const saveBtn = document.getElementById('saveBtn');
  const editOverlay = document.getElementById('editOverlay');
  const cancelEdit = document.getElementById('cancelEdit');
  const applyEdit = document.getElementById('applyEdit');
  const editField = document.getElementById('editField');
  const fontSizeRange = document.getElementById('fontSizeRange');
  const colorRow = document.getElementById('colorRow');
  const toast = document.getElementById('toast');
  const bgToggleBtn = document.getElementById('bgToggleBtn');
  const alignLeftBtn = document.getElementById('alignLeftBtn');
  const alignCenterBtn = document.getElementById('alignCenterBtn');
  const alignRightBtn = document.getElementById('alignRightBtn');
  const desktopHint = document.getElementById('desktopHint');

  const palette = [
    '#ffffff', '#000000', '#ff3b30', '#ff9500', '#ffcc00',
    '#34c759', '#00c7be', '#32ade6', '#007aff', '#5856d6',
    '#af52de', '#ff2d55', '#ffd60a', '#64d2ff', '#f2f2f7'
  ];

  let backgroundUrl = null;
  let selectedId = null;
  let editingId = null;
  let justEndedGesture = false;
  let layers = [];

  const imageState = {
    x: 0,
    y: 0,
    userScale: 1,
    baseScale: 1,
    renderW: 0,
    renderH: 0,
    naturalW: 0,
    naturalH: 0
  };

  const gesture = {
    mode: null,
    targetId: null,
    element: null,
    pointers: new Map(),
    startLayer: null,
    startImage: null,
    base: null,
    rotateHandle: false,
    active: false
  };

  const isLikelyDesktop = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (isLikelyDesktop) {
    desktopHint.classList.add('show');
    setTimeout(() => desktopHint.classList.remove('show'), 3200);
  }

  function uid() {
    return 'l_' + Math.random().toString(36).slice(2, 10);
  }

  function bindTap(el, handler) {
    if (!el) return;
    el.addEventListener('click', handler);
  }

  function showToast(text, ttl = 2200) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), ttl);
  }

  function stageRect() {
    return stage.getBoundingClientRect();
  }

  function defaultLayer() {
    const r = stageRect();
    return {
      id: uid(),
      text: 'Новый текст',
      x: r.width / 2,
      y: r.height / 2,
      scale: 1,
      rotation: 0,
      color: '#ffffff',
      fontSize: 46,
      align: 'center',
      bg: false
    };
  }

  function createColorRow() {
    colorRow.innerHTML = '';
    palette.forEach(color => {
      const btn = document.createElement('button');
      btn.className = 'color-chip';
      btn.style.background = color;
      btn.dataset.color = color;
      btn.addEventListener('click', () => {
        const layer = layers.find(l => l.id === editingId);
        if (!layer) return;
        layer.color = color;
        syncEditorFromLayer(layer);
        render();
      });
      colorRow.appendChild(btn);
    });

    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'custom-color';
    custom.value = '#ffffff';
    custom.addEventListener('input', () => {
      const layer = layers.find(l => l.id === editingId);
      if (!layer) return;
      layer.color = custom.value;
      syncEditorFromLayer(layer);
      render();
    });
    colorRow.appendChild(custom);
  }

  function setSelected(id) {
    selectedId = id;
    render();
  }

  function openEditor(id) {
    editingId = id;
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    syncEditorFromLayer(layer);
    editOverlay.classList.add('active');
    requestAnimationFrame(() => {
      editField.focus();
      editField.select();
    });
  }

  function closeEditor() {
    editOverlay.classList.remove('active');
    editingId = null;
    render();
  }

  function syncEditorFromLayer(layer) {
    editField.value = layer.text;
    editField.style.color = layer.color;
    editField.style.fontSize = layer.fontSize + 'px';
    editField.style.textAlign = layer.align;
    editField.classList.toggle('bg-on', !!layer.bg);
    fontSizeRange.value = layer.fontSize;
    highlightAlignment(layer.align);
    bgToggleBtn.classList.toggle('active', !!layer.bg);
    [...colorRow.querySelectorAll('.color-chip')].forEach(el => {
      el.classList.toggle('active', el.dataset.color.toLowerCase() === layer.color.toLowerCase());
    });
    const custom = colorRow.querySelector('.custom-color');
    if (custom) custom.value = normalizeColor(layer.color);
  }

  function normalizeColor(value) {
    if (typeof value === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return value;
    return '#ffffff';
  }

  function highlightAlignment(align) {
    [alignLeftBtn, alignCenterBtn, alignRightBtn].forEach(btn => {
      btn.classList.toggle('active', btn.dataset.align === align);
    });
  }

  function render() {
    applyImageTransform();

    [...stage.querySelectorAll('.layer')].forEach(n => n.remove());
    layers.forEach(layer => {
      const el = document.createElement('div');
      el.className = 'layer' + (layer.id === selectedId ? ' selected' : '');
      el.dataset.id = layer.id;
      el.style.left = layer.x + 'px';
      el.style.top = layer.y + 'px';
      el.style.transform = `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}rad)`;
      el.style.textAlign = layer.align;
      el.style.background = layer.bg ? 'rgba(0,0,0,.55)' : 'transparent';
      el.style.borderRadius = layer.bg ? '14px' : '0';
      el.style.padding = layer.bg ? '.18em .28em' : '.12em .18em';

      const handle = document.createElement('div');
      handle.className = 'rotate-handle';
      handle.title = 'Поворот';
      handle.dataset.role = 'rotate';
      el.appendChild(handle);

      const text = document.createElement('div');
      text.className = 'text';
      text.textContent = layer.text || ' ';
      text.style.fontSize = layer.fontSize + 'px';
      text.style.color = layer.color;
      text.style.textAlign = layer.align;
      el.appendChild(text);

      attachLayerEvents(el, layer.id);
      stage.appendChild(el);
    });

    duplicateBtn.style.opacity = selectedId ? '1' : '.45';
    deleteBtn.style.opacity = selectedId ? '1' : '.45';
  }

  function attachLayerEvents(el, id) {
    el.addEventListener('pointerdown', (e) => {
      if (editOverlay.classList.contains('active')) return;
      const role = e.target && e.target.dataset ? e.target.dataset.role : null;
      if (role === 'rotate') {
        e.preventDefault();
        e.stopPropagation();
        setSelected(id);
        startLayerGesture(el, id, e, true);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setSelected(id);
      startLayerGesture(el, id, e, false);
    }, { passive: false });

    el.addEventListener('dblclick', (e) => {
      e.preventDefault();
      setSelected(id);
      openEditor(id);
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (justEndedGesture) return;
      if (selectedId === id) openEditor(id);
      else setSelected(id);
    });
  }

  function copyLayerState(layer) {
    return JSON.parse(JSON.stringify(layer));
  }

  function copyImageState() {
    return {
      x: imageState.x,
      y: imageState.y,
      userScale: imageState.userScale,
      baseScale: imageState.baseScale,
      renderW: imageState.renderW,
      renderH: imageState.renderH,
      naturalW: imageState.naturalW,
      naturalH: imageState.naturalH
    };
  }

  function startLayerGesture(el, id, e, viaRotateHandle) {
    const layer = layers.find(l => l.id === id);
    if (!layer) return;
    resetGesture();
    gesture.mode = 'layer';
    gesture.targetId = id;
    gesture.element = el;
    gesture.startLayer = copyLayerState(layer);
    gesture.rotateHandle = !!viaRotateHandle;
    gesture.active = true;
    el.classList.add('previewing');
    gesture.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY
    });
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function startImageGesture(e) {
    if (!backgroundUrl || editOverlay.classList.contains('active')) return;
    resetGesture();
    gesture.mode = 'image';
    gesture.element = imageWrap;
    gesture.startImage = copyImageState();
    gesture.active = true;
    imageWrap.classList.add('previewing');
    gesture.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY
    });
    try { imageWrap.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function resetGesture() {
    if (gesture.element) gesture.element.classList.remove('previewing');
    gesture.mode = null;
    gesture.targetId = null;
    gesture.element = null;
    gesture.pointers.clear();
    gesture.startLayer = null;
    gesture.startImage = null;
    gesture.base = null;
    gesture.rotateHandle = false;
    gesture.active = false;
  }

  function distance(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }
  function angle(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
  function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  function updateGestureLive() {
    if (!gesture.active) return;
    if (gesture.mode === 'layer') updateLayerGesture(true);
    if (gesture.mode === 'image') updateImageGesture(true);
  }

  function updateLayerGesture(live) {
    const layer = layers.find(l => l.id === gesture.targetId);
    if (!layer || !gesture.startLayer) return;
    const points = [...gesture.pointers.values()];
    if (!points.length) return;

    if (gesture.rotateHandle && points.length === 1) {
      const p = points[0];
      const startAngle = Math.atan2(p.startY - gesture.startLayer.y, p.startX - gesture.startLayer.x);
      const currentAngle = Math.atan2(p.y - gesture.startLayer.y, p.x - gesture.startLayer.x);
      layer.rotation = gesture.startLayer.rotation + (currentAngle - startAngle);
      layer.x = gesture.startLayer.x;
      layer.y = gesture.startLayer.y;
      layer.scale = gesture.startLayer.scale;
    } else if (points.length === 1) {
      const p = points[0];
      layer.x = gesture.startLayer.x + (p.x - p.startX);
      layer.y = gesture.startLayer.y + (p.y - p.startY);
      layer.rotation = gesture.startLayer.rotation;
      layer.scale = gesture.startLayer.scale;
    } else {
      const [p1, p2] = points;
      if (!gesture.base) {
        gesture.base = {
          dist: Math.max(1, distance(p1, p2)),
          angle: angle(p1, p2),
          mid: midpoint(p1, p2),
          layer: copyLayerState(gesture.startLayer)
        };
      }
      const base = gesture.base;
      const currentDist = Math.max(1, distance(p1, p2));
      const currentAngle = angle(p1, p2);
      const currentMid = midpoint(p1, p2);
      layer.scale = clamp(base.layer.scale * (currentDist / base.dist), 0.2, 8);
      layer.rotation = base.layer.rotation + (currentAngle - base.angle);
      layer.x = base.layer.x + (currentMid.x - base.mid.x);
      layer.y = base.layer.y + (currentMid.y - base.mid.y);
    }

    if (live && gesture.element) {
      gesture.element.style.left = layer.x + 'px';
      gesture.element.style.top = layer.y + 'px';
      gesture.element.style.transform = `translate(-50%, -50%) scale(${layer.scale}) rotate(${layer.rotation}rad)`;
    } else {
      render();
    }
  }

  function updateImageGesture(live) {
    if (!gesture.startImage) return;
    const points = [...gesture.pointers.values()];
    if (!points.length) return;

    if (points.length === 1) {
      const p = points[0];
      imageState.x = gesture.startImage.x + (p.x - p.startX);
      imageState.y = gesture.startImage.y + (p.y - p.startY);
      imageState.userScale = gesture.startImage.userScale;
    } else {
      const [p1, p2] = points;
      if (!gesture.base) {
        gesture.base = {
          dist: Math.max(1, distance(p1, p2)),
          mid: midpoint(p1, p2),
          image: copyImageState()
        };
      }
      const base = gesture.base;
      const currentDist = Math.max(1, distance(p1, p2));
      const currentMid = midpoint(p1, p2);
      imageState.userScale = clamp(base.image.userScale * (currentDist / base.dist), 1, 8);
      imageState.x = base.image.x + (currentMid.x - base.mid.x);
      imageState.y = base.image.y + (currentMid.y - base.mid.y);
    }

    constrainImage();
    if (live) applyImageTransform();
    else render();
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function currentImageRenderSize(state = imageState) {
    const scale = state.baseScale * state.userScale;
    return {
      width: state.naturalW * scale,
      height: state.naturalH * scale
    };
  }

  function fitImageCover() {
    if (!stageImage.naturalWidth || !stageImage.naturalHeight) return;
    const rect = stageRect();
    imageState.naturalW = stageImage.naturalWidth;
    imageState.naturalH = stageImage.naturalHeight;
    imageState.baseScale = Math.max(rect.width / imageState.naturalW, rect.height / imageState.naturalH);
    imageState.userScale = Math.max(1, imageState.userScale || 1);
    constrainImage();
    applyImageTransform();
  }

  function constrainImage() {
    const rect = stageRect();
    const size = currentImageRenderSize();
    imageState.renderW = size.width;
    imageState.renderH = size.height;
    const maxX = Math.max(0, (size.width - rect.width) / 2);
    const maxY = Math.max(0, (size.height - rect.height) / 2);
    imageState.x = clamp(imageState.x, -maxX, maxX);
    imageState.y = clamp(imageState.y, -maxY, maxY);
  }

  function applyImageTransform() {
    if (!backgroundUrl) return;
    const size = currentImageRenderSize();
    imageState.renderW = size.width;
    imageState.renderH = size.height;
    imageWrap.style.width = `${size.width}px`;
    imageWrap.style.height = `${size.height}px`;
    stageImage.style.width = `${size.width}px`;
    stageImage.style.height = `${size.height}px`;
    imageWrap.style.transform = `translate(-50%, -50%) translate(${imageState.x}px, ${imageState.y}px)`;
  }

  function addNewLayer() {
    const layer = defaultLayer();
    layers.push(layer);
    setSelected(layer.id);
    render();
    openEditor(layer.id);
  }

  function duplicateSelected() {
    const layer = layers.find(l => l.id === selectedId);
    if (!layer) return;
    const clone = copyLayerState(layer);
    clone.id = uid();
    clone.x += 24;
    clone.y += 24;
    layers.push(clone);
    setSelected(clone.id);
    render();
  }

  function deleteSelected() {
    if (!selectedId) return;
    layers = layers.filter(l => l.id !== selectedId);
    selectedId = null;
    render();
  }

  function applyEditorChanges() {
    const layer = layers.find(l => l.id === editingId);
    if (!layer) return;
    layer.text = editField.value.trim() || ' ';
    closeEditor();
  }

  function updateBackground(file) {
    if (!file) return;
    if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
    backgroundUrl = URL.createObjectURL(file);
    selectedId = null;
    imageState.x = 0;
    imageState.y = 0;
    imageState.userScale = 1;
    imageWrap.hidden = false;
    stageImage.onload = () => {
      emptyState.style.display = 'none';
      fitImageCover();
      render();
    };
    stageImage.src = backgroundUrl;
  }

  imagePicker.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    updateBackground(file);
    imagePicker.value = '';
  });

  [pickImageEmpty, pickImageTop].forEach(btn => bindTap(btn, () => imagePicker.click()));
  bindTap(addTextBtn, addNewLayer);
  bindTap(duplicateBtn, duplicateSelected);
  bindTap(deleteBtn, deleteSelected);
  bindTap(cancelEdit, closeEditor);
  bindTap(applyEdit, applyEditorChanges);

  editField.addEventListener('input', () => {
    const layer = layers.find(l => l.id === editingId);
    if (!layer) return;
    layer.text = editField.value;
    render();
  });

  fontSizeRange.addEventListener('input', () => {
    const layer = layers.find(l => l.id === editingId);
    if (!layer) return;
    layer.fontSize = Number(fontSizeRange.value);
    editField.style.fontSize = layer.fontSize + 'px';
    render();
  });

  [alignLeftBtn, alignCenterBtn, alignRightBtn].forEach(btn => {
    bindTap(btn, () => {
      const layer = layers.find(l => l.id === editingId);
      if (!layer) return;
      layer.align = btn.dataset.align;
      editField.style.textAlign = layer.align;
      highlightAlignment(layer.align);
      render();
    });
  });

  bindTap(bgToggleBtn, () => {
    const layer = layers.find(l => l.id === editingId);
    if (!layer) return;
    layer.bg = !layer.bg;
    editField.classList.toggle('bg-on', layer.bg);
    bgToggleBtn.classList.toggle('active', layer.bg);
    render();
  });

  function finalizeGesture(ev) {
    if (!gesture.pointers.has(ev.pointerId)) return;
    gesture.pointers.delete(ev.pointerId);

    if (gesture.pointers.size === 0) {
      resetGesture();
      justEndedGesture = true;
      setTimeout(() => { justEndedGesture = false; }, 180);
      render();
      return;
    }

    if (gesture.mode === 'layer') {
      const layer = layers.find(l => l.id === gesture.targetId);
      if (layer) gesture.startLayer = copyLayerState(layer);
    }
    if (gesture.mode === 'image') {
      gesture.startImage = copyImageState();
    }

    gesture.base = null;
    for (const point of gesture.pointers.values()) {
      point.startX = point.x;
      point.startY = point.y;
    }
  }

  document.addEventListener('pointermove', (ev) => {
    if (!gesture.active) return;
    const point = gesture.pointers.get(ev.pointerId);
    if (!point) return;
    ev.preventDefault();
    point.x = ev.clientX;
    point.y = ev.clientY;
    updateGestureLive();
  }, { passive: false });

  document.addEventListener('pointerup', finalizeGesture, { passive: false });
  document.addEventListener('pointercancel', finalizeGesture, { passive: false });

  stage.addEventListener('pointerdown', (e) => {
    if (editOverlay.classList.contains('active')) return;
    const target = e.target;
    const isControl = target.closest('.topbar, .bottombar, .edit-overlay, .empty-state, .toast');
    const isLayer = target.closest('.layer');
    if (isControl || isLayer) return;
    e.preventDefault();
    selectedId = null;
    render();
    if (backgroundUrl) startImageGesture(e);
  }, { passive: false });

  stage.addEventListener('dblclick', (e) => {
    if (e.target === stage || e.target === imageWrap || e.target === stageImage) {
      addNewLayer();
    }
  });

  async function saveImage() {
    if (!backgroundUrl || !stageImage.complete) {
      showToast('Сначала выбери фото');
      return;
    }

    const rect = stageRect();
    const aspect = rect.width / rect.height;
    const imgW = stageImage.naturalWidth || rect.width;
    const imgH = stageImage.naturalHeight || rect.height;
    let outW;
    let outH;
    if (imgW / imgH > aspect) {
      outH = imgH;
      outW = Math.round(imgH * aspect);
    } else {
      outW = imgW;
      outH = Math.round(imgW / aspect);
    }

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    const exportScale = outW / rect.width;

    const drawW = imageState.renderW * exportScale;
    const drawH = imageState.renderH * exportScale;
    const centerX = outW / 2 + imageState.x * exportScale;
    const centerY = outH / 2 + imageState.y * exportScale;
    const drawX = centerX - drawW / 2;
    const drawY = centerY - drawH / 2;

    ctx.drawImage(stageImage, drawX, drawY, drawW, drawH);

    for (const layer of layers) {
      ctx.save();
      ctx.translate(layer.x * exportScale, layer.y * exportScale);
      ctx.rotate(layer.rotation);
      ctx.scale(layer.scale * exportScale, layer.scale * exportScale);
      const fontSize = layer.fontSize;
      ctx.font = `${fontSize}px Shevko, -apple-system, sans-serif`;
      ctx.textAlign = layer.align;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = layer.color;

      const lines = (layer.text || ' ').split('\n');
      const maxWidth = Math.max(...lines.map(line => ctx.measureText(line || ' ').width));
      const lineHeight = fontSize * 1.08;
      const totalHeight = lineHeight * lines.length;

      if (layer.bg) {
        const padX = fontSize * 0.32;
        const padY = fontSize * 0.20;
        const boxW = maxWidth + padX * 2;
        const boxH = totalHeight + padY * 2;
        let boxX = -boxW / 2;
        if (layer.align === 'left' || layer.align === 'right') boxX = -maxWidth / 2 - padX;
        roundRect(ctx, boxX, -boxH / 2, boxW, boxH, 14);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();
        ctx.fillStyle = layer.color;
      }

      lines.forEach((line, index) => {
        const y = -totalHeight / 2 + lineHeight / 2 + index * lineHeight;
        let x = 0;
        if (layer.align === 'left') x = -maxWidth / 2;
        if (layer.align === 'right') x = maxWidth / 2;
        ctx.fillText(line || ' ', x, y);
      });
      ctx.restore();
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      showToast('Не удалось собрать изображение');
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const file = new File([blob], 'story-text.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'story-text.png' });
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
        showToast('В меню выбери “Сохранить изображение”');
        return;
      } catch (_) {}
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
      const opened = window.open(objectUrl, '_blank');
      if (opened) showToast('Открой PNG и выбери Поделиться → Сохранить изображение', 2600);
      else window.location.href = objectUrl;
      return;
    }

    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'story-text.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    showToast('PNG сохранён');
  }

  function roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  bindTap(saveBtn, saveImage);

  window.addEventListener('resize', () => {
    if (backgroundUrl) fitImageCover();
    render();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js?v=7').catch(() => {});
    });
  }

  createColorRow();
  render();
})();