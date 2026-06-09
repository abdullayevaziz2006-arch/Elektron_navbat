document.addEventListener('DOMContentLoaded', () => {
  // Clock
  const clockEl = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('uz-UZ', { hour12: false });
  }
  setInterval(updateClock, 1000);
  updateClock();

  // DOM Elements
  const lanesContainer = document.getElementById('lanes-container');
  const waitingGridContainer = document.getElementById('waiting-grid-container');
  const waitingCountTag = document.getElementById('waiting-count-tag');

  let socket = null;
  let operatorRooms = []; // List of active rooms
  let activeLanes = {};   // { room: ticketObj }
  let waitingQueue = [];  // List of waiting tickets
  let announcementQueue = [];
  let isSpeaking = false;

  // Load dynamic settings branding
  async function loadBranding() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
      if (settings) {
        // 1. Set brand color
        const brandColor = settings.brand_color || '#e60000';
        document.documentElement.style.setProperty('--brand-color', brandColor);
        document.documentElement.style.setProperty('--color-primary', brandColor);

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

        // 4. Set logo (custom image or text bars logo)
        const logoContainer = document.querySelector('.brand-logo-container');
        if (logoContainer) {
          if (settings.logo_img && settings.logo_img !== '') {
            logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 120px; max-width: 250px; object-fit: contain;" alt="Logo">`;
          } else {
            const logoMainVal = settings.logo_main || 'RANCH';
            const logoSubVal = settings.logo_sub || 'University';
            logoContainer.innerHTML = `
              <div class="ranch-logo-bars">
                <div class="ranch-bar ranch-bar-1"></div>
                <div class="ranch-bar ranch-bar-2"></div>
                <div class="ranch-bar ranch-bar-3"></div>
                <div class="ranch-bar ranch-bar-4"></div>
              </div>
              <div class="brand-text">
                <h1>${logoMainVal}</h1>
                <p>${logoSubVal}</p>
              </div>
            `;
          }
        }

        // 5. Monitor Title
        const brandTitleEl = document.querySelector('.brand-title');
        if (brandTitleEl) brandTitleEl.textContent = settings.monitor_title || 'Tizim Monitori';

        // 6. Inject custom CSS
        let styleTag = document.getElementById('monitor-custom-css-tag');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'monitor-custom-css-tag';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = settings.custom_css || '';
      }
    } catch (err) {
      console.error('Error loading branding settings:', err);
    }
  }

  // Initialize: Load operators to know which rooms to display, then load monitor state
  async function initMonitor() {
    try {
      // Load custom branding first
      await loadBranding();

      // 1. Fetch active operators/rooms
      const opRes = await fetch('/api/admin/operators');
      if (opRes.ok) {
        const operators = await opRes.json();
        // Collect unique rooms, sorted ascending
        operatorRooms = [...new Set(operators.map(op => op.room))].sort((a, b) => a - b);
      }
      
      // Fallback if no operators registered yet
      if (operatorRooms.length === 0) {
        operatorRooms = [1, 2, 3, 4]; // default test lanes
      }

      // Initialize activeLanes object
      operatorRooms.forEach(room => {
        activeLanes[room] = null;
      });

      // 2. Fetch current state (active servings and waiting queue)
      await loadMonitorState();
      
      // 3. Render initial layout
      renderLanes();
      renderWaitingGrid();

    } catch (err) {
      console.error('Error initializing monitor:', err);
    }
  }

  // Load active serving and waiting queue from API
  async function loadMonitorState() {
    try {
      const response = await fetch('/api/monitor/state');
      if (!response.ok) throw new Error('Monitor holatini yuklab bo\'lmadi');
      const state = await response.json();

      // Clear active lanes, then populate with called tickets
      operatorRooms.forEach(room => {
        activeLanes[room] = null;
      });

      // Populate called tickets into corresponding rooms
      if (state.called && state.called.length > 0) {
        state.called.forEach(ticket => {
          if (activeLanes[ticket.room] === null) { // only assign the most recent for each room
            activeLanes[ticket.room] = ticket;
          }
        });
      }

      // Save waiting queue
      waitingQueue = state.waitingList || [];
      waitingCountTag.textContent = `${waitingQueue.length} ta`;

    } catch (err) {
      console.error(err);
    }
  }

  // Render Lanes (Indigo-White Rows)
  function renderLanes() {
    lanesContainer.innerHTML = '';
    
    operatorRooms.forEach(room => {
      const ticket = activeLanes[room];
      const ticketCode = ticket ? ticket.ticket_code : '- - -';
      
      const row = document.createElement('div');
      row.className = 'active-lane-row';
      row.id = `lane-room-${room}`;
      row.innerHTML = `
        <div class="lane-ticket-box" id="lane-ticket-val-${room}">${ticketCode}</div>
        <div class="lane-room-box">
          <div>${room}-operator</div>
          <div class="lane-room-subtitle">xona ${room}</div>
        </div>
      `;
      
      lanesContainer.appendChild(row);
    });
  }

  // Render Right Waiting Grid badges
  function renderWaitingGrid() {
    waitingGridContainer.innerHTML = '';
    
    if (waitingQueue.length === 0) {
      waitingGridContainer.innerHTML = `
        <div style="text-align: center; grid-column: 1/-1; padding: 4rem; color: var(--text-muted); font-size: 0.95rem;">
          Navbat bo'sh
        </div>
      `;
      return;
    }

    waitingQueue.forEach(ticket => {
      const badge = document.createElement('div');
      badge.className = 'waiting-badge';
      badge.innerHTML = `
        <div class="waiting-badge-code">${ticket.ticket_code}</div>
        <div class="waiting-badge-dir">${ticket.direction_name}</div>
      `;
      waitingGridContainer.appendChild(badge);
    });
  }

  // Play Ding-Dong chime using Web Audio API
  function playDingDong() {
    return new Promise((resolve) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return resolve();
        const ctx = new AudioContext();

        const playTone = (freq, startTime, duration, type = 'triangle') => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = type;
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0, startTime);
          gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;
        playTone(783.99, now, 0.8, 'triangle');       // G5
        playTone(659.25, now + 0.45, 1.2, 'triangle');  // E5

        setTimeout(resolve, 1800);
      } catch (e) {
        console.error(e);
        resolve();
      }
    });
  }

  // Speak Uzbek TTS announcement
  function speakAnnouncement(ticket) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        return resolve();
      }

      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      const failsafeTimeout = setTimeout(() => {
        console.warn('Speech timeout triggered.');
        safeResolve();
      }, 7000);

      const letterCode = ticket.direction_code.toUpperCase();
      let letterPronunciation = letterCode;
      
      const letterMapping = {
        'A': 'A', 'B': 'B', 'C': 'S', 'D': 'D', 'E': 'E', 'F': 'F',
        'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J', 'K': 'K', 'L': 'L'
      };
      
      if (letterMapping[letterCode]) {
        letterPronunciation = letterMapping[letterCode];
      }

      const text = `Navbat raqami, ${letterPronunciation} ${ticket.number}. ${ticket.room} xonaga.`;
      const utterance = new SpeechSynthesisUtterance(text);
      
      const voices = window.speechSynthesis.getVoices();
      const preferredLocales = ['uz-UZ', 'tr-TR', 'az-AZ', 'ru-RU', 'en-US'];
      let chosenVoice = null;

      for (const locale of preferredLocales) {
        chosenVoice = voices.find(v => v.lang.startsWith(locale));
        if (chosenVoice) break;
      }

      if (chosenVoice) {
        utterance.voice = chosenVoice;
      }
      
      utterance.rate = 0.85; 
      utterance.pitch = 1.0;

      utterance.onend = () => {
        clearTimeout(failsafeTimeout);
        safeResolve();
      };

      utterance.onerror = () => {
        clearTimeout(failsafeTimeout);
        safeResolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Process sequential voice calling queue
  async function processQueue() {
    if (isSpeaking || announcementQueue.length === 0) return;
    
    isSpeaking = true;
    const ticket = announcementQueue.shift();

    // 1. Fetch latest server state first to synchronize database
    await loadMonitorState();
    
    // 2. Render state on screen (waiting list removes the called ticket, active lane updates)
    activeLanes[ticket.room] = ticket;
    renderLanes();
    renderWaitingGrid();

    // 3. Highlight the active lane row that was called
    const activeRow = document.getElementById(`lane-room-${ticket.room}`);
    if (activeRow) {
      activeRow.classList.add('flashing');
    }

    // 4. Play Ding-Dong chime
    await playDingDong();

    // 5. Speak announcement
    await speakAnnouncement(ticket);

    // Keep flashing a little longer, then clear
    setTimeout(() => {
      if (activeRow) {
        activeRow.classList.remove('flashing');
      }
      isSpeaking = false;
      processQueue(); // Process next called ticket in queue
    }, 1500);
  }

  // Autoplay activation overlay handler
  document.addEventListener('click', () => {
    const overlay = document.getElementById('autoplay-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.style.display = 'none', 300);
    }
    // Warm up/resume AudioContext
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const tempCtx = new AudioContext();
        if (tempCtx.state === 'suspended') {
          tempCtx.resume();
        }
      }
    } catch (e) {}
  });

  // WebSocket connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    socket = new WebSocket(`${protocol}//${host}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'INITIAL_STATE') {
          // Re-populate active lanes and waiting list
          waitingQueue = data.state.waitingList || [];
          waitingCountTag.textContent = `${waitingQueue.length} ta`;
          
          operatorRooms.forEach(room => activeLanes[room] = null);
          if (data.state.called && data.state.called.length > 0) {
            data.state.called.forEach(ticket => {
              if (activeLanes[ticket.room] === null) {
                activeLanes[ticket.room] = ticket;
              }
            });
          }
          renderLanes();
          renderWaitingGrid();

        } else if (data.type === 'TICKET_CREATED') {
          // Push new ticket directly to waiting list immediately!
          const ticket = data.ticket;
          // Check if already in queue to prevent duplicates
          if (!waitingQueue.some(q => q.id === ticket.id)) {
            waitingQueue.push(ticket);
            waitingCountTag.textContent = `${waitingQueue.length} ta`;
            renderWaitingGrid();
          }

        } else if (data.type === 'TICKET_CALLED') {
          // Queue the called event for audio and shift animations
          announcementQueue.push(data.ticket);
          processQueue();

        } else if (data.type === 'QUEUE_CHANGED') {
          // Sync waiting list, active servings, and branding settings
          loadBranding();
          loadMonitorState().then(() => {
            renderLanes();
            renderWaitingGrid();
          });
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 3000); // Reconnect
    };
  }

  // Pre-fetch voices
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }

  initMonitor().then(() => {
    connectWebSocket();
  });
});
