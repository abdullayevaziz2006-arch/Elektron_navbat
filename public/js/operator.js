document.addEventListener('DOMContentLoaded', () => {
  // Navigation elements
  const loginPanel = document.getElementById('login-panel');
  const operatorPanel = document.getElementById('operator-panel');

  // Login form elements
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Console displays
  const operatorNameDisplay = document.getElementById('operator-name-display');
  const operatorRoomBadge = document.getElementById('operator-room-badge');
  const operatorAvatar = document.getElementById('operator-avatar');
  const currentTicketCode = document.getElementById('current-ticket-code');
  const currentTicketDetails = document.getElementById('current-ticket-details');

  // Action buttons
  const nextBtn = document.getElementById('next-btn');
  const recallBtn = document.getElementById('recall-btn');
  const skipBtn = document.getElementById('skip-btn');
  const completeBtn = document.getElementById('complete-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // Waiting list container
  const waitingListContainer = document.getElementById('waiting-list-container');
  const waitingCountBadge = document.getElementById('waiting-count-badge');

  // Statistics displays
  const statServed = document.getElementById('stat-served');
  const statSkipped = document.getElementById('stat-skipped');
  const statAvgWait = document.getElementById('stat-avg-wait');

  let currentOperator = null;
  let activeTicket = null;
  let socket = null;

  // Load dynamic branding settings
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
        let themeVal = settings.op_theme || settings.theme || 'modern-dark';
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

        // 4. Inject style variables dynamically
        Object.keys(settings).forEach(key => {
          if (key.startsWith('css_')) {
            const varName = `--` + key.replace('css_', '').replace(/_/g, '-');
            document.body.style.setProperty(varName, settings[key]);
          }
        });

        // 5. Scope operator-specific overrides
        if (settings.css_op_bg_primary) document.body.style.setProperty('--bg-primary', settings.css_op_bg_primary);
        if (settings.css_op_bg_secondary) {
          document.body.style.setProperty('--bg-secondary', settings.css_op_bg_secondary);
          document.body.style.setProperty('--bg-color-2', settings.css_op_bg_secondary);
        }
        if (settings.css_op_text_primary) document.body.style.setProperty('--text-primary', settings.css_op_text_primary);
        if (settings.css_op_text_secondary) document.body.style.setProperty('--text-secondary', settings.css_op_text_secondary);

        // 6. Inject custom CSS
        let styleTag = document.getElementById('operator-custom-css-tag');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'operator-custom-css-tag';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = settings.custom_css || '';
      }
    } catch (err) {
      console.error('Error loading branding settings:', err);
    }
  }

  // Load branding
  loadBranding();

  // Check login state on startup
  const savedOperator = localStorage.getItem('operator');
  if (savedOperator) {
    currentOperator = JSON.parse(savedOperator);
    showConsole();
  } else {
    showLogin();
  }

  // Handle Login form submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Kirib bo\'lmadi');
      }

      const data = await response.json();
      currentOperator = data.operator;
      localStorage.setItem('operator', JSON.stringify(currentOperator));
      
      usernameInput.value = '';
      passwordInput.value = '';
      
      showConsole();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Handle Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('operator');
    localStorage.removeItem('activeTicket');
    currentOperator = null;
    activeTicket = null;
    if (socket) socket.close();
    showLogin();
  });

  // Show Login Screen
  function showLogin() {
    loginPanel.style.display = 'block';
    operatorPanel.style.display = 'none';
  }

  // Show Console Screen
  function showConsole() {
    loginPanel.style.display = 'none';
    operatorPanel.style.display = 'block';

    // Update headers
    operatorNameDisplay.textContent = currentOperator.username;
    operatorRoomBadge.textContent = `${currentOperator.room}-xonaga yo'naltirilgan`;
    operatorAvatar.textContent = currentOperator.username.substring(0, 2).toUpperCase();

    // Check if there was an active ticket saved
    const savedActiveTicket = localStorage.getItem('activeTicket');
    if (savedActiveTicket) {
      activeTicket = JSON.parse(savedActiveTicket);
      updateActiveTicketUI();
    } else {
      clearActiveTicketUI();
    }

    // Connect WebSocket
    connectWebSocket();

    // Load static data
    loadWaitingList();
    loadStats();
  }

  // WebSocket Connection
  function connectWebSocket() {
    if (socket) socket.close();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    socket = new WebSocket(`${protocol}//${host}`);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TICKET_CREATED' || data.type === 'QUEUE_CHANGED' || data.type === 'TICKET_CALLED') {
          loadWaitingList();
          loadStats();
          if (data.type === 'QUEUE_CHANGED') {
            loadBranding();
          }
        }
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };

    socket.onclose = () => {
      // Auto reconnect
      if (currentOperator) {
        setTimeout(connectWebSocket, 3000);
      }
    };
  }

  // Load Waiting list filtered by operator room directions
  async function loadWaitingList() {
    try {
      const response = await fetch(`/api/operator/queue?operator_id=${currentOperator.id}`);
      if (!response.ok) throw new Error('Kutish ro\'yxatini yuklab bo\'lmadi');
      const queue = await response.json();

      const myQueue = queue;

      waitingCountBadge.textContent = `${myQueue.length} ta talaba`;

      waitingListContainer.innerHTML = '';
      if (myQueue.length === 0) {
        waitingListContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
            Kutayotganlar yo'q
          </div>
        `;
        return;
      }

      myQueue.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'queue-item';
        
        // Calculate waiting duration in minutes
        const waitMs = new Date() - new Date(item.created_at);
        const waitMins = Math.floor(waitMs / 60000);

        itemEl.innerHTML = `
          <div>
            <div class="queue-item-code">${item.direction_code}${item.number}</div>
            <div class="queue-item-name">${item.direction_name}</div>
          </div>
          <div class="queue-item-time">${waitMins} daqiqa kutmoqda</div>
        `;
        waitingListContainer.appendChild(itemEl);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Load Operator stats
  async function loadStats() {
    try {
      const response = await fetch(`/api/operator/stats?room=${currentOperator.room}`);
      if (!response.ok) throw new Error('Statistikani yuklab bo\'lmadi');
      const stats = await response.json();

      statServed.textContent = stats.served;
      statSkipped.textContent = stats.skipped;
      statAvgWait.textContent = stats.avgWaitMinutes > 0 ? `${stats.avgWaitMinutes}m` : `${stats.avgWaitSeconds}s`;
    } catch (err) {
      console.error(err);
    }
  }

  // Update UI for active ticket
  function updateActiveTicketUI() {
    currentTicketCode.textContent = activeTicket.ticket_code;
    currentTicketDetails.textContent = `${activeTicket.direction_name} yo'nalishi bo'yicha talaba`;
    
    // Enable controls
    recallBtn.disabled = false;
    skipBtn.disabled = false;
    completeBtn.disabled = false;
    
    // Disable Call Next
    nextBtn.disabled = true;
  }

  // Clear UI for active ticket
  function clearActiveTicketUI() {
    currentTicketCode.textContent = '- - -';
    currentTicketDetails.textContent = 'Qabul qilishni boshlash uchun "KEYINGI" tugmasini bosing';
    
    // Disable controls
    recallBtn.disabled = true;
    skipBtn.disabled = true;
    completeBtn.disabled = true;
    
    // Enable Call Next
    nextBtn.disabled = false;
  }

  // Call Next Ticket Action
  nextBtn.addEventListener('click', async () => {
    try {
      const response = await fetch('/api/operator/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operator_id: currentOperator.id,
          room: currentOperator.room
        })
      });

      if (!response.ok) throw new Error('Chaqiruv amalga oshmadi');
      const data = await response.json();

      if (data.success && data.ticket) {
        activeTicket = data.ticket;
        localStorage.setItem('activeTicket', JSON.stringify(activeTicket));
        updateActiveTicketUI();
        loadWaitingList();
        loadStats();
      } else {
        alert(data.message || 'Kutish ro\'yxatida talabalar yo\'q');
      }
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Re-Call Buzz Action
  recallBtn.addEventListener('click', async () => {
    if (!activeTicket) return;
    try {
      const response = await fetch('/api/operator/recall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: activeTicket.id })
      });
      if (!response.ok) throw new Error('Qayta chaqirib bo\'lmadi');
      // Monitor WebSocket will play announcement again
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Complete Ticket Action
  completeBtn.addEventListener('click', async () => {
    if (!activeTicket) return;
    try {
      const response = await fetch('/api/operator/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: activeTicket.id })
      });
      if (!response.ok) throw new Error('Qabulni yakunlab bo\'lmadi');
      
      activeTicket = null;
      localStorage.removeItem('activeTicket');
      clearActiveTicketUI();
      loadWaitingList();
      loadStats();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  // Skip Ticket Action
  skipBtn.addEventListener('click', async () => {
    if (!activeTicket) return;
    try {
      const response = await fetch('/api/operator/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: activeTicket.id })
      });
      if (!response.ok) throw new Error('O\'tkazib yuborish amalga oshmadi');
      
      activeTicket = null;
      localStorage.removeItem('activeTicket');
      clearActiveTicketUI();
      loadWaitingList();
      loadStats();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

});
