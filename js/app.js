/**
 * Wedding Seating Planner — Client-Side App
 * All UI logic, state, navigation, CRUD, and interactions.
 * No server needed — reads/writes localStorage through DS.
 */

(function() {
  'use strict';

  // ── Globals ──
  let currentView = 'dashboard';

  // ── Toast ──
  function toast(msg, type='info', dur=3500) {
    const c = document.getElementById('toastContainer');
    const e = document.createElement('div');
    e.className = `toast toast--${type}`;
    e.textContent = msg;
    c.appendChild(e);
    setTimeout(() => { e.classList.add('toast--remove'); setTimeout(() => e.remove(), 200); }, dur);
  }
  Toast = { success: m => toast(m,'success'), error: m => toast(m,'error',6000), info: m => toast(m,'info') };

  // ── Loading ──
  function showLoad() { document.getElementById('loadingOverlay').classList.add('loading-overlay--active'); }
  function hideLoad() { document.getElementById('loadingOverlay').classList.remove('loading-overlay--active'); }

  // ── Dialogs ──
  function openModal(id) { const el = document.getElementById(id); if (el) el.showModal(); }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-modal]');
    if (b) openModal(b.dataset.modal);
    const c = e.target.closest('[data-close]');
    if (c) { const d = c.closest('dialog'); if (d) d.close(); }
  });
  document.querySelectorAll('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
  });

  // ── Navigation ──
  function navigate(view) {
    currentView = view;
    document.querySelectorAll('.nav__link').forEach(el => el.toggleAttribute('aria-current', el.dataset.view === view));
    document.querySelectorAll('.view').forEach(el => (el.id === `view-${view}`) ? el.removeAttribute('hidden') : (el.hidden = true));
    history.replaceState(null, '', `#${view}`);
    render(view);
  }

  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.view); });
  });
  document.querySelectorAll('.stat-card[data-action]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.action));
  });

  // ── Render dispatch ──
  function render(view) {
    showLoad();
    switch(view) {
      case 'dashboard': renderDashboard(); break;
      case 'guests': renderGuests(); break;
      case 'relations': renderRelations(); break;
      case 'tables': renderTables(); break;
      case 'seating': renderSeating(); break;
    }
    updateNavStats();
    hideLoad();
  }

  function updateNavStats() {
    const s = DS.stats.all();
    document.getElementById('navStats').textContent = `${s.guests} guests · ${s.tables} tables · ${s.seated} seated`;
    document.getElementById('statGuests').textContent = s.guests;
    document.getElementById('statRelationships').textContent = s.relationships;
    document.getElementById('statTables').textContent = s.tables;
    document.getElementById('statSeated').textContent = s.seated;
  }

  function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════

  function renderDashboard() {
    const s = DS.stats.all();
    document.getElementById('statGuests').textContent = s.guests;
    document.getElementById('statRelationships').textContent = s.relationships;
    document.getElementById('statTables').textContent = s.tables;
    document.getElementById('statSeated').textContent = s.seated;

    const run = s.last_run;
    const infoEl = document.getElementById('lastRunInfo');
    if (run) {
      infoEl.innerHTML = `
        <div class="stat-card" style="cursor:default;margin-top:1rem">
          <div class="stat-card__icon">⚙️</div>
          <div class="stat-card__value" style="font-size:1.2rem;background:none;-webkit-text-fill-color:var(--text)">
            Score: ${(run.score || 0).toFixed(0)}
          </div>
          <div class="stat-card__label">
            ${run.hard_met || 0}/${run.hard_total || 0} hard constraints met ·
            ${run.duration_ms || '?'}ms · ${run.iterations || 0} iterations
          </div>
        </div>`;
    } else {
      infoEl.innerHTML = '';
    }
  }

  // ═══════════════════════════════════════════════
  // GUESTS
  // ═══════════════════════════════════════════════

  function renderGuests() {
    let guests = DS.guests.list();
    const search = (document.getElementById('guestSearch').value || '').toLowerCase();
    const side = document.getElementById('filterSide').value;
    const cat = document.getElementById('filterCategory').value;
    if (search) guests = guests.filter(g => g.name.toLowerCase().includes(search));
    if (side) guests = guests.filter(g => g.side === side);
    if (cat) guests = guests.filter(g => g.category === cat);

    const list = document.getElementById('guestList');
    const empty = document.getElementById('guestEmpty');
    if (!guests.length) { list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    list.innerHTML = guests.map(g => `
      <div class="guest-card" role="listitem">
        <div class="guest-card__header">
          <div class="guest-card__name">${esc(g.name)}</div>
          <div class="guest-card__actions">
            <button class="btn btn--sm btn--outline" data-edit-guest="${g.id}" aria-label="Edit">✎</button>
            <button class="btn btn--sm btn--danger" data-del-guest="${g.id}" aria-label="Delete">✕</button>
          </div>
        </div>
        <div class="guest-card__meta">
          <span class="badge badge--${g.side}">${g.side}</span>
          <span class="badge badge--${g.category}">${g.category.replace('_', ' ')}</span>
          ${g.role ? `<span class="badge badge--vip">${esc(g.role)}</span>` : ''}
        </div>
      </div>
    `).join('');

    list.querySelectorAll('[data-edit-guest]').forEach(el => {
      el.addEventListener('click', () => {
        const g = DS.guests.get(parseInt(el.dataset.editGuest));
        if (!g) return;
        document.getElementById('editGuestId').value = g.id;
        document.getElementById('editGuestName').value = g.name;
        document.getElementById('editGuestSide').value = g.side;
        document.getElementById('editGuestCategory').value = g.category;
        document.getElementById('editGuestRole').value = g.role || '';
        openModal('editGuestModal');
      });
    });
    list.querySelectorAll('[data-del-guest]').forEach(el => {
      el.addEventListener('click', () => {
        const g = DS.guests.get(parseInt(el.dataset.delGuest));
        if (!g || !confirm(`Delete "${g.name}"?`)) return;
        DS.guests.delete(g.id);
        Toast.success(`Deleted ${g.name}`);
        renderGuests();
        updateNavStats();
      });
    });
  }

  // ═══════════════════════════════════════════════
  // RELATIONSHIPS
  // ═══════════════════════════════════════════════

  function renderRelations() {
    let rels = DS.relationships.list();
    const search = (document.getElementById('relationSearch').value || '').toLowerCase();
    if (search) {
      rels = rels.filter(r =>
        r.guest_a_name.toLowerCase().includes(search) ||
        r.guest_b_name.toLowerCase().includes(search)
      );
    }

    // Stats
    const counts = {};
    rels.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
    document.getElementById('relationStats').textContent =
      Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join('  ·  ') || 'No connections';

    const list = document.getElementById('relationList');
    const empty = document.getElementById('relationEmpty');
    if (!rels.length) { list.innerHTML = ''; empty.hidden = false; } else {
      empty.hidden = true;
      const labels = { couple: 'Couple', inseparable: 'Inseparable', enemy: 'Enemy', friend: 'Friendship' };
      const icons = { couple: '💑', inseparable: '💞', enemy: '⚔️', friend: '🤝' };
      const colors = { couple: 'badge--couple', inseparable: 'badge--couple', enemy: 'badge--enemy', friend: 'badge--friend' };
      list.innerHTML = rels.map(r => `
        <div class="relation-card">
          <div class="relation-card__header">
            <div class="relation-card__guests">${esc(r.guest_a_name)} ↔ ${esc(r.guest_b_name)}</div>
            <span class="badge ${colors[r.type]}">${icons[r.type]} ${labels[r.type] || r.type}</span>
          </div>
          ${r.type === 'friend' ? `<div class="relation-card__weight">Strength: ${'●'.repeat(r.weight)}${'○'.repeat(10 - r.weight)}</div>` : ''}
          <div style="margin-top:var(--space-sm);display:flex;gap:4px;justify-content:flex-end">
            <button class="btn btn--sm btn--danger" data-del-rel="${r.id}">Remove</button>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('[data-del-rel]').forEach(el => {
        el.addEventListener('click', () => {
          if (!confirm('Remove this connection?')) return;
          DS.relationships.delete(parseInt(el.dataset.delRel));
          Toast.success('Connection removed');
          renderRelations();
          updateNavStats();
        });
      });
    }

    // Matrix
    renderMatrix();
  }

  function renderMatrix() {
    const container = document.getElementById('relationMatrix');
    const { guests, matrix } = DS.relationships.matrix();
    if (!guests.length) { container.innerHTML = '<div class="empty-state__text">Add guests first</div>'; return; }

    const n = Math.min(guests.length, 30);
    const cellSize = n > 20 ? 24 : 32;
    let html = '';

    // Header
    html += '<div style="display:contents"><div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px"></div>';
    for (let j = 0; j < n; j++) {
      html += '<div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px" title="' + esc(guests[j].name) + '">' + esc(guests[j].name.slice(0, 3)) + '</div>';
    }
    html += '</div>';

    for (let i = 0; i < n; i++) {
      html += '<div style="display:contents">';
      html += '<div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px" title="' + esc(guests[i].name) + '">' + esc(guests[i].name.slice(0, 3)) + '</div>';
      for (let j = 0; j < n; j++) {
        const cell = matrix[i]?.[j];
        let cls = 'matrix__cell--none';
        let title = guests[i].name;
        let symbol = '';
        if (i !== j && cell) {
          title = `${guests[i].name} ↔ ${guests[j].name}: ${cell.type}`;
          if (cell.type === 'couple' || cell.type === 'inseparable') { cls = 'matrix__cell--couple'; symbol = '♥'; }
          else if (cell.type === 'enemy') { cls = 'matrix__cell--enemy'; symbol = '✕'; }
          else if (cell.type === 'friend') {
            const w = cell.weight || 5;
            cls = w <= 2 ? 'matrix__cell--friend-l1' : w <= 4 ? 'matrix__cell--friend-l2' : w <= 6 ? 'matrix__cell--friend-l3' : w <= 8 ? 'matrix__cell--friend-l4' : 'matrix__cell--friend-l5';
            symbol = '●';
          }
        }
        html += `<div class="matrix__cell ${cls}" style="width:${cellSize}px;height:${cellSize}px" title="${esc(title)}">${symbol}</div>`;
      }
      html += '</div>';
    }

    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${n + 1}, ${cellSize}px)`;
    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════════
  // TABLES
  // ═══════════════════════════════════════════════

  function renderTables() {
    const tables = DS.tables.list();
    const grid = document.getElementById('tablesGrid');
    const empty = document.getElementById('tableEmpty');
    if (!tables.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    grid.innerHTML = tables.map(t => {
      const fillPct = t.capacity > 0 ? Math.round((t.guest_count / t.capacity) * 100) : 0;
      const fillClass = fillPct > 80 ? 'table-card__capacity-fill--high' : fillPct > 50 ? 'table-card__capacity-fill--mid' : 'table-card__capacity-fill--low';
      const shapeIcon = t.shape === 'round' ? '◯' : '▭';
      return `
        <div class="table-card" role="listitem">
          <div class="table-card__header">
            <div class="table-card__name">${shapeIcon} ${esc(t.name)}</div>
            <div class="table-card__info">${t.shape} · ${t.capacity} seats</div>
          </div>
          <div class="table-card__info">${t.guest_count} / ${t.capacity} guests</div>
          ${t.label ? `<div class="table-card__info" style="color:var(--accent-soft)">${esc(t.label)}</div>` : ''}
          <div class="table-card__capacity-bar">
            <div class="table-card__capacity-fill ${fillClass}" style="width:${fillPct}%"></div>
          </div>
          <div class="table-card__actions">
            <button class="btn btn--sm btn--outline" data-edit-table="${t.id}">Edit</button>
            <button class="btn btn--sm btn--danger" data-del-table="${t.id}">Delete</button>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-edit-table]').forEach(el => {
      el.addEventListener('click', () => {
        const t = DS.tables.get(parseInt(el.dataset.editTable));
        if (!t) return;
        document.getElementById('editTableId').value = t.id;
        document.getElementById('editTableName').value = t.name;
        document.getElementById('editTableCapacity').value = t.capacity;
        document.getElementById('editTableShape').value = t.shape;
        document.getElementById('editTableLabel').value = t.label || '';
        openModal('editTableModal');
      });
    });
    grid.querySelectorAll('[data-del-table]').forEach(el => {
      el.addEventListener('click', () => {
        const t = DS.tables.get(parseInt(el.dataset.delTable));
        if (!t || !confirm(`Delete "${t.name}"? This removes seating assignments.`)) return;
        DS.tables.delete(t.id);
        Toast.success(`Deleted ${t.name}`);
        renderTables();
        updateNavStats();
      });
    });
  }

  // ═══════════════════════════════════════════════
  // SEATING
  // ═══════════════════════════════════════════════

  function renderSeating() {
    const tables = DS.tables.list();
    const seatingByTable = DS.seating.getByTable();
    const guests = DS.guests.list();
    const canvas = document.getElementById('seatingCanvas');
    const results = document.getElementById('seatingResults');
    const violations = document.getElementById('seatingViolations');

    if (!tables.length) {
      canvas.innerHTML = '<div class="empty-state"><div class="empty-state__icon">🪑</div><div class="empty-state__text">No tables defined</div></div>';
      results.hidden = true; violations.hidden = true;
      return;
    }

    let hasAssignments = false;
    let html = '';
    for (const t of tables) {
      const assigned = seatingByTable[t.id] || [];
      if (assigned.length > 0) hasAssignments = true;
      const fillPct = t.capacity > 0 ? Math.round((assigned.length / t.capacity) * 100) : 0;
      const overfull = assigned.length > t.capacity;

      html += `
        <div class="canvas-table ${overfull ? 'canvas-table--violation' : ''}">
          <div class="canvas-table__header">
            <div>
              <div class="canvas-table__name">${t.shape === 'round' ? '◯' : '▭'} ${esc(t.name)}</div>
              <div class="canvas-table__capacity">${assigned.length} / ${t.capacity} seated</div>
            </div>
            <div style="font-size:.75rem;color:var(--text-dim)">${fillPct}% full</div>
          </div>
          <div class="canvas-table__seats">
            ${assigned.length === 0 ? '<div style="color:var(--text-muted);font-size:.8125rem">No guests assigned</div>' : ''}
            ${assigned.map(s => {
              const g = guests.find(x => x.id === s.guest_id);
              if (!g) return '';
              let cls = 'seat-chip';
              if (g.side === 'bride') cls += ' seat-chip--bride';
              else if (g.side === 'groom') cls += ' seat-chip--groom';
              if (g.role) cls += ' seat-chip--vip';
              return `<span class="${cls}" title="${esc(g.name)}${g.role ? ' (' + esc(g.role) + ')' : ''}">${esc(g.name)}${g.role ? `<span class="seat-chip__role">${esc(g.role)}</span>` : ''}</span>`;
            }).join('')}
          </div>
        </div>`;
    }

    canvas.innerHTML = html;
    if (!hasAssignments) {
      canvas.insertAdjacentHTML('beforeend', '<div class="empty-state"><div class="empty-state__hint">Click "Generate Seating" to run the algorithm</div></div>');
    }
  }

  // ═══════════════════════════════════════════════
  // ALGORITHM
  // ═══════════════════════════════════════════════

  function generateSeating() {
    const guests = DS.guests.list();
    const tables = DS.tables.list();
    const relationships = DS.relationships.list();

    if (!guests.length) return Toast.error('Add guests first');
    if (!tables.length) return Toast.error('Define tables first');

    showLoad();
    setTimeout(() => {
      try {
        const t0 = performance.now();
        const result = SeatingAlgorithm.generate(guests, tables, relationships, 2000, 10);
        const duration = Math.round(performance.now() - t0);

        // Save seating
        DS.seating.save(result.assignment);

        // Log run
        DS.stats.logRun({ ...result, duration_ms: duration });
        updateNavStats();
        renderSeating();

        // Show results
        const resultsEl = document.getElementById('seatingResults');
        resultsEl.hidden = false;
        document.getElementById('algoScore').textContent = (result.score || 0).toFixed(0);
        document.getElementById('algoHard').textContent = `${result.hard_met || 0} / ${result.hard_total || 0}`;
        document.getElementById('algoDuration').textContent = `${duration}ms (${result.iterations || 0} iter)`;

        // Violations
        const violEl = document.getElementById('seatingViolations');
        const violList = document.getElementById('violationsList');
        if (result.violations?.length) {
          violEl.hidden = false;
          const names = id => { const g = guests.find(x => x.id === id); return g ? g.name : `#${id}`; };
          violList.innerHTML = result.violations.map(v =>
            `<div style="padding:4px 0;font-size:.875rem">⚠️ <strong>${v.type}</strong>: ${(v.guests || []).map(names).join(' vs ')}</div>`
          ).join('');
        } else {
          violEl.hidden = true;
        }

        Toast.success(`Seating generated! Score: ${(result.score || 0).toFixed(0)}`);
      } catch (err) {
        Toast.error(err.message);
      }
      hideLoad();
    }, 50);
  }

  // ═══════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════

  function init() {
    // ── Guest forms ──
    document.getElementById('addGuestForm').addEventListener('submit', e => {
      e.preventDefault();
      try {
        DS.guests.add({
          name: document.getElementById('guestName').value,
          side: document.getElementById('guestSide').value,
          category: document.getElementById('guestCategory').value,
          role: document.getElementById('guestRole').value || null,
        });
        e.target.closest('dialog').close();
        e.target.reset();
        Toast.success('Guest added');
        renderGuests(); updateNavStats();
      } catch (err) { Toast.error(err.message); }
    });

    document.getElementById('bulkForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = document.getElementById('bulkNames').value.trim();
      if (!text) return Toast.error('Paste names first');
      const names = text.split('\n').filter(n => n.trim());
      const result = DS.guests.bulkAdd(names, document.getElementById('bulkSide').value, document.getElementById('bulkCategory').value);
      e.target.closest('dialog').close();
      e.target.reset();
      Toast.success(`Added ${result.added} guest${result.added === 1 ? '' : 's'}${result.errors.length ? `, ${result.errors.length} skipped` : ''}`);
      renderGuests(); updateNavStats();
    });

    document.getElementById('csvForm').addEventListener('submit', e => {
      e.preventDefault();
      const text = document.getElementById('csvText').value.trim();
      if (!text) return Toast.error('Paste CSV data first');
      const result = DS.guests.importCSV(text);
      e.target.closest('dialog').close();
      e.target.reset();
      Toast.success(`Imported ${result.added} guest${result.added === 1 ? '' : 's'}${result.errors.length ? `, ${result.errors.length} skipped` : ''}`);
      renderGuests(); updateNavStats();
    });

    document.getElementById('editGuestForm').addEventListener('submit', e => {
      e.preventDefault();
      try {
        DS.guests.update(parseInt(document.getElementById('editGuestId').value), {
          name: document.getElementById('editGuestName').value,
          side: document.getElementById('editGuestSide').value,
          category: document.getElementById('editGuestCategory').value,
          role: document.getElementById('editGuestRole').value,
        });
        e.target.closest('dialog').close();
        Toast.success('Guest updated');
        renderGuests(); updateNavStats();
      } catch (err) { Toast.error(err.message); }
    });

    // Search/filter
    document.getElementById('guestSearch').addEventListener('input', renderGuests);
    document.getElementById('filterSide').addEventListener('change', renderGuests);
    document.getElementById('filterCategory').addEventListener('change', renderGuests);
    document.getElementById('relationSearch').addEventListener('input', renderRelations);

    // ── Relationship form ──
    document.getElementById('addRelationForm').addEventListener('submit', e => {
      e.preventDefault();
      const a = parseInt(document.getElementById('relGuestA').value);
      const b = parseInt(document.getElementById('relGuestB').value);
      if (!a || !b) return Toast.error('Select both guests');
      try {
        DS.relationships.add({
          guest_a_id: a,
          guest_b_id: b,
          type: document.getElementById('relType').value,
          weight: parseInt(document.getElementById('relWeight').value),
        });
        e.target.closest('dialog').close();
        e.target.reset();
        Toast.success('Connection added');
        renderRelations(); updateNavStats();
      } catch (err) { Toast.error(err.message); }
    });
    document.getElementById('relType').addEventListener('change', () => {
      const isFriend = document.getElementById('relType').value === 'friend';
      document.getElementById('relWeightField').style.display = isFriend ? 'block' : 'none';
    });
    document.getElementById('relWeight').addEventListener('input', () => {
      document.getElementById('relWeightDisplay').textContent = document.getElementById('relWeight').value;
    });

    // ── Table forms ──
    document.getElementById('addTableForm').addEventListener('submit', e => {
      e.preventDefault();
      try {
        DS.tables.add({
          name: document.getElementById('tableName').value,
          capacity: parseInt(document.getElementById('tableCapacity').value),
          shape: document.getElementById('tableShape').value,
          label: document.getElementById('tableLabel').value || null,
        });
        e.target.closest('dialog').close();
        e.target.reset();
        Toast.success('Table added');
        renderTables(); updateNavStats();
      } catch (err) { Toast.error(err.message); }
    });

    document.getElementById('editTableForm').addEventListener('submit', e => {
      e.preventDefault();
      DS.tables.update(parseInt(document.getElementById('editTableId').value), {
        name: document.getElementById('editTableName').value,
        capacity: parseInt(document.getElementById('editTableCapacity').value),
        shape: document.getElementById('editTableShape').value,
        label: document.getElementById('editTableLabel').value,
      });
      e.target.closest('dialog').close();
      Toast.success('Table updated');
      renderTables(); updateNavStats();
    });

    document.getElementById('btnAutoTables').addEventListener('click', () => {
      const count = parseInt(document.getElementById('autoTableCount').value) || 5;
      const cap = parseInt(document.getElementById('autoTableCapacity').value) || 8;
      if (count < 1 || count > 30) return Toast.error('Count must be 1-30');
      const guests = DS.guests.list().length;
      const total = count * cap;
      if (guests > 0 && total < guests) {
        if (!confirm(`${guests} guests need at least ${guests} seats across ${count} tables (${total} seats). Increase capacity or count?`)) return;
      }
      // Remove existing tables
      DS.tables.clearAll();
      DS.tables.autoCreate(count, cap);
      Toast.success(`Created ${count} tables (capacity: ${cap} each)`);
      renderTables(); updateNavStats();
    });

    // ── Seating forms ──
    document.getElementById('btnGenerate').addEventListener('click', generateSeating);
    document.getElementById('btnClearSeating').addEventListener('click', () => {
      if (!confirm('Clear all seating assignments?')) return;
      DS.seating.clear();
      renderSeating();
      document.getElementById('seatingResults').hidden = true;
      document.getElementById('seatingViolations').hidden = true;
      Toast.info('Seating cleared');
    });
    document.getElementById('btnExportCSV').addEventListener('click', () => DS.export.downloadCSV());
    document.getElementById('btnExportJSON').addEventListener('click', () => DS.export.downloadJSON());
    document.getElementById('btnResetData').addEventListener('click', () => {
      if (!confirm('⚠️ This permanently deletes ALL data (guests, relationships, tables, seating). Export first if needed.\n\nReset?')) return;
      DS.reset();
      Toast.info('All data reset');
      render('dashboard');
    });

    // ── Populate relation selects on modal open ──
    document.querySelector('[data-modal="addRelationModal"]').addEventListener('click', () => {
      setTimeout(() => {
        const guests = DS.guests.list();
        const opts = guests.map(g => `<option value="${g.id}">${esc(g.name)}${g.role ? ' (' + esc(g.role) + ')' : ''}</option>`).join('');
        document.getElementById('relGuestA').innerHTML = '<option value="">— Select guest —</option>' + opts;
        document.getElementById('relGuestB').innerHTML = '<option value="">— Select guest —</option>' + opts;
      }, 50);
    });

    // ── Load initial view from hash ──
    const view = location.hash?.slice(1) || 'dashboard';
    navigate(view);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
