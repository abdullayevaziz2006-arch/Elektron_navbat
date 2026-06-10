document.addEventListener('DOMContentLoaded', () => {
  const directionsGrid = document.getElementById('directions-grid');
  const ticketModal = document.getElementById('ticket-modal');
  
  // Modal displays
  const receiptDirectionName = document.getElementById('receipt-direction-name');
  const receiptNumberDisplay = document.getElementById('receipt-number-display');
  const receiptRoomDisplay = document.getElementById('receipt-room-display');
  const receiptIdText = document.getElementById('receipt-id-text');
  const receiptDateTime = document.getElementById('receipt-date-time');

  // Print area elements
  const printDirection = document.getElementById('print-direction');
  const printNumber = document.getElementById('print-number');
  const printRoom = document.getElementById('print-room');
  const printTime = document.getElementById('print-time');

  let modalTimeout = null;
  let currentSettings = {};

  // Load dynamic branding settings
  async function loadBranding() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
      if (settings) {
        currentSettings = settings;
        // 1. Set brand color
        const brandColor = settings.brand_color || '#e60000';
        document.body.style.setProperty('--color-primary', brandColor);
        document.body.style.setProperty('--brand-color', brandColor);

        // 2. Set theme class
        document.body.className = '';
        let themeVal = settings.kiosk_theme || settings.theme || 'modern-dark';
        if (themeVal) {
          if (themeVal.startsWith('theme-')) {
            document.body.classList.add(themeVal);
          } else {
            if (themeVal === 'light-mode') {
              document.body.classList.add('theme-elegant-light');
            } else if (themeVal === 'minimalist-slate') {
              document.body.classList.add('theme-royal-gold');
            } else {
              document.body.classList.add('theme-glass-neon');
            }
          }
        } else {
          document.body.classList.add('theme-glass-neon');
        }

        // 3. Set custom background image
        if (settings.bg_img && settings.bg_img !== '') {
          document.body.style.setProperty('--custom-bg-img', `url('${settings.bg_img}')`);
          document.body.classList.add('has-custom-bg');
        } else {
          document.body.style.removeProperty('--custom-bg-img');
          document.body.classList.remove('has-custom-bg');
        }

        // 4. Set logo (custom image or text logo)
        const logoContainer = document.querySelector('.logo-container');
        if (logoContainer) {
          if (settings.logo_img && settings.logo_img !== '') {
            const isSvg = settings.logo_img.split('?')[0].toLowerCase().endsWith('.svg');
            if (isSvg) {
              try {
                const cacheBusterUrl = settings.logo_img + (settings.logo_img.includes('?') ? '&' : '?') + 't=' + Date.now();
                const svgResponse = await fetch(cacheBusterUrl);
                if (svgResponse.ok) {
                  const svgText = await svgResponse.text();
                  logoContainer.innerHTML = svgText;
                } else {
                  logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo">`;
                }
              } catch (e) {
                console.error('Failed to inline SVG logo:', e);
                logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo">`;
              }
            } else {
              logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo">`;
            }
          } else {
            const logoIconVal = settings.logo_main ? settings.logo_main.substring(0, 2).toUpperCase() : 'EN';
            const orgNameVal = settings.org_name || 'TOSHKENT DAVLAT UNIVERSITETI';
            const kioskTitleVal = settings.kiosk_title || 'Elektron Navbat Kioski';
            logoContainer.innerHTML = `
              <div class="logo-icon">${logoIconVal}</div>
              <div class="logo-text">
                <h1>${orgNameVal}</h1>
                <p>${kioskTitleVal}</p>
              </div>
            `;
          }
          logoContainer.insertAdjacentHTML('beforeend', `<div class="logo-drag-overlay">Logotip rasmi yuklash</div>`);
        }

        // 5. Receipt headers (screen modal and printing area)
        const receiptOrgName = document.getElementById('receipt-org-name');
        if (receiptOrgName) receiptOrgName.textContent = settings.org_name || 'TOSHKENT DAVLAT UNIVERSITETI';

        const receiptSystemTitle = document.getElementById('receipt-system-title');
        if (receiptSystemTitle) receiptSystemTitle.textContent = settings.kiosk_title || 'Elektron Navbat Tizimi';

        const printOrgName = document.getElementById('print-org-name');
        if (printOrgName) printOrgName.textContent = settings.org_name || 'TOSHKENT DAVLAT UNIVERSITETI';

        const printSystemTitle = document.getElementById('print-system-title');
        if (printSystemTitle) printSystemTitle.textContent = settings.kiosk_title || 'Elektron Navbat Tizimi';

        // 6. Inject style variables dynamically
        Object.keys(settings).forEach(key => {
          if (key.startsWith('css_')) {
            const varName = `--` + key.replace('css_', '').replace(/_/g, '-');
            document.body.style.setProperty(varName, settings[key]);
          }
        });

        // Scope kiosk-specific overrides
        if (settings.css_kiosk_bg_primary) document.body.style.setProperty('--bg-primary', settings.css_kiosk_bg_primary);
        if (settings.css_kiosk_bg_secondary) {
          document.body.style.setProperty('--bg-secondary', settings.css_kiosk_bg_secondary);
          document.body.style.setProperty('--bg-color-2', settings.css_kiosk_bg_secondary);
        }
        if (settings.css_kiosk_text_primary) document.body.style.setProperty('--text-primary', settings.css_kiosk_text_primary);
        if (settings.css_kiosk_text_secondary) document.body.style.setProperty('--text-secondary', settings.css_kiosk_text_secondary);

        // 7. Inject custom CSS
        let styleTag = document.getElementById('kiosk-custom-css-tag');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'kiosk-custom-css-tag';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = settings.custom_css || '';

        // 8. Set header logo position class
        const header = document.querySelector('header');
        if (header) {
          header.className = settings.logo_position || 'logo-left';
        }
      }
    } catch (err) {
      console.error('Error loading branding settings:', err);
    }
  }

  // Initialize WebSocket for real-time updates (e.g., if directions list is modified by admin)
  let socket;
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    socket = new WebSocket(`${protocol}//${host}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'QUEUE_CHANGED') {
          // Re-load directions list and branding if they changed
          loadDirections();
          loadBranding();
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 3000); // Reconnect
    };
  }

  // Load directions from API
  async function loadDirections() {
    try {
      const response = await fetch('/api/directions');
      if (!response.ok) throw new Error('Yo\'nalishlarni yuklab bo\'lmadi');
      const directions = await response.ok ? await response.json() : [];
      
      directionsGrid.innerHTML = '';
      if (directions.length === 0) {
        directionsGrid.innerHTML = `
          <div style="text-align: center; grid-column: 1/-1; padding: 3rem; color: var(--text-secondary);">
            Hozircha yo'nalishlar mavjud emas. Admin panelda yo'nalishlar qo'shing.
          </div>
        `;
        return;
      }

      directions.forEach(dir => {
        const button = document.createElement('div');
        button.className = 'direction-btn glass-panel';
        button.dataset.id = dir.id;
        button.innerHTML = `
          <div class="direction-name" style="font-size: 1.8rem; margin: 0.5rem 0; font-weight: 800; pointer-events: none;">${dir.name}</div>
        `;

        // Apply individual custom position & size
        const btnPos = currentSettings[`css_btn_pos_${dir.id}`] || 'relative';
        button.style.position = btnPos;
        if (btnPos === 'absolute') {
          button.style.top = currentSettings[`css_btn_top_${dir.id}`] || 'auto';
          button.style.left = currentSettings[`css_btn_left_${dir.id}`] || 'auto';
          button.style.margin = '0';
        }
        
        const btnWidth = currentSettings[`css_btn_width_${dir.id}`];
        if (btnWidth) button.style.width = btnWidth;
        
        const btnHeight = currentSettings[`css_btn_height_${dir.id}`];
        if (btnHeight) button.style.height = btnHeight;

        button.addEventListener('click', (e) => {
          if (document.body.classList.contains('edit-mode')) return;
          generateTicket(dir.id);
        });
        
        directionsGrid.appendChild(button);
        
        if (typeof makeButtonDraggableAndResizable === 'function') {
          makeButtonDraggableAndResizable(button, dir.id);
        }
      });

    } catch (err) {
      console.error(err);
      directionsGrid.innerHTML = `
        <div style="text-align: center; grid-column: 1/-1; padding: 3rem; color: var(--color-danger);">
          Xatolik yuz berdi: ${err.message}
        </div>
      `;
    }
  }

  // Play a beautiful synthesizer chord using Web Audio API
  function playSuccessChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      // Play a lovely major triad arpeggio (C5 -> E5 -> G5 -> C6)
      playTone(523.25, now, 0.4);       // C5
      playTone(659.25, now + 0.08, 0.4);  // E5
      playTone(783.99, now + 0.16, 0.4);  // G5
      playTone(1046.50, now + 0.24, 0.6); // C6
    } catch (e) {
      console.error('Audio synthesis failed:', e);
    }
  }

  // Create ticket via API
  async function generateTicket(directionId) {
    // Clear any active timeout
    if (modalTimeout) clearTimeout(modalTimeout);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction_id: directionId })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Bilet yaratib bo\'lmadi');
      }

      const ticket = await response.json();
      
      // Play sound
      playSuccessChime();

      // Format current Date/Time
      const now = new Date();
      const dateStr = now.toLocaleDateString('uz-UZ', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
      const timeStr = now.toLocaleTimeString('uz-UZ', {
        hour: '2-digit', minute: '2-digit'
      });
      const fullDateTimeStr = `${dateStr} ${timeStr}`;

      // Update Modal elements
      receiptDirectionName.textContent = ticket.direction_name.toUpperCase();
      receiptNumberDisplay.textContent = ticket.ticket_code;
      receiptRoomDisplay.textContent = `${ticket.room}-operator (Xona ${ticket.room})`;
      receiptIdText.textContent = `*T-${String(ticket.id).padStart(5, '0')}*`;
      receiptDateTime.textContent = fullDateTimeStr;

      // Update Print Area elements
      printDirection.textContent = ticket.direction_name.toUpperCase();
      printNumber.textContent = ticket.ticket_code;
      printRoom.textContent = `${ticket.room}-operator (Xona ${ticket.room})`;
      printTime.textContent = fullDateTimeStr;

      // Display Modal
      ticketModal.classList.add('active');

      // Printing has been disabled as requested

      // Auto close modal after 6 seconds
      modalTimeout = setTimeout(() => {
        ticketModal.classList.remove('active');
      }, 6000);

    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  }

  // Click outside to close modal
  ticketModal.addEventListener('click', (e) => {
    if (e.target === ticketModal) {
      ticketModal.classList.remove('active');
      if (modalTimeout) clearTimeout(modalTimeout);
    }
  });

  // === Hidden Settings Menu Features ===
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
  const settingsForm = document.getElementById('settings-form');
  const btnToggleEditMode = document.getElementById('btn-toggle-edit-mode');
  
  // Settings Form fields
  const settingsTheme = document.getElementById('settings-theme');
  const settingsLogoPosition = document.getElementById('settings-logo-position');
  const settingsBrandColor = document.getElementById('settings-brand-color');
  const settingsBrandColorHex = document.getElementById('settings-brand-color-hex');
  const settingsBgColor = document.getElementById('settings-bg-color');
  const settingsBgColorHex = document.getElementById('settings-bg-color-hex');
  const settingsTextColor = document.getElementById('settings-text-color');
  const settingsTextColorHex = document.getElementById('settings-text-color-hex');
  
  const settingsBtnPadding = document.getElementById('settings-btn-padding');
  const settingsBtnWidth = document.getElementById('settings-btn-width');
  const settingsLogoMain = document.getElementById('settings-logo-main');
  const settingsLogoImg = document.getElementById('settings-logo-img');
  const settingsLogoFile = document.getElementById('settings-logo-file');
  const settingsBgImg = document.getElementById('settings-bg-img');
  const settingsBgFile = document.getElementById('settings-bg-file');
  
  const valBtnPadding = document.getElementById('val-btn-padding');
  const valBtnWidth = document.getElementById('val-btn-width');

  // Drag and drop tracking coordinates
  let liveLayoutCoords = {};

  // Keyboard shortcuts (Ctrl+Alt+S or Alt+Shift+S or Ctrl+Shift+S)
  document.addEventListener('keydown', (e) => {
    const isCtrlAltS = e.ctrlKey && e.altKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's');
    const isAltShiftS = e.altKey && e.shiftKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's');
    const isCtrlShiftS = e.ctrlKey && e.shiftKey && (e.code === 'KeyS' || e.key.toLowerCase() === 's');
    
    if (isCtrlAltS || isAltShiftS || isCtrlShiftS) {
      e.preventDefault();
      openDesignerDock();
    }
  });

  // Logo 5-click detection trigger (essential for touch screens without keyboards)
  let logoClickCount = 0;
  let logoClickTimeout = null;
  const logoContainer = document.querySelector('.logo-container');
  
  if (logoContainer) {
    logoContainer.style.cursor = 'pointer';
    logoContainer.addEventListener('click', () => {
      logoClickCount++;
      if (logoClickTimeout) clearTimeout(logoClickTimeout);
      
      logoClickTimeout = setTimeout(() => {
        logoClickCount = 0;
      }, 3000);
      
      if (logoClickCount >= 5) {
        logoClickCount = 0;
        openDesignerDock();
      }
    });
  }

  // Drag-and-drop helper function
  function makeDraggable(element, varPrefix) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.addEventListener('mousedown', dragMouseDown);
    element.addEventListener('touchstart', dragMouseDown, { passive: false });

    function dragMouseDown(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      e.preventDefault();
      
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      pos3 = clientX;
      pos4 = clientY;
      
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('touchend', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('touchmove', elementDrag, { passive: false });
    }

    function elementDrag(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      e.preventDefault();
      
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      
      pos1 = pos3 - clientX;
      pos2 = pos4 - clientY;
      pos3 = clientX;
      pos4 = clientY;
      
      let newTop = element.offsetTop - pos2;
      let newLeft = element.offsetLeft - pos1;
      
      element.style.top = `${newTop}px`;
      element.style.left = `${newLeft}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
      element.style.transform = 'none';
      
      // Update variables on the root document for visual feedback
      document.documentElement.style.setProperty(`--${varPrefix}-pos`, 'absolute');
      document.documentElement.style.setProperty(`--${varPrefix}-top`, `${newTop}px`);
      document.documentElement.style.setProperty(`--${varPrefix}-left`, `${newLeft}px`);
      
      if (varPrefix === 'welcome') {
        document.documentElement.style.setProperty('--welcome-transform', 'none');
      }
      if (varPrefix === 'grid') {
        document.documentElement.style.setProperty('--grid-height', `calc(100vh - ${newTop}px - 40px)`);
      }
      
      // Save coordinate values to database keys
      liveLayoutCoords[`css_${varPrefix}_pos`] = 'absolute';
      liveLayoutCoords[`css_${varPrefix}_top`] = `${newTop}px`;
      liveLayoutCoords[`css_${varPrefix}_left`] = `${newLeft}px`;
      if (varPrefix === 'welcome') {
        liveLayoutCoords['css_welcome_transform'] = 'none';
      }
      if (varPrefix === 'grid') {
        liveLayoutCoords['css_grid_height'] = `calc(100vh - ${newTop}px - 40px)`;
      }
    }

    function closeDragElement() {
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('touchend', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('touchmove', elementDrag);
    }
  }

  // Individual Button Drag & Resize helper function
  function makeButtonDraggableAndResizable(button, id) {
    let handle = button.querySelector('.resize-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'resize-handle';
      button.appendChild(handle);
    }

    // Dragging
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    button.addEventListener('mousedown', dragMouseDown);
    button.addEventListener('touchstart', dragMouseDown, { passive: false });

    function dragMouseDown(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      if (e.target.classList.contains('resize-handle')) return;
      
      e.preventDefault();
      
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      pos3 = clientX;
      pos4 = clientY;
      
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('touchend', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
      document.addEventListener('touchmove', elementDrag, { passive: false });
    }

    function elementDrag(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      e.preventDefault();
      
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      
      pos1 = pos3 - clientX;
      pos2 = pos4 - clientY;
      pos3 = clientX;
      pos4 = clientY;
      
      let newTop = button.offsetTop - pos2;
      let newLeft = button.offsetLeft - pos1;
      
      button.style.position = 'absolute';
      button.style.margin = '0';
      button.style.top = `${newTop}px`;
      button.style.left = `${newLeft}px`;
      
      liveLayoutCoords[`css_btn_pos_${id}`] = 'absolute';
      liveLayoutCoords[`css_btn_top_${id}`] = `${newTop}px`;
      liveLayoutCoords[`css_btn_left_${id}`] = `${newLeft}px`;
    }

    // Resizing
    handle.addEventListener('mousedown', resizeMouseDown);
    handle.addEventListener('touchstart', resizeMouseDown, { passive: false });

    function resizeMouseDown(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      e.preventDefault();
      e.stopPropagation();
      
      const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
      pos3 = clientX;
      pos4 = clientY;
      
      document.addEventListener('mouseup', closeResizeElement);
      document.addEventListener('touchend', closeResizeElement);
      document.addEventListener('mousemove', elementResize);
      document.addEventListener('touchmove', elementResize, { passive: false });
    }

    function elementResize(e) {
      if (!document.body.classList.contains('edit-mode')) return;
      e.preventDefault();
      
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      
      const widthDiff = clientX - pos3;
      const heightDiff = clientY - pos4;
      pos3 = clientX;
      pos4 = clientY;
      
      let newWidth = button.offsetWidth + widthDiff;
      let newHeight = button.offsetHeight + heightDiff;
      
      if (newWidth < 100) newWidth = 100;
      if (newHeight < 50) newHeight = 50;
      
      button.style.width = `${newWidth}px`;
      button.style.height = `${newHeight}px`;
      
      liveLayoutCoords[`css_btn_width_${id}`] = `${newWidth}px`;
      liveLayoutCoords[`css_btn_height_${id}`] = `${newHeight}px`;
    }

    function closeDragElement() {
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('touchend', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      document.removeEventListener('touchmove', elementDrag);
    }

    function closeResizeElement() {
      document.removeEventListener('mouseup', closeResizeElement);
      document.removeEventListener('touchend', closeResizeElement);
      document.removeEventListener('mousemove', elementResize);
      document.removeEventListener('touchmove', elementResize);
    }
  }

  // Initialize draggable elements
  const elLogo = document.querySelector('.logo-container');
  const elWelcome = document.querySelector('.kiosk-welcome');
  
  if (elLogo) makeDraggable(elLogo, 'logo');
  if (elWelcome) makeDraggable(elWelcome, 'welcome');

  // Toggle Edit Layout Mode
  btnToggleEditMode.addEventListener('click', () => {
    const isEdit = document.body.classList.toggle('edit-mode');
    btnToggleEditMode.classList.toggle('btn-accent', !isEdit);
    btnToggleEditMode.classList.toggle('btn-success', isEdit);
    const span = btnToggleEditMode.querySelector('span');
    if (span) {
      span.textContent = isEdit ? "Tahrirlashni yakunlash (Drag & Drop)" : "Dizayn tahrirlash (Sichqoncha bilan siljitish)";
    }
    
    if (isEdit) {
      settingsModal.style.opacity = '0.15';
      settingsModal.style.pointerEvents = 'none';
      
      const restoreModal = (e) => {
        if (!document.body.classList.contains('edit-mode')) return;
        if (e.target.closest('#btn-toggle-edit-mode')) {
          e.preventDefault();
          e.stopPropagation();
          document.body.classList.remove('edit-mode');
          btnToggleEditMode.classList.add('btn-accent');
          btnToggleEditMode.classList.remove('btn-success');
          if (span) span.textContent = "Dizayn tahrirlash (Sichqoncha bilan siljitish)";
          settingsModal.style.opacity = '1';
          settingsModal.style.pointerEvents = 'auto';
          document.removeEventListener('click', restoreModal);
        } else {
          settingsModal.style.opacity = '1';
          settingsModal.style.pointerEvents = 'auto';
        }
      };
      setTimeout(() => {
        document.addEventListener('click', restoreModal);
      }, 300);
    }
  });

  // Open modal and load settings
  async function openSettingsModal() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
      
      liveLayoutCoords = {};
      
      // Populate fields
      settingsTheme.value = settings.theme || 'theme-glass-neon';
      settingsLogoPosition.value = settings.logo_position || 'logo-left';
      
      const primaryColor = settings.brand_color || '#3b82f6';
      settingsBrandColor.value = primaryColor;
      settingsBrandColorHex.value = primaryColor;

      const bgColor = settings.css_bg_primary || '#020617';
      settingsBgColor.value = bgColor;
      settingsBgColorHex.value = bgColor;

      const textColor = settings.css_text_primary || '#f8fafc';
      settingsTextColor.value = textColor;
      settingsTextColorHex.value = textColor;
      
      settingsLogoMain.value = settings.logo_main || '';
      settingsLogoImg.value = settings.logo_img || '';
      settingsBgImg.value = settings.bg_img || '';
      
      settingsLogoFile.value = '';
      settingsBgFile.value = '';
      
      // Parse height/width from settings to set slider values
      let padNum = 25;
      if (settings.css_kiosk_btn_padding) {
        const match = settings.css_kiosk_btn_padding.match(/([\d.]+)rem/);
        if (match) padNum = Math.round(parseFloat(match[1]) * 10);
      }
      settingsBtnPadding.value = padNum;
      valBtnPadding.textContent = `${(padNum / 10).toFixed(1)}rem`;
      
      let widthNum = 320;
      if (settings.css_kiosk_btn_width) {
        const match = settings.css_kiosk_btn_width.match(/(\d+)px/);
        if (match) widthNum = parseInt(match[1]);
      }
      settingsBtnWidth.value = widthNum;
      valBtnWidth.textContent = `${widthNum}px`;
      
      // Reset edit mode states
      document.body.classList.remove('edit-mode');
      btnToggleEditMode.classList.add('btn-accent');
      btnToggleEditMode.classList.remove('btn-success');
      const span = btnToggleEditMode.querySelector('span');
      if (span) span.textContent = "Dizayn tahrirlash (Sichqoncha bilan siljitish)";
      settingsModal.style.opacity = '1';
      settingsModal.style.pointerEvents = 'auto';

      settingsModal.classList.add('active');
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  }

  function closeSettingsModal() {
    settingsModal.classList.remove('active');
    loadBranding(); // Revert any unsaved live preview changes
  }

  // Close event handlers
  closeSettingsBtn.addEventListener('click', closeSettingsModal);
  cancelSettingsBtn.addEventListener('click', closeSettingsModal);
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      closeSettingsModal();
    }
  });

  // Color picker sync
  const setupColorSync = (picker, input, varName) => {
    picker.addEventListener('input', (e) => {
      input.value = e.target.value;
      document.documentElement.style.setProperty(varName, e.target.value);
    });
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9A-F]{6}$/i.test(val)) {
        picker.value = val;
        document.documentElement.style.setProperty(varName, val);
      }
    });
  };

  setupColorSync(settingsBrandColor, settingsBrandColorHex, '--color-primary');
  setupColorSync(settingsBgColor, settingsBgColorHex, '--bg-primary');
  setupColorSync(settingsTextColor, settingsTextColorHex, '--text-primary');

  // Live preview slider events
  settingsBtnPadding.addEventListener('input', (e) => {
    const val = e.target.value;
    const paddingCss = `${(val / 10).toFixed(1)}rem ${(val / 15).toFixed(1)}rem`;
    document.documentElement.style.setProperty('--kiosk-btn-padding', paddingCss);
    valBtnPadding.textContent = `${(val / 10).toFixed(1)}rem`;
  });

  settingsBtnWidth.addEventListener('input', (e) => {
    const val = e.target.value;
    const widthCss = `${val}px`;
    document.documentElement.style.setProperty('--kiosk-btn-width', widthCss);
    valBtnWidth.textContent = `${val}px`;
  });

  settingsLogoPosition.addEventListener('change', (e) => {
    const header = document.querySelector('header');
    if (header) {
      header.className = e.target.value;
    }
  });

  // File upload helper
  const setupFileUpload = (fileInput, urlInput, labelSelector) => {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const label = document.querySelector(labelSelector);
      const oldText = label.textContent;
      label.textContent = "Yuklanmoqda...";
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileData: reader.result
            })
          });
          
          if (!response.ok) throw new Error('Yuklash amalga oshmadi');
          const result = await response.json();
          
          if (result.success) {
            urlInput.value = result.url;
            if (urlInput === settingsLogoImg) {
              const logoImg = document.querySelector('.logo-container img');
              if (logoImg) logoImg.src = result.url;
            } else if (urlInput === settingsBgImg) {
              document.body.style.setProperty('--custom-bg-img', `url('${result.url}')`);
              document.body.classList.add('has-custom-bg');
            }
            alert('Rasm muvaffaqiyatli yuklandi!');
          } else {
            throw new Error(result.error || 'Yuklash xatosi');
          }
        } catch (err) {
          alert(`Fayl yuklashda xatolik: ${err.message}`);
        } finally {
          label.textContent = oldText;
        }
      };
      reader.readAsDataURL(file);
    });
  };

  setupFileUpload(settingsLogoFile, settingsLogoImg, 'label[for="settings-logo-file"]');
  setupFileUpload(settingsBgFile, settingsBgImg, 'label[for="settings-bg-file"]');

  // Handle form submission
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    let brandColor = settingsBrandColorHex.value.trim();
    let bgColor = settingsBgColorHex.value.trim();
    let textColor = settingsTextColorHex.value.trim();

    if (!/^#[0-9A-F]{6}$/i.test(brandColor) || !/^#[0-9A-F]{6}$/i.test(bgColor) || !/^#[0-9A-F]{6}$/i.test(textColor)) {
      alert('Iltimos, rang kodlarini to\'g\'ri HEX formatda kiriting (masalan: #3b82f6)');
      return;
    }
    
    const padVal = settingsBtnPadding.value;
    const paddingCss = `${(padVal / 10).toFixed(1)}rem ${(padVal / 15).toFixed(1)}rem`;
    const widthCss = `${settingsBtnWidth.value}px`;

    const settingsData = {
      theme: settingsTheme.value,
      logo_position: settingsLogoPosition.value,
      brand_color: brandColor,
      css_bg_primary: bgColor,
      css_text_primary: textColor,
      logo_main: settingsLogoMain.value.trim(),
      logo_img: settingsLogoImg.value.trim(),
      bg_img: settingsBgImg.value.trim(),
      css_kiosk_btn_padding: paddingCss,
      css_kiosk_btn_width: widthCss,
      ...liveLayoutCoords
    };
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      });
      
      if (!response.ok) {
        throw new Error('Sozlamalarni saqlashda xatolik yuz berdi');
      }
      
      const result = await response.json();
      if (result.success) {
        document.body.classList.remove('edit-mode');
        closeSettingsModal();
        loadBranding();
      } else {
        throw new Error('Server sozlamalarni saqlamadi');
      }
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // === Floating Visual Designer Dock Features ===
  const designerToggleBtn = document.getElementById('designer-toggle-btn');
  const designerDock = document.getElementById('designer-dock');
  const dockBtnToggleDrag = document.getElementById('dock-btn-toggle-drag');
  const dockBtnResetButtons = document.getElementById('dock-btn-reset-buttons');
  const dockBtnCancel = document.getElementById('dock-btn-cancel');
  const dockBtnSave = document.getElementById('dock-btn-save');
  
  const dockBrandColor = document.getElementById('dock-brand-color');
  const dockBrandColorHex = document.getElementById('dock-brand-color-hex');
  const dockBgColor = document.getElementById('dock-bg-color');
  const dockBgColorHex = document.getElementById('dock-bg-color-hex');
  const dockBgColor2 = document.getElementById('dock-bg-color-2');
  const dockBgColor2Hex = document.getElementById('dock-bg-color-2-hex');
  const dockTextColor = document.getElementById('dock-text-color');
  const dockTextColorHex = document.getElementById('dock-text-color-hex');
  
  const dockBtnPadding = document.getElementById('dock-btn-padding');
  const dockBtnWidth = document.getElementById('dock-btn-width');
  const dockValPadding = document.getElementById('dock-val-padding');
  const dockValWidth = document.getElementById('dock-val-width');

  const dockBgAngle = document.getElementById('dock-bg-angle');
  const dockValBgAngle = document.getElementById('dock-val-bg-angle');
  const dockGlassBlur = document.getElementById('dock-glass-blur');
  const dockValGlassBlur = document.getElementById('dock-val-glass-blur');
  
  const dockUploadLogoBtn = document.getElementById('dock-upload-logo-btn');
  const dockLogoFileInput = document.getElementById('dock-logo-file-input');
  const dockClearLogoBtn = document.getElementById('dock-clear-logo-btn');
  
  const dockUploadBgBtn = document.getElementById('dock-upload-bg-btn');
  const dockBgFileInput = document.getElementById('dock-bg-file-input');
  const dockClearBgBtn = document.getElementById('dock-clear-bg-btn');
  
  const dockLogoText = document.getElementById('dock-logo-text');
  const dockTheme = document.getElementById('dock-theme');

  // Open designer dock helper
  function openDesignerDock() {
    if (designerDock) {
      designerDock.classList.add('active');
      syncDockWithSettings();
    }
  }

  // Toggle Visual Designer Dock
  designerToggleBtn.addEventListener('click', () => {
    const isActive = designerDock.classList.toggle('active');
    if (isActive) {
      syncDockWithSettings();
    } else {
      document.body.classList.remove('edit-mode');
      updateDockDragBtnState();
      loadBranding();
      loadDirections(); // Revert unsaved button positions
    }
  });

  function syncDockWithSettings() {
    const primaryColor = currentSettings.brand_color || '#3b82f6';
    dockBrandColor.value = primaryColor;
    dockBrandColorHex.value = primaryColor;

    const bgColor = currentSettings.css_bg_primary || '#020617';
    dockBgColor.value = bgColor;
    dockBgColorHex.value = bgColor;

    const bgColor2 = currentSettings.css_bg_color_2 || '#0f172a';
    dockBgColor2.value = bgColor2;
    dockBgColor2Hex.value = bgColor2;

    const textColor = currentSettings.css_text_primary || '#f8fafc';
    dockTextColor.value = textColor;
    dockTextColorHex.value = textColor;

    dockLogoText.value = currentSettings.logo_main || '';

    let padNum = 25;
    if (currentSettings.css_kiosk_btn_padding) {
      const match = currentSettings.css_kiosk_btn_padding.match(/([\d.]+)rem/);
      if (match) padNum = Math.round(parseFloat(match[1]) * 10);
    }
    dockBtnPadding.value = padNum;
    dockValPadding.textContent = `${(padNum / 10).toFixed(1)}rem`;

    let widthNum = 320;
    if (currentSettings.css_kiosk_btn_width) {
      const match = currentSettings.css_kiosk_btn_width.match(/(\d+)px/);
      if (match) widthNum = parseInt(match[1]);
    }
    dockBtnWidth.value = widthNum;
    dockValWidth.textContent = `${widthNum}px`;

    // Angle and blur
    let angleVal = 135;
    if (currentSettings.css_bg_angle) {
      const match = currentSettings.css_bg_angle.match(/(\d+)deg/);
      if (match) angleVal = parseInt(match[1]);
    }
    dockBgAngle.value = angleVal;
    dockValBgAngle.textContent = `${angleVal}deg`;

    let blurVal = 12;
    if (currentSettings.css_glass_blur) {
      const match = currentSettings.css_glass_blur.match(/(\d+)px/);
      if (match) blurVal = parseInt(match[1]);
    }
    dockGlassBlur.value = blurVal;
    dockValGlassBlur.textContent = `${blurVal}px`;

    dockTheme.value = currentSettings.theme || 'theme-glass-neon';
    updateDockDragBtnState();
  }

  function updateDockDragBtnState() {
    const isDrag = document.body.classList.contains('edit-mode');
    dockBtnToggleDrag.classList.toggle('btn-success', isDrag);
    dockBtnToggleDrag.classList.toggle('btn-secondary', !isDrag);
    const span = dockBtnToggleDrag.querySelector('span');
    if (span) {
      span.textContent = isDrag ? "Sudrash rejimi (Yoqilgan)" : "Sudrash rejimi (O'chirilgan)";
    }
  }

  dockBtnToggleDrag.addEventListener('click', () => {
    document.body.classList.toggle('edit-mode');
    updateDockDragBtnState();
  });

  // Reset Button Positions action
  dockBtnResetButtons.addEventListener('click', async () => {
    if (!confirm("Haqiqatan ham barcha elementlar joylashuvini tiklamoqchimisiz?")) return;
    
    // Delete all button, logo, welcome custom positions & sizes keys from settings
    Object.keys(currentSettings).forEach(key => {
      if (key.startsWith('css_btn_pos_') || key.startsWith('css_btn_top_') || key.startsWith('css_btn_left_') || key.startsWith('css_btn_width_') || key.startsWith('css_btn_height_') || key.startsWith('css_grid_') ||
          key.startsWith('css_logo_') || key.startsWith('css_welcome_')) {
        delete currentSettings[key];
      }
    });

    // Also clear from liveLayoutCoords
    Object.keys(liveLayoutCoords).forEach(key => {
      if (key.startsWith('css_btn_pos_') || key.startsWith('css_btn_top_') || key.startsWith('css_btn_left_') || key.startsWith('css_btn_width_') || key.startsWith('css_btn_height_') || key.startsWith('css_grid_') ||
          key.startsWith('css_logo_') || key.startsWith('css_welcome_')) {
        delete liveLayoutCoords[key];
      }
    });

    // Make a PUT request immediately to save the reset positions in DB
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentSettings)
      });
      
      if (!response.ok) throw new Error('Tiklashni saqlashda xatolik yuz berdi');
      const result = await response.json();
      if (result.success) {
        // Clear active element inline styles
        const elLogo = document.querySelector('.logo-container');
        const elWelcome = document.querySelector('.kiosk-welcome');
        if (elLogo) {
          elLogo.style.position = '';
          elLogo.style.top = '';
          elLogo.style.left = '';
        }
        if (elWelcome) {
          elWelcome.style.position = '';
          elWelcome.style.top = '';
          elWelcome.style.left = '';
          elWelcome.style.transform = '';
        }
        
        // Remove document style properties
        document.body.style.removeProperty('--logo-pos');
        document.body.style.removeProperty('--logo-top');
        document.body.style.removeProperty('--logo-left');
        document.body.style.removeProperty('--welcome-pos');
        document.body.style.removeProperty('--welcome-top');
        document.body.style.removeProperty('--welcome-left');
        document.body.style.removeProperty('--welcome-transform');

        alert('Elementlar joylashuvi muvaffaqiyatli tiklandi!');
        loadBranding();
        loadDirections(); // reload buttons in grid layout!
      }
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Colors sync for dock
  setupColorSync(dockBrandColor, dockBrandColorHex, '--color-primary');
  setupColorSync(dockBgColor, dockBgColorHex, '--bg-primary');
  setupColorSync(dockBgColor2, dockBgColor2Hex, '--bg-color-2');
  setupColorSync(dockTextColor, dockTextColorHex, '--text-primary');

  // Sliders sync for dock
  dockBtnPadding.addEventListener('input', (e) => {
    const val = e.target.value;
    const paddingCss = `${(val / 10).toFixed(1)}rem ${(val / 15).toFixed(1)}rem`;
    document.documentElement.style.setProperty('--kiosk-btn-padding', paddingCss);
    dockValPadding.textContent = `${(val / 10).toFixed(1)}rem`;
  });

  dockBtnWidth.addEventListener('input', (e) => {
    const val = e.target.value;
    const widthCss = `${val}px`;
    document.documentElement.style.setProperty('--kiosk-btn-width', widthCss);
    dockValWidth.textContent = `${val}px`;
  });

  dockBgAngle.addEventListener('input', (e) => {
    const val = e.target.value;
    const angleCss = `${val}deg`;
    document.documentElement.style.setProperty('--bg-angle', angleCss);
    dockValBgAngle.textContent = angleCss;
  });

  dockGlassBlur.addEventListener('input', (e) => {
    const val = e.target.value;
    const blurCss = `${val}px`;
    document.documentElement.style.setProperty('--glass-blur', blurCss);
    dockValGlassBlur.textContent = blurCss;
  });

  // Logo text input
  dockLogoText.addEventListener('input', (e) => {
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
      logoIcon.textContent = e.target.value.substring(0, 2).toUpperCase() || 'EN';
    }
  });

  // Theme change listener
  dockTheme.addEventListener('change', (e) => {
    document.body.className = '';
    document.body.classList.add(e.target.value);
  });

  // File Upload Helper
  async function uploadFile(file, onComplete) {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            fileData: reader.result
          })
        });
        
        if (!response.ok) throw new Error('Yuklash amalga oshmadi');
        const result = await response.json();
        
        if (result.success) {
          onComplete(result.url);
        } else {
          throw new Error(result.error || 'Yuklash xatosi');
        }
      } catch (err) {
        alert(`Fayl yuklashda xatolik: ${err.message}`);
      }
    };
    reader.readAsDataURL(file);
  }

  // Trigger file inputs
  dockUploadLogoBtn.addEventListener('click', () => dockLogoFileInput.click());
  dockUploadBgBtn.addEventListener('click', () => dockBgFileInput.click());

  dockLogoFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadFile(file, (url) => {
      currentSettings.logo_img = url;
      const logoContainer = document.querySelector('.logo-container');
      if (logoContainer) {
        const logoImg = logoContainer.querySelector('img');
        if (logoImg) {
          logoImg.src = url;
        } else {
          logoContainer.innerHTML = `<img src="${url}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo"><div class="logo-drag-overlay">Logotip rasmi yuklash</div>`;
        }
      }
      alert('Logotip rasmi muvaffaqiyatli yuklandi!');
    });
  });

  dockBgFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    uploadFile(file, (url) => {
      currentSettings.bg_img = url;
      document.body.style.setProperty('--custom-bg-img', `url('${url}')`);
      document.body.classList.add('has-custom-bg');
      alert('Fon rasmi muvaffaqiyatli yuklandi!');
    });
  });

  // Clear buttons
  dockClearLogoBtn.addEventListener('click', () => {
    currentSettings.logo_img = '';
    loadBranding();
    alert('Logotip rasmi olib tashlandi (matnli logotip qaytadi).');
  });

  dockClearBgBtn.addEventListener('click', () => {
    currentSettings.bg_img = '';
    document.body.style.removeProperty('--custom-bg-img');
    document.body.classList.remove('has-custom-bg');
    alert('Fon rasmi olib tashlandi.');
  });

  // Cancel and Save buttons
  dockBtnCancel.addEventListener('click', () => {
    designerDock.classList.remove('active');
    document.body.classList.remove('edit-mode');
    loadBranding();
    loadDirections();
  });

  dockBtnSave.addEventListener('click', async () => {
    let brandColor = dockBrandColorHex.value.trim();
    let bgColor = dockBgColorHex.value.trim();
    let bgColor2 = dockBgColor2Hex.value.trim();
    let textColor = dockTextColorHex.value.trim();

    if (!/^#[0-9A-F]{6}$/i.test(brandColor) || !/^#[0-9A-F]{6}$/i.test(bgColor) || !/^#[0-9A-F]{6}$/i.test(bgColor2) || !/^#[0-9A-F]{6}$/i.test(textColor)) {
      alert('Iltimos, rang kodlarini to\'g\'ri HEX formatda kiriting (masalan: #3b82f6)');
      return;
    }
    
    const padVal = dockBtnPadding.value;
    const paddingCss = `${(padVal / 10).toFixed(1)}rem ${(padVal / 15).toFixed(1)}rem`;
    const widthCss = `${dockBtnWidth.value}px`;
    const angleCss = `${dockBgAngle.value}deg`;
    const blurCss = `${dockGlassBlur.value}px`;

    const settingsData = {
      ...currentSettings,
      theme: dockTheme.value,
      brand_color: brandColor,
      css_bg_primary: bgColor,
      css_bg_color_2: bgColor2,
      css_bg_angle: angleCss,
      css_glass_blur: blurCss,
      css_text_primary: textColor,
      logo_main: dockLogoText.value.trim(),
      css_kiosk_btn_padding: paddingCss,
      css_kiosk_btn_width: widthCss,
      ...liveLayoutCoords
    };
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsData)
      });
      
      if (!response.ok) throw new Error('Sozlamalarni saqlashda xatolik yuz berdi');
      
      const result = await response.json();
      if (result.success) {
        document.body.classList.remove('edit-mode');
        designerDock.classList.remove('active');
        alert('Dizayn muvaffaqiyatli saqlandi!');
        loadBranding();
        loadDirections();
      } else {
        throw new Error('Server sozlamalarni saqlamadi');
      }
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Drag-and-drop file upload for background image
  const globalDragOverlay = document.getElementById('global-drag-overlay');
  
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      globalDragOverlay.classList.add('active');
    }
  });

  globalDragOverlay.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  globalDragOverlay.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (e.relatedTarget === null || e.toElement === null) {
      globalDragOverlay.classList.remove('active');
    }
  });

  document.addEventListener('dragleave', (e) => {
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      globalDragOverlay.classList.remove('active');
    }
  });

  globalDragOverlay.addEventListener('drop', (e) => {
    e.preventDefault();
    globalDragOverlay.classList.remove('active');
    
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      const file = files[0];
      uploadFile(file, (url) => {
        currentSettings.bg_img = url;
        document.body.style.setProperty('--custom-bg-img', `url('${url}')`);
        document.body.classList.add('has-custom-bg');
        
        designerDock.classList.add('active');
        syncDockWithSettings();
        alert('Orqa fon rasmi yuklandi. Saqlash uchun panelda "Saqlash" tugmasini bosing.');
      });
    }
  });

  // Drag-and-drop file upload for logo container
  const setupLogoDragAndDrop = () => {
    const logoContainer = document.querySelector('.logo-container');
    if (!logoContainer) return;

    logoContainer.addEventListener('dragenter', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.types.includes('Files')) {
        logoContainer.classList.add('dragover');
      }
    });

    logoContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    logoContainer.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logoContainer.classList.remove('dragover');
    });

    logoContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      logoContainer.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type.startsWith('image/')) {
        const file = files[0];
        uploadFile(file, (url) => {
          currentSettings.logo_img = url;
          
          const img = logoContainer.querySelector('img');
          if (img) {
            img.src = url;
          } else {
            logoContainer.innerHTML = `<img src="${url}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo"><div class="logo-drag-overlay">Logotip rasmi yuklash</div>`;
          }
          
          designerDock.classList.add('active');
          syncDockWithSettings();
          alert('Logotip rasmi yuklandi. Saqlash uchun panelda "Saqlash" tugmasini bosing.');
        });
      }
    });
  };



  // Load initial configurations and setup events
  loadBranding().then(() => {
    loadDirections();
    connectWebSocket();
    setupLogoDragAndDrop();
  });
});
