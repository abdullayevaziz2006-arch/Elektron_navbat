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

  // Load dynamic branding settings
  async function loadBranding() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
      if (settings) {
        // 1. Set brand color
        const brandColor = settings.brand_color || '#e60000';
        document.documentElement.style.setProperty('--color-primary', brandColor);
        document.documentElement.style.setProperty('--brand-color', brandColor);

        // 2. Set theme class
        document.body.className = '';
        if (settings.theme && settings.theme !== 'modern-dark') {
          document.body.classList.add(`theme-${settings.theme}`);
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
            logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 55px; max-width: 250px; object-fit: contain;" alt="Logo">`;
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
            document.documentElement.style.setProperty(varName, settings[key]);
          }
        });

        // 7. Inject custom CSS
        let styleTag = document.getElementById('kiosk-custom-css-tag');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'kiosk-custom-css-tag';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = settings.custom_css || '';
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
        button.innerHTML = `
          <div class="direction-code">${dir.code}</div>
          <div class="direction-name">${dir.name}</div>
          <div class="direction-room">${dir.room}-operator xonasi</div>
        `;

        button.addEventListener('click', () => generateTicket(dir.code));
        directionsGrid.appendChild(button);
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
  async function generateTicket(code) {
    // Clear any active timeout
    if (modalTimeout) clearTimeout(modalTimeout);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction_code: code })
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

      // Trigger printing automatically after a short delay for DOM rendering
      setTimeout(() => {
        window.print();
      }, 500);

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

  // Load initial configurations
  loadBranding().then(() => {
    loadDirections();
    connectWebSocket();
  });
});
