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
          <td><span class="badge-room" style="background: var(--bg-tertiary); border: 1px solid var(--glass-border);">${dir.code}</span></td>
          <td>${dir.room}-xona</td>
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
    const room = parseInt(directionRoomInput.value);

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

  // Open operator modal (Add / Edit)
  function openOperatorModal(op = null) {
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

    const url = id ? `/api/admin/operators/${id}` : '/api/admin/operators';
    const method = id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, room })
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
