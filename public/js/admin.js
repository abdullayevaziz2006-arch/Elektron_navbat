document.addEventListener('DOMContentLoaded', () => {
  // Sidebar tab switching
  const menuItems = document.querySelectorAll('.menu-item');
  const tabPanels = document.querySelectorAll('.tab-panel');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-target');
      if (!target) return; // Skip if it's the exit button

      menuItems.forEach(mi => mi.classList.remove('active'));
      tabPanels.forEach(tp => tp.style.display = 'none');

      item.classList.add('active');
      document.getElementById(target).style.display = 'block';

      // Load data for the active tab
      if (target === 'tab-directions') loadDirections();
      if (target === 'tab-operators') loadOperators();
      if (target === 'tab-history') loadHistory();
      if (target === 'tab-settings') loadSettings();
    });
  });

  // Settings sub-tab switching
  const subTabBtns = document.querySelectorAll('.sub-tab-btn');
  const settingsSubPanels = document.querySelectorAll('.settings-sub-panel');

  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetSub = btn.getAttribute('data-sub');
      
      subTabBtns.forEach(b => b.classList.remove('active'));
      settingsSubPanels.forEach(p => p.style.display = 'none');
      
      btn.classList.add('active');
      document.getElementById(targetSub).style.display = 'block';
    });
  });

  // --- Directions Elements & CRUD ---
  const tableDirectionsBody = document.getElementById('table-directions-body');
  const btnAddDirection = document.getElementById('btn-add-direction');
  const modalDirection = document.getElementById('modal-direction');
  const modalDirectionClose = document.getElementById('modal-direction-close');
  const formDirection = document.getElementById('form-direction');
  const modalDirectionTitle = document.getElementById('modal-direction-title');
  
  const directionIdInput = document.getElementById('direction-id');
  const directionNameInput = document.getElementById('direction-name');
  const directionCodeInput = document.getElementById('direction-code');
  const directionRoomInput = document.getElementById('direction-room');

  // Load directions
  async function loadDirections() {
    try {
      const response = await fetch('/api/directions');
      if (!response.ok) throw new Error('Yo\'nalishlarni yuklashda xatolik');
      const directions = await response.json();

      tableDirectionsBody.innerHTML = '';
      if (directions.length === 0) {
        tableDirectionsBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">
              Yo'nalishlar mavjud emas. Yangi yo'nalish qo'shing.
            </td>
          </tr>
        `;
        return;
      }

      directions.forEach(dir => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${dir.id}</td>
          <td><strong>${dir.name}</strong></td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-edit-dir" data-id="${dir.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-right: 0.5rem;">Tahrirlash</button>
            <button class="btn btn-danger btn-delete-dir" data-id="${dir.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">O'chirish</button>
          </td>
        `;

        // Attach buttons listeners
        tr.querySelector('.btn-edit-dir').addEventListener('click', () => openDirectionModal(dir));
        tr.querySelector('.btn-delete-dir').addEventListener('click', () => deleteDirection(dir.id));
        
        tableDirectionsBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Open direction modal (Add / Edit)
  function openDirectionModal(dir = null) {
    if (dir) {
      modalDirectionTitle.textContent = 'Yo\'nalishni Tahrirlash';
      directionIdInput.value = dir.id;
      directionNameInput.value = dir.name;
      directionCodeInput.value = dir.code;
      directionRoomInput.value = dir.room;
    } else {
      modalDirectionTitle.textContent = 'Yangi Yo\'nalish Qo\'shish';
      directionIdInput.value = '';
      formDirection.reset();
    }
    modalDirection.classList.add('active');
  }

  modalDirectionClose.addEventListener('click', () => modalDirection.classList.remove('active'));

  formDirection.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = directionIdInput.value;
    const name = directionNameInput.value.trim();
    const code = directionCodeInput.value.trim().toUpperCase();
    const roomVal = directionRoomInput.value.trim();
    const room = roomVal !== '' ? parseInt(roomVal) : null;

    const url = id ? `/api/admin/directions/${id}` : '/api/admin/directions';
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, room })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Yo\'nalishni saqlab bo\'lmadi');
      }

      modalDirection.classList.remove('active');
      loadDirections();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  async function deleteDirection(id) {
    if (!confirm('Haqiqatdan ham ushbu yo\'nalishni o\'chirmoqchimisiz?')) return;
    try {
      const response = await fetch(`/api/admin/directions/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Yo\'nalishni o\'chirib bo\'lmadi');
      loadDirections();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  }

  btnAddDirection.addEventListener('click', () => openDirectionModal());

  // --- Operators Elements & CRUD ---
  const tableOperatorsBody = document.getElementById('table-operators-body');
  const btnAddOperator = document.getElementById('btn-add-operator');
  const modalOperator = document.getElementById('modal-operator');
  const modalOperatorClose = document.getElementById('modal-operator-close');
  const formOperator = document.getElementById('form-operator');
  const modalOperatorTitle = document.getElementById('modal-operator-title');
  const labelPassword = document.getElementById('label-password');
  const operatorPwHint = document.getElementById('operator-pw-hint');

  const operatorIdInput = document.getElementById('operator-id');
  const operatorUsernameInput = document.getElementById('operator-username');
  const operatorPasswordInput = document.getElementById('operator-password');
  const operatorRoomInput = document.getElementById('operator-room');

  // Load operators
  async function loadOperators() {
    try {
      const response = await fetch('/api/admin/operators');
      if (!response.ok) throw new Error('Operatorlarni yuklashda xatolik');
      const operators = await response.json();

      tableOperatorsBody.innerHTML = '';
      if (operators.length === 0) {
        tableOperatorsBody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
              Operatorlar mavjud emas. Yangi operator qo'shing.
            </td>
          </tr>
        `;
        return;
      }

      operators.forEach(op => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${op.id}</td>
          <td><strong>${op.username}</strong></td>
          <td>${op.room}-xona</td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-edit-op" data-id="${op.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; margin-right: 0.5rem;">Tahrirlash</button>
            <button class="btn btn-danger btn-delete-op" data-id="${op.id}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem;">O'chirish</button>
          </td>
        `;

        // Attach buttons listeners
        tr.querySelector('.btn-edit-op').addEventListener('click', () => openOperatorModal(op));
        tr.querySelector('.btn-delete-op').addEventListener('click', () => deleteOperator(op.id));

        tableOperatorsBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Load directions as checkboxes inside Operator Modal
  async function loadDirectionCheckboxes() {
    const container = document.getElementById('operator-directions-checkboxes');
    if (!container) return;

    try {
      const response = await fetch('/api/directions');
      if (!response.ok) throw new Error('Yo\'nalishlarni yuklab bo\'lmadi');
      const directions = await response.json();

      container.innerHTML = '';
      if (directions.length === 0) {
        container.innerHTML = `<span style="color: var(--text-muted); font-size: 0.8rem;">Yo'nalishlar mavjud emas</span>`;
        return;
      }

      directions.forEach(dir => {
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '0.5rem';
        label.style.cursor = 'pointer';
        label.style.fontSize = '0.85rem';
        label.style.color = 'var(--text-secondary)';
        label.innerHTML = `
          <input type="checkbox" value="${dir.id}" class="operator-direction-checkbox">
          <span>[${dir.code}] ${dir.name}</span>
        `;
        container.appendChild(label);
      });
    } catch (err) {
      console.error(err);
      container.innerHTML = `<span style="color: var(--color-danger); font-size: 0.8rem;">Yuklashda xatolik yuz berdi</span>`;
    }
  }

  // Open operator modal (Add / Edit)
  async function openOperatorModal(op = null) {
    // 1. First render checkboxes
    await loadDirectionCheckboxes();

    if (op) {
      modalOperatorTitle.textContent = 'Operatorni Tahrirlash';
      operatorIdInput.value = op.id;
      operatorUsernameInput.value = op.username;
      operatorPasswordInput.value = '';
      operatorRoomInput.value = op.room;

      // Make password optional for edits
      operatorPasswordInput.required = false;
      labelPassword.textContent = 'Yangi parol (ixtiyoriy)';
      operatorPwHint.style.display = 'block';

      // 2. Fetch and check mapped direction checkboxes
      try {
        const res = await fetch(`/api/admin/operators/${op.id}/directions`);
        if (res.ok) {
          const assignedIds = await res.json();
          const checkboxes = document.querySelectorAll('.operator-direction-checkbox');
          checkboxes.forEach(cb => {
            if (assignedIds.includes(parseInt(cb.value))) {
              cb.checked = true;
            }
          });
        }
      } catch (err) {
        console.error('Error fetching operator directions:', err);
      }
    } else {
      modalOperatorTitle.textContent = 'Yangi Operator Qo\'shish';
      operatorIdInput.value = '';
      formOperator.reset();

      // Make password required for additions
      operatorPasswordInput.required = true;
      labelPassword.textContent = 'Parol';
      operatorPwHint.style.display = 'none';
    }
    modalOperator.classList.add('active');
  }

  modalOperatorClose.addEventListener('click', () => modalOperator.classList.remove('active'));

  formOperator.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = operatorIdInput.value;
    const username = operatorUsernameInput.value.trim();
    const password = operatorPasswordInput.value;
    const room = parseInt(operatorRoomInput.value);

    // Collect checked direction checkboxes
    const checkboxes = document.querySelectorAll('.operator-direction-checkbox');
    const directionIds = Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => parseInt(cb.value));

    if (directionIds.length === 0) {
      alert('Iltimos, operator uchun kamida bitta yo\'nalishni tanlang.');
      return;
    }

    const url = id ? `/api/admin/operators/${id}` : '/api/admin/operators';
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, room, directionIds })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Operatorni saqlab bo\'lmadi');
      }

      modalOperator.classList.remove('active');
      loadOperators();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  });

  async function deleteOperator(id) {
    if (!confirm('Haqiqatdan ham ushbu operatorni o\'chirmoqchimisiz?')) return;
    try {
      const response = await fetch(`/api/admin/operators/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Operatorni o\'chirib bo\'lmadi');
      loadOperators();
    } catch (err) {
      alert(`Xatolik: ${err.message}`);
    }
  }

  btnAddOperator.addEventListener('click', () => openOperatorModal());

  // --- Queue History Tab ---
  const tableHistoryBody = document.getElementById('table-history-body');
  const btnExportCsv = document.getElementById('btn-export-csv');
  let historyData = [];

  async function loadHistory() {
    try {
      const response = await fetch('/api/admin/history');
      if (!response.ok) throw new Error('Tarixni yuklashda xatolik');
      historyData = await response.json();

      tableHistoryBody.innerHTML = '';
      if (historyData.length === 0) {
        tableHistoryBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
              Hozircha navbat tarixi mavjud emas.
            </td>
          </tr>
        `;
        return;
      }

      historyData.forEach(item => {
        const tr = document.createElement('tr');

        // Status badge colors
        let statusBadge = '';
        if (item.status === 'completed') {
          statusBadge = `<span class="badge-room" style="background: rgba(16, 185, 129, 0.15); color: var(--color-success); border: 1px solid rgba(16, 185, 129, 0.3);">Bajarildi</span>`;
        } else if (item.status === 'skipped') {
          statusBadge = `<span class="badge-room" style="background: rgba(239, 68, 68, 0.15); color: var(--color-danger); border: 1px solid rgba(239, 68, 68, 0.3);">Kelmagan</span>`;
        } else if (item.status === 'called') {
          statusBadge = `<span class="badge-room" style="background: rgba(245, 158, 11, 0.15); color: var(--color-accent); border: 1px solid rgba(245, 158, 11, 0.3);">Chaqirilgan</span>`;
        } else {
          statusBadge = `<span class="badge-room" style="background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); border: 1px solid rgba(148, 163, 184, 0.3);">Kutilmoqda</span>`;
        }

        // Dates formatting
        const createdDate = new Date(item.created_at);
        const createdTimeStr = createdDate.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

        // Calculate waiting duration in minutes if called
        let waitMins = '-';
        if (item.called_at) {
          const waitMs = new Date(item.called_at) - createdDate;
          waitMins = Math.round(waitMs / 60000);
        }

        tr.innerHTML = `
          <td><strong>${item.direction_code}${item.number}</strong></td>
          <td>${item.direction_name}</td>
          <td>${createdTimeStr}</td>
          <td>${statusBadge}</td>
          <td>${item.operator_username || '-'}</td>
          <td>${item.room}-xona</td>
          <td>${waitMins}</td>
        `;

        tableHistoryBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
    }
  }

  // Client-side CSV download
  btnExportCsv.addEventListener('click', () => {
    if (historyData.length === 0) {
      alert('Eksport qilish uchun ma\'lumot yo\'q');
      return;
    }

    // Headers
    const headers = [
      'Chipta kodi', 'Yo\'nalish', 'Yaratilgan vaqt', 
      'Chaqirilgan vaqt', 'Yakunlangan vaqt', 'Status', 
      'Operator', 'Xona', 'Kutish vaqti (daqiqa)'
    ];

    const rows = historyData.map(item => {
      const created = item.created_at ? new Date(item.created_at).toLocaleString('uz-UZ') : '';
      const called = item.called_at ? new Date(item.called_at).toLocaleString('uz-UZ') : '';
      const completed = item.completed_at ? new Date(item.completed_at).toLocaleString('uz-UZ') : '';
      
      let waitMins = 0;
      if (item.called_at && item.created_at) {
        const diff = new Date(item.called_at) - new Date(item.created_at);
        waitMins = Math.round(diff / 60000);
      }

      // Escape quotes and fields containing commas
      return [
        `"${item.direction_code}${item.number}"`,
        `"${item.direction_name}"`,
        `"${created}"`,
        `"${called}"`,
        `"${completed}"`,
        `"${item.status}"`,
        `"${item.operator_username || ''}"`,
        `"${item.room}"`,
        `"${waitMins}"`
      ];
    });

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    // Add UTF-8 BOM to make Excel render Uzbek letters correctly
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create download link
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `navbat_tarixi_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // --- Settings Tab ---
  const formSettings = document.getElementById('form-settings');
  const settingsOrgName = document.getElementById('settings-org-name');
  const settingsLogoMain = document.getElementById('settings-logo-main');
  const settingsLogoSub = document.getElementById('settings-logo-sub');
  const settingsBrandColor = document.getElementById('settings-brand-color');
  const settingsBrandColorHex = document.getElementById('settings-brand-color-hex');
  const settingsKioskTheme = document.getElementById('settings-kiosk-theme');
  const settingsMonitorTheme = document.getElementById('settings-monitor-theme');
  const settingsOpTheme = document.getElementById('settings-op-theme');
  const settingsAdminTheme = document.getElementById('settings-admin-theme');
  const settingsLogoFile = document.getElementById('settings-logo-file');
  const settingsLogoImg = document.getElementById('settings-logo-img');
  const settingsLogoPreviewContainer = document.getElementById('settings-logo-preview-container');
  const settingsLogoPreview = document.getElementById('settings-logo-preview');
  const btnResetLogo = document.getElementById('btn-reset-logo');
  const settingsBgFile = document.getElementById('settings-bg-file');
  const settingsBgImg = document.getElementById('settings-bg-img');
  const settingsBgPreviewContainer = document.getElementById('settings-bg-preview-container');
  const btnResetBg = document.getElementById('btn-reset-bg');
  const settingsKioskTitle = document.getElementById('settings-kiosk-title');
  const settingsMonitorTitle = document.getElementById('settings-monitor-title');
  const settingsCustomCss = document.getElementById('settings-custom-css');

  // Helper to compress image and convert to Base64
  function processAndCompressImage(file, maxDimension = 800) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (file.type === 'image/svg+xml') {
          return resolve(reader.result);
        }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% quality
        };
        img.onerror = () => reject(new Error('Rasm yuklashda xatolik'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Faylni o\'qib bo\'lmadi'));
      reader.readAsDataURL(file);
    });
  }

  // Handle Logo file upload
  if (settingsLogoFile) {
    settingsLogoFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await processAndCompressImage(file, 400); // logo size limit
        settingsLogoImg.value = base64;
        settingsLogoPreview.src = base64;
        settingsLogoPreviewContainer.style.display = 'flex';
      } catch (err) {
        alert(err.message);
        settingsLogoFile.value = '';
      }
    });
  }

  // Handle Logo reset
  if (btnResetLogo) {
    btnResetLogo.addEventListener('click', () => {
      settingsLogoImg.value = '';
      settingsLogoFile.value = '';
      settingsLogoPreviewContainer.style.display = 'none';
      settingsLogoPreview.src = '';
    });
  }

  // Handle Background file upload
  if (settingsBgFile) {
    settingsBgFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const base64 = await processAndCompressImage(file, 1024); // bg size limit
        settingsBgImg.value = base64;
        settingsBgPreviewContainer.style.display = 'flex';
      } catch (err) {
        alert(err.message);
        settingsBgFile.value = '';
      }
    });
  }

  // Handle Background reset
  if (btnResetBg) {
    btnResetBg.addEventListener('click', () => {
      settingsBgImg.value = '';
      settingsBgFile.value = '';
      settingsBgPreviewContainer.style.display = 'none';
    });
  }

  // Sync color picker with HEX input text
  if (settingsBrandColor && settingsBrandColorHex) {
    settingsBrandColor.addEventListener('input', (e) => {
      settingsBrandColorHex.value = e.target.value;
    });
    settingsBrandColorHex.addEventListener('input', (e) => {
      const val = e.target.value;
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        settingsBrandColor.value = val;
      }
    });
  }

  async function loadSettings() {
    try {
      const response = await fetch('/api/settings');
      if (!response.ok) throw new Error('Sozlamalarni yuklab bo\'lmadi');
      const settings = await response.json();
 
      if (settings) {
        if (settingsOrgName) settingsOrgName.value = settings.org_name || '';
        if (settingsLogoMain) settingsLogoMain.value = settings.logo_main || '';
        if (settingsLogoSub) settingsLogoSub.value = settings.logo_sub || '';
        if (settingsBrandColor) {
          settingsBrandColor.value = settings.brand_color || '#e60000';
          settingsBrandColorHex.value = settings.brand_color || '#e60000';
        }
        const parseTheme = (val) => {
          let themeVal = val || 'modern-dark';
          if (themeVal === 'theme-glass-neon') themeVal = 'modern-dark';
          if (themeVal === 'theme-elegant-light') themeVal = 'light-mode';
          if (themeVal === 'theme-royal-gold') themeVal = 'minimalist-slate';
          return themeVal;
        };
        if (settingsKioskTheme) settingsKioskTheme.value = parseTheme(settings.kiosk_theme);
        if (settingsMonitorTheme) settingsMonitorTheme.value = parseTheme(settings.monitor_theme);
        if (settingsOpTheme) settingsOpTheme.value = parseTheme(settings.op_theme);
        if (settingsAdminTheme) settingsAdminTheme.value = parseTheme(settings.admin_theme || settings.theme);
        if (settingsKioskTitle) settingsKioskTitle.value = settings.kiosk_title || '';
        if (settingsMonitorTitle) settingsMonitorTitle.value = settings.monitor_title || '';
        if (settingsCustomCss) settingsCustomCss.value = settings.custom_css || '';
 
        // Load CSS Style Editor values
        const styleKeys = [
          'kiosk_bg_primary', 'kiosk_bg_secondary', 'kiosk_text_primary', 'kiosk_text_secondary',
          'monitor_bg_primary', 'monitor_text_primary', 'monitor_text_secondary',
          'op_bg_primary', 'op_bg_secondary', 'op_text_primary', 'op_text_secondary',
          'admin_bg_primary', 'admin_bg_secondary', 'admin_text_primary', 'admin_text_secondary',
          'radius_sm', 'radius_md', 'kiosk_columns', 'kiosk_btn_padding'
        ];
        
        styleKeys.forEach(sKey => {
          const inputEl = document.getElementById(`css-${sKey.replace(/_/g, '-')}`);
          if (inputEl) {
            let defaultValue = '';
            if (sKey.includes('bg_primary')) defaultValue = '#020617';
            if (sKey.includes('bg_secondary')) defaultValue = '#0f172a';
            if (sKey.includes('text_primary')) defaultValue = '#f8fafc';
            if (sKey.includes('text_secondary')) defaultValue = '#94a3b8';
            if (sKey === 'radius_sm') defaultValue = '8px';
            if (sKey === 'radius_md') defaultValue = '16px';
            if (sKey === 'kiosk_columns') defaultValue = 'repeat(auto-fit, minmax(320px, 1fr))';
            if (sKey === 'kiosk_btn_padding') defaultValue = '2.5rem 1.5rem';

            inputEl.value = settings[`css_${sKey}`] || defaultValue;
          }
        });
 
        // Apply style variables to current admin panel dynamically
        if (settings.css_admin_bg_primary) document.body.style.setProperty('--bg-primary', settings.css_admin_bg_primary);
        if (settings.css_admin_bg_secondary) document.body.style.setProperty('--bg-secondary', settings.css_admin_bg_secondary);
        if (settings.css_admin_text_primary) document.body.style.setProperty('--text-primary', settings.css_admin_text_primary);
        if (settings.css_admin_text_secondary) document.body.style.setProperty('--text-secondary', settings.css_admin_text_secondary);
        if (settings.css_radius_sm) document.body.style.setProperty('--radius-sm', settings.css_radius_sm);
        if (settings.css_radius_md) document.body.style.setProperty('--radius-md', settings.css_radius_md);
 
        // Handle logo image preview
        if (settings.logo_img && settings.logo_img !== '') {
          settingsLogoImg.value = settings.logo_img;
          settingsLogoPreview.src = settings.logo_img;
          settingsLogoPreviewContainer.style.display = 'flex';
        } else {
          settingsLogoImg.value = '';
          settingsLogoPreviewContainer.style.display = 'none';
          settingsLogoPreview.src = '';
        }
 
        // Handle bg image preview
        if (settings.bg_img && settings.bg_img !== '') {
          settingsBgImg.value = settings.bg_img;
          settingsBgPreviewContainer.style.display = 'flex';
        } else {
          settingsBgImg.value = '';
          settingsBgPreviewContainer.style.display = 'none';
        }
 
        // Live inject custom CSS in admin panel
        let styleTag = document.getElementById('admin-custom-css-tag');
        if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = 'admin-custom-css-tag';
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = settings.custom_css || '';
 
        // Apply theme class to admin body
        document.body.className = '';
        let themeClass = settings.admin_theme || settings.theme || 'theme-glass-neon';
        if (themeClass === 'modern-dark') themeClass = 'theme-glass-neon';
        if (themeClass === 'light-mode') themeClass = 'theme-elegant-light';
        if (themeClass === 'minimalist-slate') themeClass = 'theme-royal-gold';
        
        document.body.classList.add(themeClass);
      }
    } catch (err) {
      console.error(err);
      alert('Sozlamalarni yuklashda xatolik yuz berdi');
    }
  }

  if (formSettings) {
    formSettings.addEventListener('submit', async (e) => {
      e.preventDefault();
 
      const payload = {
        org_name: settingsOrgName.value.trim(),
        logo_main: settingsLogoMain.value.trim(),
        logo_sub: settingsLogoSub.value.trim(),
        brand_color: settingsBrandColorHex.value.trim(),
        theme: settingsAdminTheme.value,
        admin_theme: settingsAdminTheme.value,
        kiosk_theme: settingsKioskTheme.value,
        monitor_theme: settingsMonitorTheme.value,
        op_theme: settingsOpTheme.value,
        logo_img: settingsLogoImg.value,
        bg_img: settingsBgImg.value,
        kiosk_title: settingsKioskTitle.value.trim(),
        monitor_title: settingsMonitorTitle.value.trim(),
        custom_css: settingsCustomCss.value
      };
 
      // Collect style editor values
      const styleKeys = [
        'kiosk_bg_primary', 'kiosk_bg_secondary', 'kiosk_text_primary', 'kiosk_text_secondary',
        'monitor_bg_primary', 'monitor_text_primary', 'monitor_text_secondary',
        'op_bg_primary', 'op_bg_secondary', 'op_text_primary', 'op_text_secondary',
        'admin_bg_primary', 'admin_bg_secondary', 'admin_text_primary', 'admin_text_secondary',
        'radius_sm', 'radius_md', 'kiosk_columns', 'kiosk_btn_padding'
      ];
      
      styleKeys.forEach(sKey => {
        const inputEl = document.getElementById(`css-${sKey.replace(/_/g, '-')}`);
        if (inputEl) {
          payload[`css_${sKey}`] = inputEl.value;
        }
      });
 
      try {
        const response = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
 
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Sozlamalarni saqlab bo\'lmadi');
        }
 
        alert('Sozlamalar muvaffaqiyatli saqlandi!');
        loadSettings(); // Reload to apply new styles
      } catch (err) {
        alert(`Xatolik: ${err.message}`);
      }
    });
  }

  // Modal dismissals on overlay click
  [modalDirection, modalOperator].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  // Load initial active tab data
  loadDirections();
});
