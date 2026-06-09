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
  const activeCallBox = document.getElementById('active-call-box');
  const activeCode = document.getElementById('active-code');
  const activeRoom = document.getElementById('active-room');
  const activeDirection = document.getElementById('active-direction');
  const historyListContainer = document.getElementById('history-list-container');

  let socket = null;
  let activeTicket = null;
  let callHistory = [];
  let announcementQueue = [];
  let isSpeaking = false;

  // Initialize and load state
  async function loadInitialState() {
    try {
      const response = await fetch('/api/monitor/state');
      if (!response.ok) throw new Error('Dastlabki holatni yuklab bo\'lmadi');
      const state = await response.json();
      updateUI(state.called);
    } catch (err) {
      console.error(err);
    }
  }

  // Update UI components with data
  function updateUI(calledTickets) {
    if (calledTickets && calledTickets.length > 0) {
      // The first ticket is the most recently called
      const latest = calledTickets[0];
      activeTicket = latest;
      
      activeCode.textContent = latest.ticket_code;
      activeRoom.textContent = `${latest.room}-xona`;
      activeDirection.textContent = latest.direction_name;

      // Rest are history
      callHistory = calledTickets.slice(1);
    } else {
      activeCode.textContent = '- - -';
      activeRoom.textContent = '- - -';
      activeDirection.textContent = 'Kuting, navbat chaqiriladi...';
      callHistory = [];
    }

    renderHistory();
  }

  // Render history rows
  function renderHistory() {
    historyListContainer.innerHTML = '';
    if (callHistory.length === 0) {
      historyListContainer.innerHTML = `
        <div style="text-align: center; padding: 4rem; color: var(--text-muted); font-size: 1.2rem;">
          Navbat tarixi bo'sh
        </div>
      `;
      return;
    }

    callHistory.forEach(ticket => {
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `
        <div>
          <div class="history-code">${ticket.ticket_code}</div>
          <div class="history-direction">${ticket.direction_name}</div>
        </div>
        <div class="history-room">${ticket.room}-xona</div>
      `;
      historyListContainer.appendChild(row);
    });
  }

  // Synthesize a beautiful Ding-Dong sound using Web Audio API
  function playDingDong() {
    return new Promise((resolve) => {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return resolve();
        const ctx = new AudioContext();

        const playTone = (freq, startTime, duration, type = 'sine') => {
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
        // Ding (G5) -> Dong (E5)
        playTone(783.99, now, 0.8, 'triangle');       // G5
        playTone(659.25, now + 0.45, 1.2, 'triangle');  // E5

        setTimeout(resolve, 1800); // Wait for chime to decay
      } catch (e) {
        console.error(e);
        resolve();
      }
    });
  }

  // Autoplay activation overlay handler
  document.addEventListener('click', () => {
    const overlay = document.getElementById('autoplay-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.style.display = 'none', 300);
    }
    // Warm up/resume AudioContext on user interaction
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const tempCtx = new AudioContext();
        if (tempCtx.state === 'suspended') {
          tempCtx.resume();
        }
      }
    } catch (e) {
      console.error('Error warming up audio context:', e);
    }
  });

  // Uzbek Text-to-Speech using Web Speech API
  function speakAnnouncement(ticket) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported in this browser.');
        return resolve();
      }

      let resolved = false;
      const safeResolve = () => {
        if (!resolved) {
          resolved = true;
          resolve();
        }
      };

      // Failsafe timeout: if speech gets blocked or takes too long, continue anyway
      const failsafeTimeout = setTimeout(() => {
        console.warn('Speech announcement timed out. Failsafe triggered.');
        safeResolve();
      }, 7000);

      // Convert letter codes into friendly phonetic pronunciation
      const letterCode = ticket.direction_code.toUpperCase();
      let letterPronunciation = letterCode;
      
      const letterMapping = {
        'A': 'A', 'B': 'B', 'C': 'S', 'D': 'D', 'E': 'E', 'F': 'F',
        'G': 'G', 'H': 'H', 'I': 'I', 'J': 'J', 'K': 'K', 'L': 'L'
      };
      
      if (letterMapping[letterCode]) {
        letterPronunciation = letterMapping[letterCode];
      }

      // Voice text in Uzbek
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

      utterance.onerror = (e) => {
        console.error('Speech error:', e);
        clearTimeout(failsafeTimeout);
        safeResolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  // Process the queue of announcements one by one
  async function processQueue() {
    if (isSpeaking || announcementQueue.length === 0) return;
    
    isSpeaking = true;
    const ticket = announcementQueue.shift();

    // 1. Shift UI immediately to make it visually responsive
    // Fetch current state from API first to synchronize history
    await loadInitialState();

    // Add flashing animation
    activeCallBox.classList.add('flashing');

    // 2. Play chime sound
    await playDingDong();

    // 3. Speak the ticket
    await speakAnnouncement(ticket);

    // Keep flashing a little longer, then remove
    setTimeout(() => {
      activeCallBox.classList.remove('flashing');
      isSpeaking = false;
      // Process next in line
      processQueue();
    }, 1500);
  }

  // WebSocket connection
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    socket = new WebSocket(`${protocol}//${host}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'INITIAL_STATE') {
          updateUI(data.state.called);
        } else if (data.type === 'TICKET_CALLED') {
          // Push to announcement queue
          announcementQueue.push(data.ticket);
          processQueue();
        } else if (data.type === 'QUEUE_CHANGED') {
          // Just reload history, don't trigger announcements
          loadInitialState();
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    socket.onclose = () => {
      setTimeout(connectWebSocket, 3000); // Reconnect
    };
  }

  // Initialize SpeechSynthesis loading voices (Chrome issue helper)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }

  loadInitialState();
  connectWebSocket();
});
