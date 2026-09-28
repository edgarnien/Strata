class Strata {
    constructor() {
        // Initialize upload system FIRST - this is critical and must never fail
        this.initializeUploadSystem();

        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.pixelCanvas = document.getElementById('pixelCanvas');
        this.pixelCtx = this.pixelCanvas.getContext('2d');

        // Multi-image state management
        this.images = []; // Array of {img, id, thumbnailUrl}
        this.currentImageIndex = 0;
        this.originalImage = null; // Keep for backwards compatibility
        this.isGalleryExpanded = false;
        this.animationCycleCount = 0;
        this.lastCycleNumber = -1;

        this.removeFront = false;
        this.processingTimeout = null;

        // Motion animation state
        this.motionAnimationRunning = false;
        this.motionAnimationFrame = 0;
        this.motionBarOrder = [];
        this.motionBarTotalFrames = 120;
        this.baseCycleDuration = 6000; // Base cycle duration in ms (6 seconds at 1.0x speed)
        this.motionAnimationRequestId = null;
        this.motionType = 'motion1'; // Current motion type
        this.animationSpeed = 1.0; // Animation speed multiplier (0.5x to 10x)
        this.aspectRatio = 'original'; // Current aspect ratio setting
        this.animationStartTime = 0; // For time-based animation
        this.lastWaveCycle = -1; // For motion 4 wave cycle tracking

        // Default settings for reset functionality
        this.defaultSettings = {
            pixelSize: 80,
            threshold: 35,
            stretch: 0,
            sensitivity: 50,
            motionType: 'motion1',
            speed: 1.0,
            aspectRatio: 'original',
            primaryColor: '#ffffff'
        };

        // Video recording state
        this.isRecording          = false;
        this.isProcessingDownload = false;
        this.h264Encoder          = null;
        this.videoFrameCount      = 0;
        this.recordingStartTime   = 0;   // wall-clock ms when user pressed REC

        // Offline rendering (for video export): synthetic animation time
        // null = live preview; number = synthetic ms elapsed for current frame
        this.offlineRenderTime  = null;
        this.offlineTimeBase    = 0;    // subtracted from offlineRenderTime on cycle reset
        this._videoFrameUpdated = false; // tracks whether updateDisplay ran in current offline frame

        // Seeds saved at recording-start so offline render matches what the user watched
        this._recordedRandomStartPhase = 0;
        this._recordedRandomPeaks      = 1;
        this._recordedStartImageIndex  = 0;

        // Background color state
        this.backgroundColor = '#FFFFFF';

        // Image mask state (visible only with 2+ images)
        this.imageMaskEnabled = false;

        // Initialize other event listeners (isolated from upload)
        this.initializeEventListeners();
        this.initializeGallerySystem();

        // Override browser form-state restoration — always start with defaults
        this.applyDefaultsToUI();
    }

    applyDefaultsToUI() {
        const d = this.defaultSettings;
        document.getElementById('sizeSlider').value        = d.pixelSize;
        document.getElementById('thresholdSlider').value   = d.threshold;
        document.getElementById('stretchSlider').value     = d.stretch;
        document.getElementById('sensitivitySlider').value = d.sensitivity;
        document.getElementById('speedSlider').value       = d.speed;
        document.getElementById('motionTypeSelect').value  = d.motionType;
        document.getElementById('aspectRatioSelect').value = d.aspectRatio;
        document.getElementById('hexColorInput').value     = d.primaryColor;
    }

    // ===========================================
    // MULTI-IMAGE GALLERY SYSTEM
    // ===========================================
    initializeGallerySystem() {
        // Gallery UI is now in HTML, just setup event listeners
        this.setupGalleryEventListeners();
    }

    setupGalleryEventListeners() {
        // Click on mini-viewer stack to toggle expand
        const miniViewerStack = document.getElementById('miniViewerStack');
        if (miniViewerStack) {
            miniViewerStack.addEventListener('click', (e) => {
                if (!e.target.classList.contains('thumb-delete-btn')) {
                    this.toggleGalleryExpand();
                }
            });
        }

        // Close expanded view when clicking outside
        document.addEventListener('click', (e) => {
            const miniViewer = document.getElementById('miniViewer');
            if (this.isGalleryExpanded && miniViewer && !miniViewer.contains(e.target)) {
                this.closeGallery();
            }
        });
    }

    // Add image to the multi-image array
    addImage(img) {
        const imageId = 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        // Create thumbnail
        const thumbnailCanvas = document.createElement('canvas');
        const thumbSize = 80;
        thumbnailCanvas.width = thumbSize;
        thumbnailCanvas.height = thumbSize;
        const thumbCtx = thumbnailCanvas.getContext('2d');

        // Draw image cropped to square
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;
        thumbCtx.drawImage(img, sx, sy, minDim, minDim, 0, 0, thumbSize, thumbSize);

        const thumbnailUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);

        this.images.push({
            img: img,
            id: imageId,
            thumbnailUrl: thumbnailUrl
        });

        // If this is the first image, set it as current (this will update views)
        if (this.images.length === 1) {
            this.setCurrentImage(0);
        } else {
            this.updateStackedView();
            if (this.isGalleryExpanded) this.updateExpandedView();
        }

        this.updateImageMaskBtnVisibility();
        console.log(`Image added. Total images: ${this.images.length}`);
    }

    // Remove image by index
    removeImage(index) {
        if (index < 0 || index >= this.images.length) return;

        this.images.splice(index, 1);

        // Adjust current index if needed
        if (this.images.length === 0) {
            this.currentImageIndex = 0;
            this.originalImage = null;
            this.pixelCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            const dropZone = document.getElementById('dropZone');
            if (dropZone) dropZone.classList.remove('has-image');
        } else {
            if (this.currentImageIndex >= this.images.length) {
                this.currentImageIndex = this.images.length - 1;
            }
            this.setCurrentImage(this.currentImageIndex);
        }

        this.updateStackedView();
        this.updateExpandedView();
        this.updateImageMaskBtnVisibility();

        console.log(`Image removed. Total images: ${this.images.length}`);
    }

    // Set current active image
    setCurrentImage(index) {
        if (index < 0 || index >= this.images.length) return;

        this.currentImageIndex = index;
        this.originalImage = this.images[index].img;
        this.setupCanvas(this.originalImage);
        this.processImage();

        const dropZone = document.getElementById('dropZone');
        if (dropZone) dropZone.classList.add('has-image');

        this.updateStackedView();
        this.updateExpandedView();
    }

    // Update stacked thumbnail view (mini-viewer)
    updateStackedView() {
        const container = document.getElementById('miniViewerStack');
        if (!container) return;

        container.innerHTML = '';

        if (this.images.length === 0) {
            container.style.display = 'none';
            const miniViewer = document.getElementById('miniViewer');
            if (miniViewer) {
                miniViewer.style.display = 'none';
                miniViewer.classList.remove('visible');
            }
            return;
        }

        // Hide stack when expanded gallery is open — openGallery sets display:none inline,
        // but this method is called from many places and must not clobber that state.
        container.style.display = this.isGalleryExpanded ? 'none' : 'block';
        const miniViewer = document.getElementById('miniViewer');
        if (miniViewer) {
            miniViewer.style.display = 'block';
            miniViewer.classList.add('visible');
        }

        // For single image: show only the current image (stack-0)
        // For multiple images: show up to 3 stacked (stack-0, stack-1, stack-2)
        const maxVisible = Math.min(3, this.images.length);

        // Create thumbnails (reverse order so stack-0 renders last and appears on top)
        for (let stackPosition = maxVisible - 1; stackPosition >= 0; stackPosition--) {
            // For simplicity, just show first N images in order
            const imageData = this.images[stackPosition];

            const thumb = document.createElement('div');
            thumb.className = 'stacked-thumb stack-' + stackPosition;

            thumb.innerHTML = `
                <img src="${imageData.thumbnailUrl}" alt="Image ${stackPosition + 1}">
                ${stackPosition === 0 ? '<button class="thumb-delete-btn" data-index="0">×</button>' : ''}
            `;

            container.appendChild(thumb);
        }

        // Add image count badge if more than 1 image
        if (this.images.length > 1) {
            const badge = document.createElement('div');
            badge.className = 'image-count-badge';
            badge.textContent = this.images.length;
            container.appendChild(badge);
        }

        // Add delete button listeners
        container.querySelectorAll('.thumb-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeImage(index);
            });
        });

    }

    // Update expanded horizontal gallery view
    updateExpandedView() {
        const expandedImages = document.getElementById('expandedImages');
        if (!expandedImages) return;

        expandedImages.innerHTML = '';

        this.images.forEach((imageData, index) => {
            const item = document.createElement('div');
            item.className = 'expanded-thumb' + (index === this.currentImageIndex ? ' active' : '');
            item.dataset.index = index;

            item.innerHTML = `
                <img src="${imageData.thumbnailUrl}" alt="Image ${index + 1}" draggable="false">
                <button class="thumb-delete-btn" data-index="${index}">×</button>
            `;

            // Pointer-based drag — stopPropagation prevents document listener closing gallery
            item.addEventListener('pointerdown', (e) => {
                if (e.target.closest('.thumb-delete-btn')) return;
                e.stopPropagation();
                this.onGalleryPointerDown(e, index, item);
            });

            // Click to select (tap without drag)
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!e.target.closest('.thumb-delete-btn') && !this._recentlyDragged) {
                    this.setCurrentImage(index);
                }
            });

            expandedImages.appendChild(item);
        });

        // Delete button listeners
        expandedImages.querySelectorAll('.thumb-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.removeImage(index);
            });
        });
    }

    // ── Pointer-based gallery drag (Instagram/CapCut style) ──────────────────

    onGalleryPointerDown(e, index, element) {
        // Cancel any leftover drag state from a previous interaction
        if (this._galleryMoveHandler) {
            document.removeEventListener('pointermove', this._galleryMoveHandler);
            document.removeEventListener('pointerup', this._galleryUpHandler);
            document.removeEventListener('pointercancel', this._galleryUpHandler);
        }
        if (this._galleryDragActive) this._cleanupGalleryDrag();

        this._galleryDragIndex = index;
        this._galleryDragElement = element;
        this._galleryDragStartX = e.clientX;
        this._galleryDragStartY = e.clientY;
        this._galleryDragActive = false;
        this._galleryDropIndex = undefined;

        this._galleryMoveHandler = (ev) => this.onGalleryPointerMove(ev);
        this._galleryUpHandler = (ev) => this.onGalleryPointerUp(ev);
        document.addEventListener('pointermove', this._galleryMoveHandler, { passive: false });
        document.addEventListener('pointerup', this._galleryUpHandler);
        document.addEventListener('pointercancel', this._galleryUpHandler);
    }

    onGalleryPointerMove(e) {
        e.preventDefault();
        this._ptrX = e.clientX;
        this._ptrY = e.clientY;

        if (!this._galleryDragActive) {
            const dist = Math.hypot(e.clientX - this._galleryDragStartX, e.clientY - this._galleryDragStartY);
            if (dist < 8) return;
            this._activateGalleryDrag(e);
            return;
        }

        // Throttle DOM writes to one per animation frame
        if (!this._rafPending) {
            this._rafPending = true;
            requestAnimationFrame(() => {
                this._rafPending = false;
                if (!this._galleryDragActive) return;

                // Move clone via transform — no layout reflow
                this._galleryClone.style.transform =
                    `translate3d(${this._ptrX - this._galleryCloneHalfW}px,${this._ptrY - this._galleryCloneHalfH}px,0) scale(1.08)`;

                // Only update card positions when the target slot changes
                const newDrop = this._computeGalleryDrop(this._ptrX);
                if (newDrop !== this._galleryDropIndex) {
                    this._galleryDropIndex = newDrop;
                    this._applyGalleryGap(newDrop);
                }
            });
        }
    }

    _activateGalleryDrag(e) {
        this._galleryDragActive = true;
        const el = this._galleryDragElement;
        const rect = el.getBoundingClientRect();
        this._galleryCloneHalfW = rect.width / 2;
        this._galleryCloneHalfH = rect.height / 2;

        // Clone anchored at origin, moved entirely via transform (GPU composited, no reflow)
        const clone = document.createElement('div');
        clone.className = 'expanded-thumb gallery-drag-clone';
        clone.style.cssText = [
            'position:fixed',
            'left:0',
            'top:0',
            `width:${rect.width}px`,
            `height:${rect.height}px`,
            `transform:translate3d(${e.clientX - rect.width / 2}px,${e.clientY - rect.height / 2}px,0) scale(1.08)`,
            'z-index:9999',
            'pointer-events:none',
            'opacity:0.92',
            'will-change:transform',
            'box-shadow:0 10px 30px rgba(0,0,0,0.7)',
            'border-color:#fff',
        ].join(';');
        clone.innerHTML = `<img src="${this.images[this._galleryDragIndex].thumbnailUrl}" alt="" draggable="false">`;
        document.body.appendChild(clone);
        this._galleryClone = clone;

        // Lock panel width before removing source so the mini-viewer doesn't contract
        // rightward, and suppress overflow so translated neighbours don't show a scrollbar.
        const expandedPanel = document.getElementById('miniViewerExpanded');
        if (expandedPanel) {
            expandedPanel.style.minWidth = expandedPanel.offsetWidth + 'px';
            expandedPanel.style.overflow = 'hidden';
        }

        // Remove source from flex flow completely — opacity:0 kept its slot, causing a
        // permanent phantom gap AND allowing transforms to push cards on top of it.
        el.classList.add('gallery-drag-source');
        el.style.display = 'none';

        const expandedImages = document.getElementById('expandedImages');
        expandedImages?.classList.add('drag-in-progress');

        // Cache neighbours after source is removed (layout has reflowed without it).
        // offsetWidth forces the reflow synchronously so rects are correct.
        this._dragThumbs = [...expandedImages.querySelectorAll('.expanded-thumb')]
            .filter(t => t !== el);
        // Shift amount = card width only. The flex gap already provides spacing between
        // cards, so adding it again would create an oversized gap.
        this._dragSlotW = this._dragThumbs[0]?.offsetWidth ?? 70;

        // Snapshot base rects once — used by _computeGalleryDrop every frame so the
        // drop target doesn't shift under the cursor as transforms are applied.
        this._dragBaseRects = this._dragThumbs.map(t => {
            const r = t.getBoundingClientRect();
            return { cx: r.left + r.width / 2 };
        });

        this._rafPending = false;
        this._ptrX = e.clientX;
        this._ptrY = e.clientY;
    }

    _computeGalleryDrop(cursorX) {
        // Use pre-snapshotted base centres — not live rects — so the insertion point
        // doesn't move as neighbouring cards slide around during the drag.
        const rects = this._dragBaseRects;
        if (!rects) return 0;
        for (let i = 0; i < rects.length; i++) {
            if (cursorX < rects[i].cx) return i;
        }
        return rects.length;
    }

    _applyGalleryGap(dropIndex) {
        const thumbs = this._dragThumbs;
        if (!thumbs) return;
        const shift = `translate3d(${this._dragSlotW}px,0,0)`;
        thumbs.forEach((t, i) => {
            t.style.transform = i >= dropIndex ? shift : '';
        });
    }

    onGalleryPointerUp(e) {
        document.removeEventListener('pointermove', this._galleryMoveHandler);
        document.removeEventListener('pointerup', this._galleryUpHandler);
        document.removeEventListener('pointercancel', this._galleryUpHandler);
        this._galleryMoveHandler = null;
        this._galleryUpHandler = null;

        if (!this._galleryDragActive) {
            // Plain tap — click handler already handles selection, nothing to do
            this._galleryDragIndex = undefined;
            this._galleryDragElement = null;
            return;
        }

        if (this._galleryDropIndex !== undefined) {
            const from = this._galleryDragIndex;
            const to   = this._galleryDropIndex; // index in remaining N-1 cards

            const moved = this.images.splice(from, 1)[0];
            this.images.splice(to, 0, moved);

            let ci = this.currentImageIndex;
            if (from === ci) {
                ci = to;
            } else {
                if (from < ci) ci--;
                if (to <= ci) ci++;
            }
            this.currentImageIndex = ci;

            this._recentlyDragged = true;
            setTimeout(() => { this._recentlyDragged = false; }, 150);
        }

        this._cleanupGalleryDrag();
    }

    _cleanupGalleryDrag() {
        if (this._galleryClone) { this._galleryClone.remove(); this._galleryClone = null; }
        if (this._galleryDragElement) {
            // Restore display before DOM rebuild so the element isn't briefly invisible
            this._galleryDragElement.style.display = '';
            this._galleryDragElement.classList.remove('gallery-drag-source');
            this._galleryDragElement = null;
        }
        document.querySelectorAll('#expandedImages .expanded-thumb').forEach(t => {
            t.style.transform = '';
        });
        document.getElementById('expandedImages')?.classList.remove('drag-in-progress');

        // Release the width lock and restore scroll behaviour
        const expandedPanel = document.getElementById('miniViewerExpanded');
        if (expandedPanel) {
            expandedPanel.style.minWidth = '';
            expandedPanel.style.overflow = '';
        }
        this._galleryDragActive = false;
        this._galleryDragIndex = undefined;
        this._galleryDropIndex = undefined;
        this._dragThumbs = null;
        this._dragBaseRects = null;
        this._dragSlotW = undefined;
        this._rafPending = false;

        this.updateStackedView();
        this.updateExpandedView();
    }

    toggleGalleryExpand() {
        if (this.isGalleryExpanded) {
            this.closeGallery();
        } else {
            this.openGallery();
        }
    }

    openGallery() {
        if (this.images.length === 0) return;

        this.isGalleryExpanded = true;
        // Explicitly hide the stack — the CSS `.mini-viewer.expanded .mini-viewer-stack`
        // rule is overridden by the inline display:block set in updateStackedView, so we
        // must also set the inline style directly here.
        const stack = document.getElementById('miniViewerStack');
        if (stack) stack.style.display = 'none';

        const expanded = document.getElementById('miniViewerExpanded');
        if (expanded) {
            expanded.style.display = 'flex';
            this.updateExpandedView();
        }
        document.getElementById('miniViewer')?.classList.add('expanded');
    }

    closeGallery() {
        this.isGalleryExpanded = false;
        const expanded = document.getElementById('miniViewerExpanded');
        if (expanded) expanded.style.display = 'none';

        // Restore stack visibility
        const stack = document.getElementById('miniViewerStack');
        if (stack && this.images.length > 0) stack.style.display = 'block';

        document.getElementById('miniViewer')?.classList.remove('expanded');
    }

    // Advance to next image in sequence (for animation)
    advanceToNextImage() {
        if (this.images.length <= 1) return false;

        const nextIndex = (this.currentImageIndex + 1) % this.images.length;

        // Reset animation state — use synthetic base for offline rendering, wall-clock for live
        if (this.offlineRenderTime !== null) {
            this.offlineTimeBase = this.offlineRenderTime;
        } else {
            this.animationStartTime = performance.now();
        }
        this.motionAnimationFrame = 0;
        this.lastWaveCycle = -1;
        this.lastCycleNumber = -1;
        this._impulseCycle = -1;
        this._glitchCycle = -1;
        this._randomStartPhase = Math.random();
        this._randomPeaks = Math.floor(Math.random() * 3) + 1;
        this._imgMaskRawProgress = 0; // kept for safety (unused)

        this.currentImageIndex = nextIndex;
        this.originalImage = this.images[nextIndex].img;

        // Clear visible canvas immediately so the outgoing frame's pixels don't
        // linger for even one rAF tick while setupCanvas/prepareMotionBarOrder run.
        this.pixelCtx.clearRect(0, 0, this.pixelCanvas.width, this.pixelCanvas.height);

        this.setupCanvas(this.originalImage); // draws raw image into this.ctx for sampling

        if (this.motionAnimationRunning) {
            // During animation: just prepare bar metadata and start with a clean canvas.
            // Calling processImage() here would paint every bar at once, causing a
            // one-frame full-image flash before the animation builds up from zero.
            this.prepareMotionBarOrder();
            this.clearCanvasBackground();
        } else {
            this.processImage();
            this.prepareMotionBarOrder();
        }

        this.updateStackedView();

        if (this.motionAnimationRunning) {
            this.scheduleNextFrame();
        }

        return true;
    }

    // ===========================================
    // CRITICAL: Isolated Upload System
    // This is completely decoupled from other features
    // ===========================================
    initializeUploadSystem() {
        try {
            const fileInput = document.getElementById('fileInput');
            const uploadBtn = document.getElementById('uploadBtn');
            const dropZone = document.getElementById('dropZone');
            const mainContent = document.querySelector('.main-content');

            if (!fileInput) {
                console.error('CRITICAL: fileInput element not found');
                return;
            }

            // Enable multiple file selection
            fileInput.setAttribute('multiple', 'true');

            // Upload button click - wrapped in try-catch
            if (uploadBtn) {
                uploadBtn.addEventListener('click', (e) => {
                    try {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInput.click();
                    } catch (err) {
                        console.error('Upload button error:', err);
                    }
                });
            }

            // File input change - the core upload handler (now supports multiple)
            fileInput.addEventListener('change', (e) => {
                try {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                        for (let i = 0; i < files.length; i++) {
                            this.safeHandleFileSelect(files[i]);
                        }
                    }
                    // Reset file input so same files can be re-selected
                    fileInput.value = '';
                } catch (err) {
                    console.error('File input change error:', err);
                    alert('Error selecting file. Please try again.');
                }
            });

            // Tap / click on drop zone opens file picker (essential for mobile)
            if (dropZone) {
                dropZone.addEventListener('click', (e) => {
                    try {
                        // Ignore clicks on the canvas, gallery overlay, or controls
                        if (e.target.closest('#pixelCanvas') ||
                            e.target.closest('#canvas') ||
                            e.target.closest('#miniViewer')) return;
                        fileInput.click();
                    } catch (err) {
                        console.error('Drop zone click error:', err);
                    }
                });
            }

            // Drag and drop events (now supports multiple files)
            if (dropZone) {
                dropZone.addEventListener('dragover', (e) => {
                    try {
                        e.preventDefault();
                        dropZone.classList.add('dragover');
                    } catch (err) {
                        console.error('Dragover error:', err);
                    }
                });

                dropZone.addEventListener('dragleave', () => {
                    try {
                        dropZone.classList.remove('dragover');
                    } catch (err) {
                        console.error('Dragleave error:', err);
                    }
                });

                dropZone.addEventListener('drop', (e) => {
                    try {
                        e.preventDefault();
                        dropZone.classList.remove('dragover');
                        const files = e.dataTransfer && e.dataTransfer.files;
                        if (files && files.length > 0) {
                            for (let i = 0; i < files.length; i++) {
                                if (this.isValidImageFile(files[i])) {
                                    this.safeHandleFileSelect(files[i]);
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Drop error:', err);
                        alert('Error processing dropped file. Please try again.');
                    }
                });
            }

            console.log('Upload system initialized successfully');
        } catch (err) {
            console.error('CRITICAL: Failed to initialize upload system:', err);
        }
    }

    // Safe file handler with comprehensive error handling
    safeHandleFileSelect(file) {
        try {
            if (!file) {
                console.error('No file provided');
                return;
            }

            if (!this.isValidImageFile(file)) {
                alert('Please select a valid image file (PNG, JPG, or WebP)');
                return;
            }

            const reader = new FileReader();

            reader.onerror = (err) => {
                console.error('FileReader error:', err);
                alert('Error reading file. Please try again.');
            };

            reader.onload = (e) => {
                try {
                    const img = new Image();

                    img.onerror = () => {
                        console.error('Image load error');
                        alert('Error loading image. Please try a different file.');
                    };

                    img.onload = () => {
                        try {
                            // Add to multi-image array instead of replacing
                            this.addImage(img);

                            console.log('Image loaded successfully:', img.width, 'x', img.height);
                        } catch (err) {
                            console.error('Error processing loaded image:', err);
                            alert('Error processing image. Please try again.');
                        }
                    };

                    img.src = e.target.result;
                } catch (err) {
                    console.error('Error in reader onload:', err);
                    alert('Error processing file. Please try again.');
                }
            };

            reader.readAsDataURL(file);
        } catch (err) {
            console.error('Error in safeHandleFileSelect:', err);
            alert('Error handling file. Please try again.');
        }
    }

    initializeEventListeners() {
        // File input and drag & drop - REMOVED (now in initializeUploadSystem)

        // Background removal toggle
        this.safeAddEventListener('backgroundRemovalBtn', 'click', () => this.toggleRemoveSide());
        this.safeAddEventListener('removeSwapBtn', 'click', () => this.toggleRemoveSide());

        // Sensitivity slider
        this.safeAddEventListener('sensitivitySlider', 'input', (e) => {
            this.processImage();
            this.saveCurrentSettings();
        });

        // Size slider
        this.safeAddEventListener('sizeSlider', 'input', (e) => {
            this.processImage();
            this.saveCurrentSettings();
        });

        // Threshold slider
        this.safeAddEventListener('thresholdSlider', 'input', (e) => {
            this.processImage();
            this.saveCurrentSettings();
        });

        // Stretch slider
        this.safeAddEventListener('stretchSlider', 'input', (e) => {
            this.processImage();
            this.saveCurrentSettings();
        });

        // Download buttons
        this.safeAddEventListener('pngDownloadBtn', 'click', () => this.downloadPNG());

        // Reset Settings button
        this.safeAddEventListener('resetSettingsBtn', 'click', () => this.resetSettings());

        // Start/Stop Animation button
        this.safeAddEventListener('startStopMotionBtn', 'click', () => this.toggleMotionAnimation());

        // Motion type selector
        this.safeAddEventListener('motionTypeSelect', 'change', (e) => {
            this.setMotionType(e.target.value);
            this.saveCurrentSettings();
        });

        // Aspect ratio selector
        this.safeAddEventListener('aspectRatioSelect', 'change', (e) => {
            this.setAspectRatio(e.target.value);
            this.saveCurrentSettings();
        });

        // Speed slider for animation
        this.safeAddEventListener('speedSlider', 'input', (e) => {
            this.animationSpeed = parseFloat(e.target.value);
            this.saveCurrentSettings();
        });

        // Download Video button
        this.safeAddEventListener('videoDownloadBtn', 'click', () => this.downloadMotionVideo());

        // Background color controls
        this.safeAddEventListener('hexColorInput', 'input', (e) => {
            this.updateBackgroundColor(e.target.value);
            this.saveCurrentSettings();
        });
        this.safeAddEventListener('hexColorInput', 'change', (e) => {
            this.updateBackgroundColor(e.target.value);
            this.saveCurrentSettings();
        });

        // Color wheel controls
        this.safeAddEventListener('colorPreview', 'click', () => this.toggleColorWheel());
        this.safeAddEventListener('closeColorWheel', 'click', () => this.closeColorWheel());

        // Close color wheel when clicking outside
        document.addEventListener('click', (e) => {
            try {
                const colorWheel = document.getElementById('colorWheelPopup');
                const colorPreview = document.getElementById('colorPreview');
                if (colorWheel && colorPreview &&
                    colorWheel.style.display === 'block' &&
                    !colorWheel.contains(e.target) &&
                    !colorPreview.contains(e.target)) {
                    this.closeColorWheel();
                }
            } catch (err) {
                console.warn('Color wheel close error:', err);
            }
        });

        // Image mask control (2nd image as mask)
        this.safeAddEventListener('imageMaskBtn', 'click', () => this.toggleImageMask());
    }

    // Helper method to safely add event listeners
    safeAddEventListener(elementId, event, handler) {
        try {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, (e) => {
                    try {
                        handler(e);
                    } catch (err) {
                        console.warn(`Error in ${elementId} ${event} handler:`, err);
                    }
                });
            } else {
                console.warn(`Element not found: ${elementId}`);
            }
        } catch (err) {
            console.warn(`Error adding listener to ${elementId}:`, err);
        }
    }

    toggleMotionAnimation() {
        if (this.motionAnimationRunning) {
            this.stopMotionAnimation();
        } else {
            this.startMotionAnimation();
        }
    }

    setMotionType(motionType) {
        this.motionType = motionType;
        
        // Reset impulse origins so next cycle picks new positions
        this._impulseCycle = -1;
        
        // If animation is running, restart it with new motion type
        if (this.motionAnimationRunning) {
            this.stopMotionAnimation();
            this.startMotionAnimation();
        }
    }

    setAspectRatio(aspectRatio) {
        this.aspectRatio = aspectRatio;
        
        if (this.originalImage) {
            // Reconfigure canvas with new aspect ratio
            this.setupCanvas(this.originalImage);
            this.processImage();
        }
    }

    startMotionAnimation() {
        if (!this.originalImage) {
            alert('Please upload an image first');
            return;
        }
        this.motionAnimationRunning = true;
        document.getElementById('startStopMotionBtn').textContent = window.innerWidth <= 768 ? '◼ STOP' : '◼ STOP ANIMATION';
        this.prepareMotionBarOrder();
        this.motionAnimationFrame = 0;
        this.animationStartTime = performance.now();
        this._impulseCycle = -1;
        this._glitchCycle = -1;
        this.lastWaveCycle = -1;
        this.lastCycleNumber = -1;
        this._randomStartPhase = Math.random();
        this._randomPeaks = Math.floor(Math.random() * 3) + 1;
        this.runMotionAnimation();
    }

    stopMotionAnimation() {
        this.motionAnimationRunning = false;
        document.getElementById('startStopMotionBtn').textContent = window.innerWidth <= 768 ? '▷ START' : '▷ START ANIMATION';
        if (this.motionAnimationRequestId) {
            cancelAnimationFrame(this.motionAnimationRequestId);
            this.motionAnimationRequestId = null;
        }

        // Note: Recording continues independently, user must click video button to stop

        // Optionally, redraw the final image
        this.processImage();
    }

    prepareMotionBarOrder() {
        // Prepare a randomized order of bars for animation - only include visible bars
        const pixelSize = parseInt(document.getElementById('sizeSlider').value);
        const threshold = parseInt(document.getElementById('thresholdSlider').value);
        const stretchFactor = parseInt(document.getElementById('stretchSlider').value);
        const baseBarHeight = pixelSize * 3;
        const extraHeight = Math.floor(stretchFactor * 2);
        const desiredBarHeight = baseBarHeight + extraHeight;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Calculate exact bar counts so bars tile perfectly to all edges (same as pixelateImage)
        const numBarsHorizontally = Math.max(1, Math.round(width / pixelSize));
        const numBarsVertically = Math.max(1, Math.round(height / desiredBarHeight));

        // ── IMG MASK: sample the NEXT image via a tiny canvas (1 px per bar) ──
        // This is reliable because we draw at bar-grid resolution (e.g. 10×3),
        // avoiding any state issues with the full-resolution this.ctx.
        if (this.imgMaskActive()) {
            const n = this.images.length;
            const nextImg = this.images[(this.currentImageIndex + 1) % n].img;

            // Downscale next image to bar-grid size — each pixel = average colour of one bar region
            const tinyCanvas = document.createElement('canvas');
            tinyCanvas.width  = numBarsHorizontally;
            tinyCanvas.height = numBarsVertically;
            const tinyCtx = tinyCanvas.getContext('2d');
            tinyCtx.drawImage(nextImg, 0, 0, numBarsHorizontally, numBarsVertically);
            const tinyData = tinyCtx.getImageData(0, 0, numBarsHorizontally, numBarsVertically).data;

            const bars = [];
            for (let col = 0; col < numBarsHorizontally; col++) {
                const x = Math.round(col * width / numBarsHorizontally);
                const actualBarWidth = Math.round((col + 1) * width / numBarsHorizontally) - x;
                for (let row = 0; row < numBarsVertically; row++) {
                    const y = Math.round(row * height / numBarsVertically);
                    const actualBarHeight = Math.round((row + 1) * height / numBarsVertically) - y;
                    const idx = (row * numBarsHorizontally + col) * 4;
                    // Include ALL bars — even dark ones — so Image 2 fully covers Image 1
                    bars.push({
                        x, y,
                        r: tinyData[idx]     || 0,
                        g: tinyData[idx + 1] || 0,
                        b: tinyData[idx + 2] || 0,
                        width:  actualBarWidth,
                        height: actualBarHeight
                    });
                }
            }

            // Shuffle
            for (let i = bars.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [bars[i], bars[j]] = [bars[j], bars[i]];
            }

            this.motionBarOrder = bars;
            console.log(`Animation prepared: ${bars.length} bars (IMG MASK – ${numBarsHorizontally}×${numBarsVertically} grid)`);
            return; // ← skip normal sampling path; this.ctx is untouched
        }

        const bars = this.selectStrokeBars(numBarsHorizontally, numBarsVertically, threshold);

        // Shuffle bars randomly
        for (let i = bars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bars[i], bars[j]] = [bars[j], bars[i]];
        }

        this.motionBarOrder = bars;
        console.log(`Animation prepared: ${bars.length} bars`);
    }

    // Returns elapsed animation time in ms.
    // During live preview: wall-clock time since animation start.
    // During offline video rendering: synthetic time (frame index × frame duration).
    getElapsedTime() {
        if (this.offlineRenderTime !== null) return this.offlineRenderTime - this.offlineTimeBase;
        return performance.now() - this.animationStartTime;
    }

    runMotionAnimation() {
        if (!this.motionAnimationRunning) return;

        // Route to different motion types
        switch (this.motionType) {
            case 'motion1':
                this.runMotion1Animation();
                break;
            case 'motion3':
                this.runMotion3Animation();
                break;
            case 'motion4':
                this.runMotion4Animation();
                break;
            case 'motion5':
                this.runMotion5Animation();
                break;
            case 'motion6':
                this.runMotion6Animation();
                break;
            case 'motion8':
                this.runMotion8Animation();
                break;
            default:
                this.runMotion1Animation();
        }
    }

    runMotion1Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycleNumber = Math.floor(elapsedTime / cycleDuration);
        if (this.checkCycleAdvance(currentCycleNumber)) return;

        const halfCycleDuration = cycleDuration / 2;
        const timeInCycle = elapsedTime % cycleDuration;
        const rawProgress = timeInCycle / cycleDuration;

        this.clearCanvasBackground();

        const N1 = this.motionBarOrder.length;
        if (this.imgMaskActive()) {
            // IMG MASK: bars reveal the next image through clip-windows — guaranteed visible
            const visibleCount = Math.floor(rawProgress * N1);
            if (visibleCount > 0) {
                const n = this.images.length;
                const nextImg = this.images[(this.currentImageIndex + 1) % n].img;
                this.pixelCtx.save();
                this.pixelCtx.beginPath();
                for (let i = 0; i < visibleCount; i++) {
                    const bar = this.motionBarOrder[i];
                    this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
                }
                this.pixelCtx.clip();
                this.drawImageToContext(this.pixelCtx, nextImg);
                this.pixelCtx.restore();
            }
        } else {
            let visibleBarCount;
            if (timeInCycle < halfCycleDuration) {
                visibleBarCount = Math.floor((timeInCycle / halfCycleDuration) * N1);
            } else {
                const downProgress = (timeInCycle - halfCycleDuration) / halfCycleDuration;
                visibleBarCount = Math.floor((1 - downProgress) * N1);
            }
            for (let i = 0; i < visibleBarCount; i++) this.drawBar(this.motionBarOrder[i]);
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    runMotion3Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycleNumber = Math.floor(elapsedTime / cycleDuration);
        if (this.checkCycleAdvance(currentCycleNumber)) return;

        if (this._impulseCycle !== currentCycleNumber) {
            this._impulseCycle = currentCycleNumber;
            let s = (currentCycleNumber * 1664525 + 1013904223) >>> 0;
            const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
            const w = this.canvas.width, h = this.canvas.height;
            const count = rng() > 0.45 ? 3 : 2;
            this._impulseOrigins = [];
            for (let i = 0; i < count; i++) {
                this._impulseOrigins.push({
                    x: w * (0.15 + rng() * 0.7),
                    y: h * (0.15 + rng() * 0.7),
                    delay: i === 0 ? 0 : rng() * 0.22,
                });
            }
            this._impulseMaxR = Math.sqrt(w * w + h * h);
        }

        const phase = (elapsedTime % cycleDuration) / cycleDuration;
        const maxR = this._impulseMaxR;
        const scatterW = maxR * 0.16;
        const expandEnd = 0.62;

        this.clearCanvasBackground();

        const expanding = phase <= expandEnd;

        if (this.imgMaskActive()) {
            // IMG MASK: circles expand outward — clip-window rendering
            const scaledPhase = Math.min(phase, expandEnd);
            const visibleBars = [];
            for (const bar of this.motionBarOrder) {
                const hx = (bar.x * 73856093) >>> 0;
                const hy = (bar.y * 19349663) >>> 0;
                const barT = ((hx ^ hy) * 2654435761 >>> 0) / 0xFFFFFFFF;
                let visible = false;
                for (const o of this._impulseOrigins) {
                    const dist = Math.sqrt((bar.x - o.x) ** 2 + (bar.y - o.y) ** 2);
                    const localT = Math.max(0, Math.min(1, (scaledPhase - o.delay) / (expandEnd - o.delay)));
                    const r = maxR * (1 - Math.pow(1 - localT, 2.4));
                    if (barT < (r - dist) / scatterW) { visible = true; break; }
                }
                if (visible) visibleBars.push(bar);
            }
            this._clipDrawImgMask(visibleBars);
        } else {
            const contractT = expanding ? 0 : (phase - expandEnd) / (1 - expandEnd);
            const collapseR = expanding ? maxR : maxR * Math.pow(1 - contractT, 1.6);

            for (const bar of this.motionBarOrder) {
                const hx = (bar.x * 73856093) >>> 0;
                const hy = (bar.y * 19349663) >>> 0;
                const barT = ((hx ^ hy) * 2654435761 >>> 0) / 0xFFFFFFFF;

                let visible = false;
                for (const o of this._impulseOrigins) {
                    const dist = Math.sqrt((bar.x - o.x) ** 2 + (bar.y - o.y) ** 2);
                    if (expanding) {
                        const localT = Math.max(0, Math.min(1, (phase - o.delay) / (expandEnd - o.delay)));
                        const r = maxR * (1 - Math.pow(1 - localT, 2.4));
                        if (barT < (r - dist) / scatterW) { visible = true; break; }
                    } else {
                        if (barT < (collapseR - dist) / scatterW) { visible = true; break; }
                    }
                }

                if (visible) this.drawBar(bar);
            }
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    runMotion4Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycle = Math.floor(elapsedTime / cycleDuration);
        const timeInCycle = elapsedTime % cycleDuration;

        if (this.checkCycleAdvance(currentCycle)) return;

        if (this.lastWaveCycle !== currentCycle) {
            this.lastWaveCycle = currentCycle;
            this.waveDirection = Math.floor(Math.random() * 4);
            let s = (currentCycle * 1664525 + 1013904223) >>> 0;
            const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
            this._waveFreq1  = 1.8 + rng() * 1.4;
            this._waveFreq2  = 4.0 + rng() * 2.5;
            this._waveAmp1   = 0.06 + rng() * 0.06;
            this._waveAmp2   = 0.03 + rng() * 0.03;
            this._wavePhase  = rng() * Math.PI * 2;
        }

        const { width, height } = this.canvas;
        const rawProgress = timeInCycle / cycleDuration;

        this.clearCanvasBackground();

        // Wide scatter zone for organic wave edge
        const scatterWidth = 0.45;

        if (this.imgMaskActive()) {
            // IMG MASK: one-way wave sweep.
            // wavePos is scaled past (1 + scatterWidth + max wave displacement) so ALL bars
            // are guaranteed visible before rawProgress reaches 1.0. When the cycle then
            // transitions (clearCanvasBackground draws Image 2 as the new background), the
            // canvas is already fully Image 2 via clip-windows → zero visible hard cut.
            const wavePos = Math.sin(rawProgress * Math.PI / 2) * (1 + scatterWidth + 0.25);
            const visibleBars = [];
            for (const bar of this.motionBarOrder) {
                let along, perp;
                switch (this.waveDirection) {
                    case 0: along = bar.x / width;      perp = bar.y / height; break;
                    case 1: along = 1 - bar.x / width;  perp = bar.y / height; break;
                    case 2: along = bar.y / height;      perp = bar.x / width;  break;
                    case 3: along = 1 - bar.y / height; perp = bar.x / width;  break;
                }
                const disp = this._waveAmp1 * Math.sin(perp * this._waveFreq1 * Math.PI * 2 + this._wavePhase)
                           + this._waveAmp2 * Math.sin(perp * this._waveFreq2 * Math.PI * 2 - this._wavePhase * 1.3);
                const effectiveAlong = along + disp;
                const hx = (bar.x * 73856093) >>> 0;
                const hy = (bar.y * 19349663) >>> 0;
                const barT = ((hx ^ hy) * 2654435761 >>> 0) / 0xFFFFFFFF;
                if (barT < (wavePos - effectiveAlong) / scatterWidth) visibleBars.push(bar);
            }
            this._clipDrawImgMask(visibleBars);
        } else {
            // Sine arc 0→1→0 over the full cycle: no separate advance/retreat phases,
            // no double-slow-zone at the midpoint, no abrupt jump.
            const frontPos = Math.sin(rawProgress * Math.PI);

            for (const bar of this.motionBarOrder) {
                let along, perp;
                switch (this.waveDirection) {
                    case 0: along = bar.x / width;      perp = bar.y / height; break;
                    case 1: along = 1 - bar.x / width;  perp = bar.y / height; break;
                    case 2: along = bar.y / height;      perp = bar.x / width;  break;
                    case 3: along = 1 - bar.y / height; perp = bar.x / width;  break;
                }
                const disp = this._waveAmp1 * Math.sin(perp * this._waveFreq1 * Math.PI * 2 + this._wavePhase)
                           + this._waveAmp2 * Math.sin(perp * this._waveFreq2 * Math.PI * 2 - this._wavePhase * 1.3);
                const effectiveAlong = along + disp;
                const hx = (bar.x * 73856093) >>> 0;
                const hy = (bar.y * 19349663) >>> 0;
                const barT = ((hx ^ hy) * 2654435761 >>> 0) / 0xFFFFFFFF;

                if (barT < (frontPos - effectiveAlong) / scatterWidth) this.drawBar(bar);
            }
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    runMotion5Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycle = Math.floor(elapsedTime / cycleDuration);
        const timeInCycle = elapsedTime % cycleDuration;

        if (this.checkCycleAdvance(currentCycle)) return;

        const rawProgress = timeInCycle / cycleDuration;
        const totalBars = this.motionBarOrder.length;

        // ── IMG MASK mode: next image's bars fade in over current image ──
        if (this.imgMaskActive()) {
            this.clearCanvasBackground();
            const n = this.images.length;
            const nextImg = this.images[(this.currentImageIndex + 1) % n].img;

            const fadeZone = 0.2;
            // Fully visible bars: batch clip+draw in one pass
            const fullyVisible = [];
            for (let i = 0; i < totalBars; i++) {
                if (i / totalBars <= rawProgress) fullyVisible.push(this.motionBarOrder[i]);
            }
            this._clipDrawImgMask(fullyVisible);

            // Fading-in bars: individual clip with alpha
            for (let i = 0; i < totalBars; i++) {
                const barPos = i / totalBars;
                if (barPos > rawProgress && barPos <= rawProgress + fadeZone) {
                    const alpha = (rawProgress + fadeZone - barPos) / fadeZone;
                    const bar = this.motionBarOrder[i];
                    this.pixelCtx.save();
                    this.pixelCtx.globalAlpha = alpha;
                    this.pixelCtx.beginPath();
                    this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
                    this.pixelCtx.clip();
                    this.drawImageToContext(this.pixelCtx, nextImg);
                    this.pixelCtx.restore();
                }
            }
            this.pixelCtx.globalAlpha = 1.0;
            this.updateDisplay();
            this.motionAnimationFrame++;
            this.scheduleNextFrame();
            return;
        }

        // ── Standard FADE: strokes fade in, then out, over the image ──
        this.clearCanvasBackground();
        const fadeIn = rawProgress <= 0.5;
        const phase = fadeIn ? rawProgress * 2 : (rawProgress - 0.5) * 2;
        for (let i = 0; i < totalBars; i++) {
            const bar = this.motionBarOrder[i];
            const pos = i / totalBars;
            const alpha = fadeIn
                ? Math.max(0, Math.min(1, 1 - (pos - phase) / 0.2))
                : Math.max(0, Math.min(1, (pos - phase) / 0.2));
            if (alpha <= 0) continue;
            this.pixelCtx.globalAlpha = alpha;
            this.drawBar(bar);
        }
        this.pixelCtx.globalAlpha = 1.0;

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    runMotion6Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycle = Math.floor(elapsedTime / cycleDuration);

        if (this.checkCycleAdvance(currentCycle)) return;

        // Reshuffle once per cycle using LCG + Fisher-Yates
        // (sort-with-sin breaks at seed=0 since sin(0)=0 for every term)
        if (this._glitchCycle !== currentCycle) {
            this._glitchCycle = currentCycle;
            this._glitchBars = [...this.motionBarOrder];
            let s = (currentCycle * 1664525 + 1013904223) >>> 0;
            const rng = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0xFFFFFFFF; };
            for (let i = this._glitchBars.length - 1; i > 0; i--) {
                const j = Math.floor(rng() * (i + 1));
                [this._glitchBars[i], this._glitchBars[j]] = [this._glitchBars[j], this._glitchBars[i]];
            }
        }

        const rawProgress = (elapsedTime % cycleDuration) / cycleDuration;

        this.clearCanvasBackground();

        const total = this._glitchBars.length;
        if (total === 0) { this.scheduleNextFrame(); return; }

        if (this.imgMaskActive()) {
            // IMG MASK: bars appear in random glitch order covering full cycle (no retreat)
            const target = Math.floor(total * rawProgress);
            const visibleBars = this._glitchBars.slice(0, target);
            // Glitch fringe on leading edge
            for (let i = target; i < Math.min(target + 8, total); i++) {
                if (Math.random() > 0.6) visibleBars.push(this._glitchBars[i]);
            }
            this._clipDrawImgMask(visibleBars);
        } else if (rawProgress < 0.5) {
            const target = Math.floor(total * rawProgress * 2);
            for (let i = 0; i < target; i++) this.drawBar(this._glitchBars[i]);
            for (let i = target; i < Math.min(target + 8, total); i++) {
                if (Math.random() > 0.6) this.drawBar(this._glitchBars[i]);
            }
        } else {
            const hidden = Math.floor(total * (rawProgress - 0.5) * 2);
            for (let i = hidden; i < total; i++) this.drawBar(this._glitchBars[i]);
            for (let i = Math.max(0, hidden - 8); i < hidden; i++) {
                if (Math.random() > 0.7) this.drawBar(this._glitchBars[i]);
            }
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    runMotion7Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycle = Math.floor(elapsedTime / cycleDuration);

        if (this.checkCycleAdvance(currentCycle)) return;

        this.clearCanvasBackground();
        const total = this.motionBarOrder.length;
        if (total === 0) { this.scheduleNextFrame(); return; }

        // Phase starts at a random offset each run so no two starts look the same.
        // _randomPeaks (1–3) controls how many pulses fire per cycle.
        const phase = ((elapsedTime % cycleDuration) / cycleDuration + this._randomStartPhase) % 1;
        const density = Math.pow(Math.sin(phase * Math.PI * this._randomPeaks), 2);

        for (const bar of this.motionBarOrder) {
            if (Math.random() < density) this.drawBar(bar);
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    // Clip pixelCtx to all bar shapes in the array and draw nextImg through them in one pass.
    // Used by all imgMask animation paths for guaranteed-visible rendering.
    _clipDrawImgMask(bars) {
        if (!bars || bars.length === 0) return;
        const n = this.images.length;
        const nextImg = this.images[(this.currentImageIndex + 1) % n].img;
        this.pixelCtx.save();
        this.pixelCtx.beginPath();
        for (const bar of bars) this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
        this.pixelCtx.clip();
        this.drawImageToContext(this.pixelCtx, nextImg);
        this.pixelCtx.restore();
    }

    drawBar(bar) {
        this.pixelCtx.fillStyle = this.backgroundColor;
        this.pixelCtx.fillRect(bar.x, bar.y, bar.width, bar.height);
    }

    runMotion8Animation() {
        const elapsedTime = this.getElapsedTime();
        const cycleDuration = this.baseCycleDuration / this.animationSpeed;
        const currentCycle = Math.floor(elapsedTime / cycleDuration);
        if (this.checkCycleAdvance(currentCycle)) return;

        const rawProgress = (elapsedTime % cycleDuration) / cycleDuration;
        const totalBars = this.motionBarOrder.length;
        const waveWidth = 0.15;

        this.clearCanvasBackground();

        if (this.imgMaskActive()) {
            // IMG MASK: next image sweeps in as pixelated bars, then bars go clear (reveal photo)
            // Phase 1 (0→0.5): bars appear bar-by-bar (pixelated)
            // Phase 2 (0.5→1): each bar transitions from pixelated → clear next image photo
            const appearProgress = Math.min(1.0, rawProgress * 2);
            const revealProgress = rawProgress > 0.5 ? (rawProgress - 0.5) * 2 : 0;
            const nextImg = this.images[(this.currentImageIndex + 1) % this.images.length].img;

            for (let i = 0; i < totalBars; i++) {
                const bar = this.motionBarOrder[i];
                const barPos = i / totalBars;

                // Bar appears as appear wave sweeps past it
                const tAppear = (appearProgress - barPos) / waveWidth;
                const barAlpha = Math.max(0, Math.min(1, tAppear));
                if (barAlpha <= 0) continue;

                // In Phase 2: bar fades from pixelated to clear photo
                const tReveal = (revealProgress - barPos) / waveWidth;
                const clearAlpha = rawProgress > 0.5 ? Math.max(0, Math.min(1, tReveal)) : 0;

                // Pixelated portion → draw next image clipped to bar (guaranteed visible)
                const pixAlpha = barAlpha * (1 - clearAlpha);
                if (pixAlpha > 0) {
                    this.pixelCtx.save();
                    this.pixelCtx.globalAlpha = pixAlpha;
                    this.pixelCtx.beginPath();
                    this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
                    this.pixelCtx.clip();
                    this.drawImageToContext(this.pixelCtx, nextImg);
                    this.pixelCtx.restore();
                }

                // Clear photo portion (next image clipped to bar)
                if (clearAlpha > 0) {
                    this.pixelCtx.save();
                    this.pixelCtx.beginPath();
                    this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
                    this.pixelCtx.clip();
                    this.pixelCtx.globalAlpha = barAlpha * clearAlpha;
                    this.drawImageToContext(this.pixelCtx, nextImg);
                    this.pixelCtx.restore();
                }
            }
            this.pixelCtx.globalAlpha = 1.0;
            this.updateDisplay();
            this.motionAnimationFrame++;
            this.scheduleNextFrame();
            return;
        } else {
            // Phase 1 (0→0.5): pixelated → clear bar by bar
            // Phase 2 (0.5→1): clear → pixelated bar by bar (over new background image)
            const revealing = rawProgress <= 0.5;
            const phaseProgress = revealing ? rawProgress * 2 : (rawProgress - 0.5) * 2;

            for (let i = 0; i < totalBars; i++) {
                const bar = this.motionBarOrder[i];
                const barPos = i / totalBars;
                const t = (phaseProgress - barPos) / waveWidth;
                const clearAlpha = revealing
                    ? Math.max(0, Math.min(1, t))
                    : Math.max(0, Math.min(1, 1 - t));

                this.pixelCtx.fillStyle = this.backgroundColor;
                this.pixelCtx.fillRect(bar.x, bar.y, bar.width, bar.height);

                // Overlay clear image clipped to bar at clearAlpha
                if (clearAlpha > 0 && this.originalImage) {
                    this.pixelCtx.save();
                    this.pixelCtx.beginPath();
                    this.pixelCtx.rect(bar.x, bar.y, bar.width, bar.height);
                    this.pixelCtx.clip();
                    this.pixelCtx.globalAlpha = clearAlpha;
                    this.drawOriginalImageToContext(this.pixelCtx);
                    this.pixelCtx.globalAlpha = 1.0;
                    this.pixelCtx.restore();
                }
            }
        }

        this.updateDisplay();
        this.motionAnimationFrame++;
        this.scheduleNextFrame();
    }

    updateDisplay() {
        this.pixelCanvas.style.display = 'block';
        this.canvas.style.display = 'block';

        // During offline rendering: composite pixelCanvas → videoCtx so the offline loop
        // can read it with getImageData and encode it. No encoding happens here.
        if (this.offlineRenderTime !== null && this.videoCanvas) {
            this._videoFrameUpdated = true; // tells the offline loop this frame was rendered

            this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
            this.videoCtx.drawImage(this.pixelCanvas, 0, 0);
            // Encoding is done by _runOfflineRender after this call returns.
        }
    }

    scheduleNextFrame() {
        if (this.offlineRenderTime !== null) return; // offline loop drives frames itself
        this.motionAnimationRequestId = requestAnimationFrame(() => this.runMotionAnimation());
    }

    clearCanvasBackground() {
        const { width, height } = this.canvas;
        this.pixelCtx.clearRect(0, 0, width, height);

        if (this.imageMaskEnabled && this.images.length >= 2) {
            if (this.motionAnimationRunning) {
                // Animation: background = current image being covered by incoming bars
                this.drawImageToContext(this.pixelCtx, this.images[this.currentImageIndex].img);
            } else {
                // Static display: background = next image (original IMG MASK behaviour)
                const n = this.images.length;
                this.drawImageToContext(this.pixelCtx, this.images[(this.currentImageIndex + 1) % n].img);
            }
        } else {
            this.pixelCtx.fillStyle = '#000000';
            this.pixelCtx.fillRect(0, 0, width, height);
            if (this.originalImage) this.drawOriginalImageToContext(this.pixelCtx);
        }
    }

    checkCycleAdvance(currentCycle) {
        if (this.images.length > 1 && currentCycle > this.lastCycleNumber) {
            this.lastCycleNumber = currentCycle;
            if (currentCycle > 0) {
                this.advanceToNextImage();
                return true;
            }
        }
        return false;
    }

    sortBarsBy(direction) {
        this.motionBarOrder.sort((a, b) => {
            switch (direction) {
                case 0: return a.x - b.x;
                case 1: return b.x - a.x;
                case 2: return a.y - b.y;
                case 3: return b.y - a.y;
                default: return 0;
            }
        });
    }

    updateToggleBtn(enabled, btnId, desktopLabel, cardId = null) {
        const btn = document.getElementById(btnId);
        const isMobile = window.innerWidth <= 768;
        btn.textContent = isMobile ? (enabled ? 'ON' : 'OFF') : `${desktopLabel}: ${enabled ? 'ON' : 'OFF'}`;
        btn.classList.toggle('active', enabled);
        if (cardId) document.getElementById(cardId).style.display = enabled ? 'block' : 'none';
    }

    // --- Video Download Implementation ---
    downloadMotionVideo() {
        if (!this.originalImage) {
            alert('Please upload an image first');
            return;
        }
        if (this.isRecording) {
            this.stopVideoRecording(); // stop live preview → trigger offline render + download
        } else {
            this.startVideoRecording(); // start live preview (no encoding yet)
        }
    }

    async waitForHME() {
        if (window._hmeFailed) return false;
        if (typeof HME !== 'undefined') return true;
        return new Promise((resolve) => {
            const interval = setInterval(() => {
                if (window._hmeFailed) { clearInterval(interval); resolve(false); }
                if (window._hmeLoaded || typeof HME !== 'undefined') {
                    clearInterval(interval);
                    resolve(typeof HME !== 'undefined');
                }
            }, 150);
            setTimeout(() => { clearInterval(interval); resolve(false); }, 15000);
        });
    }

    // Phase 1: Start live animation preview — NO encoding happens here,
    // so the preview runs at full speed with zero recording overhead.
    startVideoRecording() {
        if (this.isRecording) return;

        this.isRecording        = true;
        this.recordingStartTime = performance.now();

        const btn = document.getElementById('videoDownloadBtn');
        btn.classList.add('recording');

        // Start normal live animation
        this.startMotionAnimation();

        // Save the seeds set by startMotionAnimation so the offline render can
        // reproduce the same visual sequence the user watched.
        this._recordedRandomStartPhase = this._randomStartPhase;
        this._recordedRandomPeaks      = this._randomPeaks;
        this._recordedStartImageIndex  = this.currentImageIndex;
    }

    // Phase 2 (triggered when user presses the button again):
    // Stop the live preview, then encode the exact same duration offline.
    // The offline render uses synthetic time so video speed = preview speed.
    async stopVideoRecording() {
        if (!this.isRecording) return;

        const duration    = performance.now() - this.recordingStartTime;
        this.isRecording  = false;

        const btn = document.getElementById('videoDownloadBtn');
        btn.classList.remove('recording');

        // Stop live animation — this also calls processImage() to show a still frame
        this.stopMotionAnimation();

        if (duration < 300) return; // too short to encode

        btn.disabled  = true;
        btn.textContent = 'RENDERING…';

        try {
            const ready = await this.waitForHME();
            if (!ready) {
                alert('MP4 encoder failed to load. Please check your internet connection and refresh the page.');
                return;
            }

            const fps         = 30;
            const finalWidth  = this.pixelCanvas.width  % 2 === 0 ? this.pixelCanvas.width  : this.pixelCanvas.width  - 1;
            const finalHeight = this.pixelCanvas.height % 2 === 0 ? this.pixelCanvas.height : this.pixelCanvas.height - 1;

            this.videoCanvas        = document.createElement('canvas');
            this.videoCanvas.width  = finalWidth;
            this.videoCanvas.height = finalHeight;
            this.videoCtx           = this.videoCanvas.getContext('2d');

            this.h264Encoder = await HME.createH264MP4Encoder();
            this.h264Encoder.width                 = finalWidth;
            this.h264Encoder.height                = finalHeight;
            this.h264Encoder.frameRate             = fps;
            this.h264Encoder.quantizationParameter = 15;
            this.h264Encoder.initialize();

            this.videoFrameCount = 0;

            // Render exactly as many frames as the user watched
            const totalFrames = Math.ceil(duration * fps / 1000);
            await this._runOfflineRender(fps, totalFrames);
            await this._finalizeVideo();

        } catch (error) {
            console.error('Error in video processing:', error);
            alert('Failed to create video: ' + error.message);
        } finally {
            this.resetVideoState();
        }
    }

    // Offline frame-by-frame rendering loop.
    // Sets synthetic animation time (offlineRenderTime) for each frame so the
    // encoder receives exactly `fps` frames per real animation second — speed matches preview.
    async _runOfflineRender(fps, totalFrames) {
        const frameDuration = 1000 / fps;

        // Restore the state from the start of the user's recording session
        this.currentImageIndex = this._recordedStartImageIndex;
        this.originalImage     = this.images[this.currentImageIndex].img;
        this.setupCanvas(this.originalImage);

        // Initialise animation state (mirrors startMotionAnimation, but uses synthetic time)
        this.motionAnimationRunning = true;
        this.prepareMotionBarOrder();
        this.motionAnimationFrame = 0;
        this.animationStartTime   = 0; // unused — getElapsedTime() reads offlineRenderTime
        this._impulseCycle        = -1;
        this._glitchCycle         = -1;
        this.lastWaveCycle        = -1;
        this.lastCycleNumber      = -1;
        // Restore same random seeds the user saw during live preview
        this._randomStartPhase    = this._recordedRandomStartPhase;
        this._randomPeaks         = this._recordedRandomPeaks;
        this.clearCanvasBackground();

        this.offlineTimeBase   = 0;
        this.offlineRenderTime = 0;

        for (let f = 0; f < totalFrames; f++) {
            this.offlineRenderTime  = f * frameDuration;
            this._videoFrameUpdated = false;

            // Render one frame (draws to pixelCtx, updateDisplay copies to videoCtx)
            this.runMotionAnimation();

            // If checkCycleAdvance triggered an early return, updateDisplay was skipped —
            // manually copy the freshly-cleared background to videoCtx for that frame.
            if (!this._videoFrameUpdated && this.videoCanvas) {
                this.videoCtx.clearRect(0, 0, this.videoCanvas.width, this.videoCanvas.height);
                this.videoCtx.drawImage(this.pixelCanvas, 0, 0);
            }

            // Encode frame
            if (this.h264Encoder && this.videoCanvas) {
                const imgData = this.videoCtx.getImageData(0, 0, this.videoCanvas.width, this.videoCanvas.height);
                this.h264Encoder.addFrameRgba(imgData.data);
                this.videoFrameCount++;
            }

            // Yield to the UI thread every 15 frames to keep the page responsive
            if (f % 15 === 0) await new Promise(r => setTimeout(r, 0));
        }

        this.offlineRenderTime      = null;
        this.motionAnimationRunning = false;

        // Restore still-image display (same image the user was on before recording)
        this.currentImageIndex = this._recordedStartImageIndex;
        this.originalImage     = this.images[this.currentImageIndex].img;
        this.processImage();
    }

    async _finalizeVideo() {
        const btn = document.getElementById('videoDownloadBtn');
        btn.textContent = 'SAVING…';
        try {
            if (this.videoFrameCount === 0) throw new Error('No frames were captured.');

            this.h264Encoder.finalize();
            const uint8    = this.h264Encoder.FS.readFile(this.h264Encoder.outputFilename);
            const blob     = new Blob([uint8], { type: 'video/mp4' });
            const filename = `strata-animation-${Date.now()}.mp4`;
            const url      = URL.createObjectURL(blob);
            const a        = document.createElement('a');
            a.href = url; a.download = filename; a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            alert(`Video saved!\n\nFile: ${filename}\nSize: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (error) {
            console.error('Error saving MP4:', error);
            alert('Failed to save video: ' + error.message);
        }
    }

    resetVideoState() {
        this.isRecording          = false;
        this.isProcessingDownload = false;
        this.videoFrameCount      = 0;
        this.offlineRenderTime    = null;
        this.offlineTimeBase      = 0;

        if (this.motionAnimationRunning) {
            this.motionAnimationRunning = false;
            if (this.motionAnimationRequestId) {
                cancelAnimationFrame(this.motionAnimationRequestId);
                this.motionAnimationRequestId = null;
            }
        }

        if (this.h264Encoder) {
            try { this.h264Encoder.delete(); } catch (e) {}
            this.h264Encoder = null;
        }

        if (this.videoCanvas) {
            this.videoCanvas = null;
            this.videoCtx    = null;
        }

        const btn = document.getElementById('videoDownloadBtn');
        btn.classList.remove('recording');
        btn.disabled    = false;
        btn.textContent = 'VIDEO ↓';
    }

    isValidImageFile(file) {
        try {
            const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
            return file && validTypes.includes(file.type);
        } catch (err) {
            console.warn('Error validating file:', err);
            return false;
        }
    }

    saveCurrentSettings() {
        const currentSettings = {
            pixelSize: parseInt(document.getElementById('sizeSlider').value),
            threshold: parseInt(document.getElementById('thresholdSlider').value),
            stretch: parseInt(document.getElementById('stretchSlider').value),
            sensitivity: parseInt(document.getElementById('sensitivitySlider').value),
            motionType: document.getElementById('motionTypeSelect').value,
            speed: parseFloat(document.getElementById('speedSlider').value),
            aspectRatio: document.getElementById('aspectRatioSelect').value,
            primaryColor: document.getElementById('hexColorInput').value
        };
        
        localStorage.setItem('pixelToolSettings', JSON.stringify(currentSettings));
    }

    loadSavedSettings() {
        const savedSettings = localStorage.getItem('pixelToolSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                
                // Update UI elements with saved values
                document.getElementById('sizeSlider').value = settings.pixelSize || this.defaultSettings.pixelSize;
                document.getElementById('thresholdSlider').value = settings.threshold || this.defaultSettings.threshold;
                document.getElementById('stretchSlider').value = settings.stretch || this.defaultSettings.stretch;
                document.getElementById('sensitivitySlider').value = settings.sensitivity || this.defaultSettings.sensitivity;
                document.getElementById('motionTypeSelect').value = settings.motionType || this.defaultSettings.motionType;
                document.getElementById('speedSlider').value = settings.speed || this.defaultSettings.speed;
                document.getElementById('aspectRatioSelect').value = settings.aspectRatio || this.defaultSettings.aspectRatio;
                document.getElementById('hexColorInput').value = settings.primaryColor || this.defaultSettings.primaryColor;
                
                // Sync JS state from saved values
                this.motionType = settings.motionType || this.defaultSettings.motionType;
                this.animationSpeed = parseFloat(settings.speed) || this.defaultSettings.speed;

                // Apply aspect ratio
                this.setAspectRatio(settings.aspectRatio || this.defaultSettings.aspectRatio);

                // Update background color and visual elements
                this.updateBackgroundColor(settings.primaryColor || this.defaultSettings.primaryColor);
                
            } catch (e) {
                console.error('Error loading saved settings:', e);
            }
        }
    }

    resetSettings() {
        this.removeFront = false;
        this.imageMaskEnabled = false;
        
        document.getElementById('backgroundRemovalBtn').textContent = 'REMOVE BACK';
        
        
        // Update image mask UI
        const imageMaskBtn = document.getElementById('imageMaskBtn');
        if (imageMaskBtn) {
            imageMaskBtn.textContent = 'IMG MASK: OFF';
            imageMaskBtn.classList.remove('active');
        }
        
        // Update UI elements with default values
        document.getElementById('sizeSlider').value = this.defaultSettings.pixelSize;
        document.getElementById('thresholdSlider').value = this.defaultSettings.threshold;
        document.getElementById('stretchSlider').value = this.defaultSettings.stretch;
        document.getElementById('sensitivitySlider').value = this.defaultSettings.sensitivity;
        document.getElementById('motionTypeSelect').value = this.defaultSettings.motionType;
        document.getElementById('speedSlider').value = this.defaultSettings.speed;
        document.getElementById('aspectRatioSelect').value = this.defaultSettings.aspectRatio;
        document.getElementById('hexColorInput').value = this.defaultSettings.primaryColor;
        
        // Sync JS state back to defaults
        this.motionType = this.defaultSettings.motionType;
        this.animationSpeed = this.defaultSettings.speed;

        // Reset aspect ratio to original
        this.setAspectRatio(this.defaultSettings.aspectRatio);

        // Update background color and visual elements
        this.updateBackgroundColor(this.defaultSettings.primaryColor);
        
        // Remove saved settings from localStorage
        localStorage.removeItem('pixelToolSettings');
        
        // Re-process image if one is loaded
        if (this.originalImage) {
            this.processImage();
        }
    }

    setupCanvas(img) {
        // Use higher resolution to preserve image quality
        const maxWidth = 2000;  // Increased for high quality output
        const maxHeight = 2000; // Increased for high quality output
        let { width, height } = img;

        // Apply aspect ratio settings
        if (this.aspectRatio === '16:9') {
            // 16:9 aspect ratio (1920x1080) for presentations
            width = 1920;
            height = 1080;
        } else if (this.aspectRatio === '9:16') {
            // 9:16 aspect ratio (1080x1920)
            width = 1080;
            height = 1920;
        } else if (this.aspectRatio === '4:5') {
            // 4:5 aspect ratio (1080x1350)
            width = 1080;
            height = 1350;
        } else {
            // Original aspect ratio - use actual image dimensions without stretching
            width = img.width;
            height = img.height;
            
            // Only scale down if image is extremely large to prevent performance issues
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.floor(width * ratio);
                height = Math.floor(height * ratio);
            }
        }

        // Set both canvases to the calculated size
        this.canvas.width = width;
        this.canvas.height = height;
        this.pixelCanvas.width = width;
        this.pixelCanvas.height = height;

        // Draw original image (properly handled for each aspect ratio)
        if (this.aspectRatio === 'original') {
            // For original, maintain proportions by drawing at calculated dimensions
            this.ctx.drawImage(img, 0, 0, width, height);
        } else {
            // For fixed aspect ratios, crop the image to fill the canvas exactly
            const imgAspect = img.width / img.height;
            const canvasAspect = width / height;
            
            let sourceWidth, sourceHeight, sourceX, sourceY;
            
            if (imgAspect > canvasAspect) {
                // Image is wider than target aspect ratio - crop sides
                sourceHeight = img.height;
                sourceWidth = img.height * canvasAspect;
                sourceX = (img.width - sourceWidth) / 2;
                sourceY = 0;
            } else {
                // Image is taller than target aspect ratio - crop top/bottom
                sourceWidth = img.width;
                sourceHeight = img.width / canvasAspect;
                sourceX = 0;
                sourceY = (img.height - sourceHeight) / 2;
            }
            
            // Clear canvas first
            this.ctx.clearRect(0, 0, width, height);
            
            // Draw the cropped portion of the image to fill the entire canvas
            // This maintains the original image proportions while cropping to fit
            this.ctx.drawImage(
                img, 
                sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (cropped area)
                0, 0, width, height  // Destination rectangle (entire canvas)
            );
        }
        
    }

    // Helper method to draw original image with proper aspect ratio handling
    drawOriginalImageToContext(ctx, targetWidth = null, targetHeight = null) {
        if (!this.originalImage) return;
        
        // Default to canvas size if not specified
        if (targetWidth === null) targetWidth = ctx.canvas.width;
        if (targetHeight === null) targetHeight = ctx.canvas.height;
        
        if (this.aspectRatio === 'original') {
            // For original, draw at actual size or scaled proportionally
            const scaleX = targetWidth / this.originalImage.width;
            const scaleY = targetHeight / this.originalImage.height;
            const scale = Math.min(scaleX, scaleY);
            
            const drawWidth = this.originalImage.width * scale;
            const drawHeight = this.originalImage.height * scale;
            const drawX = (targetWidth - drawWidth) / 2;
            const drawY = (targetHeight - drawHeight) / 2;
            
            ctx.drawImage(this.originalImage, drawX, drawY, drawWidth, drawHeight);
        } else {
            // For fixed aspect ratios, crop the image to fill completely
            const imgAspect = this.originalImage.width / this.originalImage.height;
            const targetAspect = targetWidth / targetHeight;
            
            let sourceWidth, sourceHeight, sourceX, sourceY;
            
            if (imgAspect > targetAspect) {
                // Image is wider than target aspect ratio - crop sides
                sourceHeight = this.originalImage.height;
                sourceWidth = this.originalImage.height * targetAspect;
                sourceX = (this.originalImage.width - sourceWidth) / 2;
                sourceY = 0;
            } else {
                // Image is taller than target aspect ratio - crop top/bottom
                sourceWidth = this.originalImage.width;
                sourceHeight = this.originalImage.width / targetAspect;
                sourceX = 0;
                sourceY = (this.originalImage.height - sourceHeight) / 2;
            }
            
            // Draw the cropped portion to fill the entire target area
            ctx.drawImage(
                this.originalImage, 
                sourceX, sourceY, sourceWidth, sourceHeight,  // Source rectangle (cropped area)
                0, 0, targetWidth, targetHeight  // Destination rectangle (entire target)
            );
        }
    }

    toggleRemoveSide() {
        this.removeFront = !this.removeFront;
        document.getElementById('backgroundRemovalBtn').textContent = this.removeFront ? 'REMOVE FRONT' : 'REMOVE BACK';
        if (this.originalImage) this.processImage();
    }

    updateBackgroundColor(hexValue) {
        const hex = hexValue.startsWith('#') ? hexValue : '#' + hexValue;
        if (!/^#[0-9A-F]{6}$/i.test(hex)) return;
        this.backgroundColor = hex;
        document.getElementById('hexColorInput').value = hex;
        document.getElementById('colorPreview').style.backgroundColor = hex;
        if (this.originalImage) this.processImage();
    }

    toggleColorWheel() {
        const popup = document.getElementById('colorWheelPopup');
        if (popup.style.display === 'block') {
            this.closeColorWheel();
        } else {
            this.openColorWheel();
        }
    }

    openColorWheel() {
        const popup = document.getElementById('colorWheelPopup');
        const colorPreview = document.getElementById('colorPreview');
        
        // Position the color wheel next to the color preview field
        const rect = colorPreview.getBoundingClientRect();
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        // Position to the right of the color preview, or left if not enough space
        const spaceOnRight = window.innerWidth - (rect.right + 250); // 250 is wheel width
        let left, top;
        
        if (spaceOnRight > 20) {
            // Position to the right
            left = rect.right + scrollLeft + 10;
        } else {
            // Position to the left
            left = rect.left + scrollLeft - 260;
        }
        
        top = rect.top + scrollTop;
        
        // Ensure it doesn't go off screen vertically
        if (top + 300 > window.innerHeight + scrollTop) {
            top = window.innerHeight + scrollTop - 320;
        }
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        popup.style.display = 'block';
        
        this.initializeColorWheel();
    }

    closeColorWheel() {
        const popup = document.getElementById('colorWheelPopup');
        popup.style.display = 'none';
        
        // Clean up global event handlers
        if (this.colorWheelHandlers) {
            document.removeEventListener('mousemove', this.colorWheelHandlers.handleMouseMove);
            document.removeEventListener('mouseup', this.colorWheelHandlers.handleMouseUp);
            this.colorWheelHandlers = null;
        }
        
        // Reset cursor position
        this.currentCursorPos = null;
    }

    initializeColorWheel() {
        const canvas = document.getElementById('colorWheelCanvas');
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        // Store wheel properties for cursor drawing
        this.wheelCenter = { x: centerX, y: centerY };
        this.wheelRadius = radius;
        this.currentCursorPos = null;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw color wheel
        for (let angle = 0; angle < 360; angle += 1) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = angle * Math.PI / 180;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, radius * 0.3, endAngle, startAngle, true);
            ctx.closePath();
            
            const hue = angle;
            const saturation = 100;
            const lightness = 50;
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.fill();
        }

        // Draw black and white sections in the center
        this.drawBlackWhiteCenter(ctx, centerX, centerY, radius * 0.3);

        // Add click and drag handlers for color selection
        canvas.onclick = (e) => this.selectColorFromWheel(e);
        
        // Add drag functionality for live color updates with global mouse tracking
        let isDragging = false;
        
        canvas.onmousedown = (e) => {
            isDragging = true;
            this.selectColorFromWheel(e);
            e.preventDefault();
        };
        
        // Use global mouse events for better dragging experience
        const handleMouseMove = (e) => {
            if (isDragging) {
                this.selectColorFromWheel(e, true); // Pass true for global tracking
            }
        };
        
        const handleMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                // Clear cursor when stopping drag
                this.currentCursorPos = null;
                this.redrawColorWheel();
            }
        };
        
        // Attach global mouse events
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Store event handlers for cleanup
        this.colorWheelHandlers = { handleMouseMove, handleMouseUp };
        
        // Add brightness slider handler for live updates
        const brightnessSlider = document.getElementById('brightnessSlider');
        brightnessSlider.oninput = () => {
            // If we have a current color selection, update it with new brightness
            if (this.lastSelectedHue !== undefined && this.lastSelectedSaturation !== undefined) {
                const brightness = brightnessSlider.value;
                const hsl = { h: this.lastSelectedHue, s: this.lastSelectedSaturation, l: brightness / 2 };
                const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
                const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
                this.updateBackgroundColor(hex);
            }
        };
    }

    drawBlackWhiteCenter(ctx, centerX, centerY, innerRadius) {
        // Draw black semicircle (left half)
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, Math.PI / 2, 3 * Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = '#000000';
        ctx.fill();
        
        // Draw white semicircle (right half)
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        
        // Add a thin border around the center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    redrawColorWheel() {
        const canvas = document.getElementById('colorWheelCanvas');
        const ctx = canvas.getContext('2d');
        const centerX = this.wheelCenter.x;
        const centerY = this.wheelCenter.y;
        const radius = this.wheelRadius;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw color wheel
        for (let angle = 0; angle < 360; angle += 1) {
            const startAngle = (angle - 1) * Math.PI / 180;
            const endAngle = angle * Math.PI / 180;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.arc(centerX, centerY, radius * 0.3, endAngle, startAngle, true);
            ctx.closePath();
            
            const hue = angle;
            const saturation = 100;
            const lightness = 50;
            ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            ctx.fill();
        }

        // Draw black and white sections in the center
        this.drawBlackWhiteCenter(ctx, centerX, centerY, radius * 0.3);

        // Draw cursor circle if position is set
        if (this.currentCursorPos) {
            ctx.beginPath();
            ctx.arc(this.currentCursorPos.x, this.currentCursorPos.y, 6, 0, 2 * Math.PI);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Add black outline for better visibility
            ctx.beginPath();
            ctx.arc(this.currentCursorPos.x, this.currentCursorPos.y, 6, 0, 2 * Math.PI);
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }

    selectColorFromWheel(e, isGlobalEvent = false) {
        const canvas = document.getElementById('colorWheelCanvas');
        const rect = canvas.getBoundingClientRect();
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = this.wheelCenter.x;
        const centerY = this.wheelCenter.y;
        
        // Calculate distance from center
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = this.wheelRadius;
        
        // Check if click is in the black/white center area
        if (distance <= radius * 0.3) {
            // Determine if click is on black (left) or white (right) side
            const isLeftSide = dx < 0;
            const selectedColor = isLeftSide ? '#000000' : '#FFFFFF';
            
            // Update cursor position to center of selected half
            const offsetX = isLeftSide ? -radius * 0.15 : radius * 0.15;
            this.currentCursorPos = { x: centerX + offsetX, y: centerY };
            
            // Update color
            this.updateBackgroundColor(selectedColor);
            this.redrawColorWheel();
            return;
        }
        
        // For global events, allow selection even outside wheel bounds (clamp to wheel edges)
        let finalX = x;
        let finalY = y;
        let finalDistance = distance;
        
        if (isGlobalEvent || distance >= radius * 0.3) {
            // Clamp position to wheel bounds for color calculation
            if (distance > radius) {
                const ratio = radius / distance;
                finalX = centerX + dx * ratio;
                finalY = centerY + dy * ratio;
                finalDistance = radius;
            } else if (distance < radius * 0.3) {
                const ratio = (radius * 0.3) / distance;
                finalX = centerX + dx * ratio;
                finalY = centerY + dy * ratio;
                finalDistance = radius * 0.3;
            }
            
            // Calculate angle (hue) from final position
            const finalDx = finalX - centerX;
            const finalDy = finalY - centerY;
            let angle = Math.atan2(finalDy, finalDx) * 180 / Math.PI;
            if (angle < 0) angle += 360;
            
            // Calculate saturation based on distance from center
            const saturation = Math.min(100, ((finalDistance - radius * 0.3) / (radius * 0.7)) * 100);
            
            // Store current selection for brightness changes
            this.lastSelectedHue = angle;
            this.lastSelectedSaturation = saturation;
            
            // Update cursor position (use actual mouse position, not clamped position)
            this.currentCursorPos = { x: finalX, y: finalY };
            
            // Get brightness from slider
            const brightness = document.getElementById('brightnessSlider').value;
            
            // Convert HSL to RGB then to hex
            const hsl = { h: angle, s: saturation, l: brightness / 2 };
            const rgb = this.hslToRgb(hsl.h, hsl.s, hsl.l);
            const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
            
            // Update color input and preview (but keep wheel open for live updates)
            this.updateBackgroundColor(hex);
            
            // Redraw wheel with cursor
            this.redrawColorWheel();
        }
    }

    hslToRgb(h, s, l) {
        h /= 360;
        s /= 100;
        l /= 100;
        
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255)
        };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    toggleImageMask() {
        this.imageMaskEnabled = !this.imageMaskEnabled;
        this.updateToggleBtn(this.imageMaskEnabled, 'imageMaskBtn', 'IMG MASK');
        if (this.originalImage) this.processImage();
    }

    // True when IMG MASK is on and a second image is available
    imgMaskActive() {
        return this.imageMaskEnabled && this.images.length >= 2;
    }

    // Show/hide the IMG MASK button depending on image count
    updateImageMaskBtnVisibility() {
        const card = document.getElementById('imageMaskCard');
        if (card) card.style.display = this.images.length >= 2 ? 'block' : 'none';
        // Auto-disable if dropped back to 1 image
        if (this.images.length < 2 && this.imageMaskEnabled) {
            this.imageMaskEnabled = false;
            const btn = document.getElementById('imageMaskBtn');
            if (btn) {
                btn.textContent = 'IMG MASK: OFF';
                btn.classList.remove('active');
            }
            if (this.originalImage) this.processImage();
        }
    }

    // Draw any image to a context (respects current aspect ratio setting)
    drawImageToContext(ctx, image, targetWidth = null, targetHeight = null) {
        if (!image) return;
        if (targetWidth === null) targetWidth = ctx.canvas.width;
        if (targetHeight === null) targetHeight = ctx.canvas.height;

        if (this.aspectRatio === 'original') {
            const scaleX = targetWidth / image.width;
            const scaleY = targetHeight / image.height;
            const scale = Math.min(scaleX, scaleY);
            const drawWidth = image.width * scale;
            const drawHeight = image.height * scale;
            const drawX = (targetWidth - drawWidth) / 2;
            const drawY = (targetHeight - drawHeight) / 2;
            ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
        } else {
            const imgAspect = image.width / image.height;
            const targetAspect = targetWidth / targetHeight;
            let sourceWidth, sourceHeight, sourceX, sourceY;
            if (imgAspect > targetAspect) {
                sourceHeight = image.height;
                sourceWidth = image.height * targetAspect;
                sourceX = (image.width - sourceWidth) / 2;
                sourceY = 0;
            } else {
                sourceWidth = image.width;
                sourceHeight = image.width / targetAspect;
                sourceX = 0;
                sourceY = (image.height - sourceHeight) / 2;
            }
            ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
        }
    }

    processImage() {
        if (!this.originalImage) return;

        const size = parseInt(document.getElementById('sizeSlider').value);
        const threshold = parseInt(document.getElementById('thresholdSlider').value);
        const stretchFactor = parseInt(document.getElementById('stretchSlider').value);

        this.pixelateImage(size, threshold, stretchFactor);
    }

    debouncedProcessImage() {
        // Clear previous timeout
        if (this.processingTimeout) {
            clearTimeout(this.processingTimeout);
        }
        
        // Set new timeout for smoother performance - increased delay
        this.processingTimeout = setTimeout(() => {
            this.processImage();
        }, 200); // Increased to 200ms delay for better performance
    }

    // Foreground mask at reduced resolution: learn background colours from the top/left/right
    // border, flood-fill the connected background from the edges, drop tiny foreground specks.
    buildForegroundMask() {
        const { width, height } = this.canvas;
        const scale = Math.min(1, 256 / Math.max(width, height));
        const w = Math.max(1, Math.round(width * scale));
        const h = Math.max(1, Math.round(height * scale));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d', { willReadFrequently: true });
        cx.drawImage(this.canvas, 0, 0, w, h);
        const px = cx.getImageData(0, 0, w, h).data;
        const n = w * h;

        const lab = new Float32Array(n * 3);
        const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
        for (let i = 0; i < n; i++) {
            const r = lin(px[i * 4]), g = lin(px[i * 4 + 1]), b = lin(px[i * 4 + 2]);
            const fx = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
            const fy = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
            const fz = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
            lab[i * 3] = 116 * fy - 16;
            lab[i * 3 + 1] = 500 * (fx - fy);
            lab[i * 3 + 2] = 200 * (fy - fz);
        }

        // Bottom edge is left out of the model: subjects (busts, products) usually touch it.
        const ring = Math.max(1, Math.round(Math.min(w, h) * 0.03));
        const samples = [];
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (y < ring || x < ring || x >= w - ring) samples.push(y * w + x);
            }
        }

        const k = Math.min(8, samples.length);
        let centers = [];
        for (let j = 0; j < k; j++) {
            const i = samples[Math.floor((j + 0.5) * samples.length / k)];
            centers.push([lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]]);
        }
        let counts = new Array(k).fill(0);
        for (let iter = 0; iter < 8; iter++) {
            const sums = centers.map(() => [0, 0, 0]);
            counts = new Array(k).fill(0);
            for (const i of samples) {
                let best = 0, bestD = Infinity;
                for (let j = 0; j < k; j++) {
                    const d = (lab[i * 3] - centers[j][0]) ** 2 + (lab[i * 3 + 1] - centers[j][1]) ** 2 + (lab[i * 3 + 2] - centers[j][2]) ** 2;
                    if (d < bestD) { bestD = d; best = j; }
                }
                sums[best][0] += lab[i * 3]; sums[best][1] += lab[i * 3 + 1]; sums[best][2] += lab[i * 3 + 2];
                counts[best]++;
            }
            centers = centers.map((cen, j) => counts[j] ? sums[j].map(v => v / counts[j]) : cen);
        }
        const bgColors = centers.filter((_, j) => counts[j] >= samples.length * 0.03);

        const dist = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            let m = Infinity;
            for (const cen of bgColors) {
                const d = (lab[i * 3] - cen[0]) ** 2 + (lab[i * 3 + 1] - cen[1]) ** 2 + (lab[i * 3 + 2] - cen[2]) ** 2;
                if (d < m) m = d;
            }
            dist[i] = Math.sqrt(m);
        }

        // Edge strength: the background fill may not cross object outlines
        const grad = new Float32Array(n);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                const i = y * w + x;
                let g = 0;
                for (let ch = 0; ch < 3; ch++) {
                    const gx = lab[(i + 1) * 3 + ch] - lab[(i - 1) * 3 + ch];
                    const gy = lab[(i + w) * 3 + ch] - lab[(i - w) * 3 + ch];
                    g += gx * gx + gy * gy;
                }
                grad[i] = Math.sqrt(g);
            }
        }
        const sortedGrad = Float32Array.from(grad).sort();
        const edgeThreshold = Math.max(10, sortedGrad[Math.floor(n * 0.9)]);

        // Image-adaptive colour tolerance (Otsu on the distance-to-background histogram);
        // the slider only shifts it: 50 = automatic, higher removes more.
        const bins = 128, maxD = 100;
        const hist = new Float64Array(bins);
        for (let i = 0; i < n; i++) hist[Math.min(bins - 1, Math.floor(dist[i] / maxD * bins))]++;
        let sumAll = 0;
        for (let b = 0; b < bins; b++) sumAll += b * hist[b];
        let wB = 0, sumB = 0, bestVar = -1, bestBin = 0;
        for (let b = 0; b < bins; b++) {
            wB += hist[b];
            if (!wB || wB === n) continue;
            sumB += b * hist[b];
            const mB = sumB / wB, mF = (sumAll - sumB) / (n - wB);
            const between = wB * (n - wB) * (mB - mF) ** 2;
            if (between > bestVar) { bestVar = between; bestBin = b; }
        }
        const autoTol = Math.min(50, Math.max(5, (bestBin + 1) / bins * maxD));
        const sensitivity = parseInt(document.getElementById('sensitivitySlider').value);
        let tol = autoTol * Math.pow(2, (sensitivity - 50) / 50);

        const fillBackground = (tolerance) => {
            const bgMask = new Uint8Array(n);
            const stack = [];
            for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
            for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
            while (stack.length) {
                const i = stack.pop();
                if (bgMask[i] || dist[i] >= tolerance) continue;
                if (grad[i] >= edgeThreshold && dist[i] >= tolerance * 0.35) continue;
                bgMask[i] = 1;
                const x = i % w, y = (i - x) / w;
                if (x > 0) stack.push(i - 1);
                if (x < w - 1) stack.push(i + 1);
                if (y > 0) stack.push(i - w);
                if (y < h - 1) stack.push(i + w);
            }
            return bgMask;
        };

        // Morphological opening on the foreground: cuts thin bridges to neighbouring background clutter
        const morph = (src, r, erode) => {
            const tmp = new Uint8Array(n), out = new Uint8Array(n);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let v = erode ? 1 : 0;
                    for (let d = -r; d <= r; d++) {
                        const xx = Math.min(w - 1, Math.max(0, x + d));
                        v = erode ? Math.min(v, src[y * w + xx]) : Math.max(v, src[y * w + xx]);
                    }
                    tmp[y * w + x] = v;
                }
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let v = erode ? 1 : 0;
                    for (let d = -r; d <= r; d++) {
                        const yy = Math.min(h - 1, Math.max(0, y + d));
                        v = erode ? Math.min(v, tmp[yy * w + x]) : Math.max(v, tmp[yy * w + x]);
                    }
                    out[y * w + x] = v;
                }
            }
            return out;
        };
        const segment = (tolerance) => {
            const r = Math.max(1, Math.round(Math.min(w, h) / 100));
            let fgMask = new Uint8Array(n);
            const filled = fillBackground(tolerance);
            for (let i = 0; i < n; i++) fgMask[i] = filled[i] ? 0 : 1;
            fgMask = morph(morph(fgMask, r, true), r, false);

            // Keep only the main subject parts: drop components much smaller than the largest one
            const comps = [];
            const seen = new Uint8Array(n);
            for (let s0 = 0; s0 < n; s0++) {
                if (!fgMask[s0] || seen[s0]) continue;
                const comp = [s0];
                seen[s0] = 1;
                for (let q = 0; q < comp.length; q++) {
                    const i = comp[q], x = i % w, y = (i - x) / w;
                    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
                    for (const j of nb) {
                        if (j >= 0 && fgMask[j] && !seen[j]) { seen[j] = 1; comp.push(j); }
                    }
                }
                comps.push(comp);
            }
            const largest = comps.reduce((m, c) => Math.max(m, c.length), 0);
            const minArea = Math.max(n * 0.004, largest * 0.15);
            const bgMask = new Uint8Array(n).fill(1);
            let kept = 0;
            for (const comp of comps) {
                if (comp.length < minArea) continue;
                for (const i of comp) bgMask[i] = 0;
                kept += comp.length;
            }
            return { bgMask, fgFrac: kept / n };
        };

        // Nudge the tolerance when the result is implausible (almost no subject / almost no background)
        let { bgMask: bg, fgFrac } = segment(tol);
        for (let attempt = 0; attempt < 4 && (fgFrac < 0.04 || fgFrac > 0.92); attempt++) {
            tol *= fgFrac < 0.04 ? 0.6 : 1.6;
            ({ bgMask: bg, fgFrac } = segment(tol));
        }

        // Summed-area table of foreground pixels for fast per-bar coverage
        const sat = new Float64Array((w + 1) * (h + 1));
        for (let y = 0; y < h; y++) {
            let row = 0;
            for (let x = 0; x < w; x++) {
                row += bg[y * w + x] ? 0 : 1;
                sat[(y + 1) * (w + 1) + x + 1] = sat[y * (w + 1) + x + 1] + row;
            }
        }
        return { sat, w, h, scale };
    }

    // True when a bar should carry a stroke: foreground bars in REMOVE BACK, background bars in REMOVE FRONT
    barIsTarget(fg, x, y, bw, bh) {
        const { sat, w, h, scale } = fg;
        const x0 = Math.min(w - 1, Math.floor(x * scale)), y0 = Math.min(h - 1, Math.floor(y * scale));
        const x1 = Math.max(x0 + 1, Math.min(w, Math.round((x + bw) * scale)));
        const y1 = Math.max(y0 + 1, Math.min(h, Math.round((y + bh) * scale)));
        const W = w + 1;
        const fgCount = sat[y1 * W + x1] - sat[y0 * W + x1] - sat[y1 * W + x0] + sat[y0 * W + x0];
        const isForeground = fgCount / ((x1 - x0) * (y1 - y0)) >= 0.5;
        return this.removeFront ? !isForeground : isForeground;
    }

    // Bars that carry a stroke: on the chosen side (front/back), minus the darkest share set by THRESHOLD.
    // The share is relative to this image's own brightness spread, so every photo breaks up similarly.
    selectStrokeBars(cols, rows, threshold) {
        const { width, height } = this.canvas;
        const data = this.ctx.getImageData(0, 0, width, height).data;
        const fg = this.buildForegroundMask();
        const candidates = [];
        for (let col = 0; col < cols; col++) {
            const x = Math.round(col * width / cols);
            const bw = Math.round((col + 1) * width / cols) - x;
            for (let row = 0; row < rows; row++) {
                const y = Math.round(row * height / rows);
                const bh = Math.round((row + 1) * height / rows) - y;
                if (!this.barIsTarget(fg, x, y, bw, bh)) continue;
                const sx = Math.min(x + Math.floor(bw / 2), width - 1);
                const sy = Math.min(y + Math.floor(bh / 2), height - 1);
                const i = (sy * width + sx) * 4;
                const r = data[i], g = data[i + 1], b = data[i + 2];
                candidates.push({ x, y, width: bw, height: bh, r, g, b, lum: 0.299 * r + 0.587 * g + 0.114 * b });
            }
        }
        const removeCount = Math.floor(candidates.length * Math.min(0.9, threshold / 100));
        // Score = half brightness rank, half stable per-bar noise → removal follows the image but stays scattered
        const byLum = candidates.map((_, i) => i).sort((a, b) => candidates[a].lum - candidates[b].lum);
        const score = new Float32Array(candidates.length);
        byLum.forEach((ci, rank) => {
            const c = candidates[ci];
            const noise = (Math.imul(Math.imul(c.x, 73856093) ^ Math.imul(c.y, 19349663), 2654435761) >>> 0) / 0xFFFFFFFF;
            score[ci] = 0.5 * rank / candidates.length + 0.5 * noise;
        });
        const lowest = candidates.map((_, i) => i).sort((a, b) => score[a] - score[b]);
        const removed = new Set(lowest.slice(0, removeCount));
        return candidates.filter((_, i) => !removed.has(i));
    }

    pixelateImage(pixelSize, threshold, stretchFactor) {
        const { width, height } = this.canvas;

        this.clearCanvasBackground();
        
        // NEW APPROACH: Create vertical bars by sampling horizontally and drawing tall rectangles
        const barWidth = pixelSize; // Width of each vertical bar
        const baseBarHeight = pixelSize * 3; // Base height (always taller than width)
        const extraHeight = Math.floor(stretchFactor * 2); // Additional height based on stretch factor
        const desiredBarHeight = baseBarHeight + extraHeight;

        // Calculate exact bar counts so bars tile perfectly to all edges
        const numBarsHorizontally = Math.max(1, Math.round(width / barWidth));
        const numBarsVertically = Math.max(1, Math.round(height / desiredBarHeight));

        this.pixelCtx.fillStyle = this.backgroundColor;
        for (const bar of this.selectStrokeBars(numBarsHorizontally, numBarsVertically, threshold)) {
            this.pixelCtx.fillRect(bar.x, bar.y, bar.width, bar.height);
        }

        this.pixelCanvas.style.display = 'block';
        this.canvas.style.display = 'block';
    }

    downloadPNG() {
        if (!this.originalImage) {
            alert('Please upload an image first');
            return;
        }

        // Use original image dimensions to preserve quality
        const finalWidth = this.pixelCanvas.width;
        const finalHeight = this.pixelCanvas.height;

        // Create a temporary canvas for the final composite image
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = finalWidth;
        tempCanvas.height = finalHeight;

        // Clear the temporary canvas
        tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

        // Draw the pixelated bars on top (using original size)
        tempCtx.drawImage(this.pixelCanvas, 0, 0);

        // Convert to blob and download with high quality
        tempCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixelated-image.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png'); // PNG format for lossless quality
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize the tool when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Strata();
});
