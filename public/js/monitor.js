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
  let activeCallingRooms = new Set();

  // Load dynamic settings branding
  async function loadBranding() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
      if (settings) {
        // 1. Set brand color
        const brandColor = settings.brand_color || '#e60000';
        document.body.style.setProperty('--brand-color', brandColor);
        document.body.style.setProperty('--color-primary', brandColor);

        // 2. Set theme class
        document.body.className = '';
        let themeVal = settings.monitor_theme || settings.theme || 'modern-dark';
        if (themeVal && themeVal !== 'modern-dark') {
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

        // 4. Set logo (custom image or text bars logo)
        const logoContainer = document.querySelector('.brand-logo-container');
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
                  logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 120px; max-width: 250px; object-fit: contain;" alt="Logo">`;
                }
              } catch (e) {
                console.error('Failed to inline SVG logo on monitor:', e);
                logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 120px; max-width: 250px; object-fit: contain;" alt="Logo">`;
              }
            } else {
              logoContainer.innerHTML = `<img src="${settings.logo_img}" style="max-height: 120px; max-width: 250px; object-fit: contain;" alt="Logo">`;
            }
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

        // 6. Inject style variables dynamically
        Object.keys(settings).forEach(key => {
          if (key.startsWith('css_')) {
            const varName = `--` + key.replace('css_', '').replace(/_/g, '-');
            document.body.style.setProperty(varName, settings[key]);
          }
        });

        // Scope monitor-specific overrides
        if (settings.css_monitor_bg_primary) {
          document.body.style.setProperty('--bg-primary', settings.css_monitor_bg_primary);
          document.body.style.setProperty('--bg-color-2', settings.css_monitor_bg_primary);
          document.body.style.setProperty('--bg-secondary', settings.css_monitor_bg_primary);
        }
        if (settings.css_monitor_text_primary) document.body.style.setProperty('--text-primary', settings.css_monitor_text_primary);
        if (settings.css_monitor_text_secondary) document.body.style.setProperty('--text-secondary', settings.css_monitor_text_secondary);

        // 7. Inject custom CSS
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

  // Render Lanes (Operators Grid)
  function renderLanes() {
    lanesContainer.innerHTML = '';
    
    operatorRooms.forEach(room => {
      const ticket = activeLanes[room];
      const ticketCode = ticket ? ticket.ticket_code : '—';
      const isCalling = activeCallingRooms.has(room);
      
      const card = document.createElement('div');
      card.id = `operator-card-${room}`;
      
      let cardClasses = 'operator-card bg-white rounded-xl p-md flex justify-between items-center shadow-sm';
      if (isCalling) {
        cardClasses += ' calling border-primary/20 border-2';
      } else {
        cardClasses += ' border-outline-variant border';
      }
      
      if (!ticket) {
        cardClasses += ' opacity-60';
      }
      
      card.className = cardClasses;

      // Handle full width center for last odd item
      const totalCount = operatorRooms.length;
      const index = operatorRooms.indexOf(room);
      if (totalCount % 2 !== 0 && index === totalCount - 1) {
        card.classList.add('col-span-1', 'sm:col-span-2', 'xl:col-span-3', 'max-w-md', 'mx-auto', 'w-full');
      }

      card.innerHTML = `
        <div class="flex flex-col">
          <span class="text-label-sm font-bold text-on-surface-variant uppercase">Operator</span>
          <span class="${ticket ? 'text-monitor-label' : 'text-headline-lg'} font-bold text-on-surface leading-none">${room}</span>
        </div>
        <div class="text-right">
          <span class="text-label-sm font-bold ${ticket ? 'text-primary' : 'text-on-surface-variant'} uppercase">Ticket</span>
          <div class="${ticket ? (isCalling ? 'text-headline-lg font-extrabold text-primary text-glow-red animate-pulse' : 'text-headline-lg font-extrabold text-primary') : 'text-headline-md font-bold text-on-surface'} leading-none">${ticketCode}</div>
        </div>
      `;
      
      lanesContainer.appendChild(card);
    });
  }

  // Render Right Waiting Grid badges
  function renderWaitingGrid() {
    waitingGridContainer.innerHTML = '';
    
    if (waitingQueue.length === 0) {
      waitingGridContainer.innerHTML = `
        <div style="text-align: center; grid-column: 1/-1; padding: 4rem; color: #9ca3af; font-size: 0.95rem;">
          Navbat bo'sh
        </div>
      `;
      return;
    }

    waitingQueue.forEach(ticket => {
      const badge = document.createElement('div');
      badge.className = 'bg-surface-container-low border border-outline-variant rounded-lg p-md text-center';
      badge.innerHTML = `
        <span class="text-headline-md font-bold text-on-surface">${ticket.ticket_code}</span>
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

      const text = `Navbat raqami, ${letterPronunciation} ${ticket.number}. ${ticket.room}-operatorga.`;
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
    
    // 3. Highlight the active operator card that was called
    activeCallingRooms.add(ticket.room);
    renderLanes();
    renderWaitingGrid();

    // 4. Play Ding-Dong chime
    await playDingDong();

    // 5. Speak announcement
    await speakAnnouncement(ticket);

    // Keep flashing a little longer, then clear calling state
    setTimeout(() => {
      activeCallingRooms.delete(ticket.room);
      renderLanes();
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
