/**
 * Wedding Seating Planner — Client-Side App
 * No server needed — localStorage persistence via DS.
 */

(function() {
  'use strict';

  let currentView = 'dashboard';

  // ── Toast ──
  function toast(msg, type, dur) {
    type = type || 'info';
    dur = dur || 3500;
    var c = document.getElementById('toastContainer');
    var e = document.createElement('div');
    e.className = 'toast toast--' + type;
    e.textContent = msg;
    c.appendChild(e);
    setTimeout(function() {
      e.classList.add('toast--remove');
      setTimeout(function() { e.remove(); }, 200);
    }, dur);
  }

  // ── Loading ──
  function showLoad() {
    document.getElementById('loadingOverlay').classList.add('loading-overlay--active');
  }
  function hideLoad() {
    document.getElementById('loadingOverlay').classList.remove('loading-overlay--active');
  }

  // ── Dialogs ──
  function openModal(id) {
    var el = document.getElementById(id);
    if (el) el.showModal();
  }

  document.addEventListener('click', function(e) {
    var b = e.target.closest('[data-modal]');
    if (b) { e.preventDefault(); openModal(b.dataset.modal); }
    var c = e.target.closest('[data-close]');
    if (c) { var d = c.closest('dialog'); if (d) d.close(); }
  });

  document.querySelectorAll('dialog').forEach(function(d) {
    d.addEventListener('click', function(e) { if (e.target === d) d.close(); });
  });

  // ── Navigation ──
  function navigate(view) {
    currentView = view;
    document.querySelectorAll('.nav__link').forEach(function(el) {
      if (el.dataset.view === view) {
        el.setAttribute('aria-current', 'page');
      } else {
        el.removeAttribute('aria-current');
      }
    });
    document.querySelectorAll('.view').forEach(function(el) {
      if (el.id === 'view-' + view) {
        el.removeAttribute('hidden');
      } else {
        el.hidden = true;
      }
    });
    history.replaceState(null, '', '#' + view);
    render(view);
  }

  document.querySelectorAll('[data-view]').forEach(function(el) {
    el.addEventListener('click', function(e) { e.preventDefault(); navigate(el.dataset.view); });
  });

  document.querySelectorAll('.stat-card[data-action]').forEach(function(el) {
    el.addEventListener('click', function() { navigate(el.dataset.action); });
  });

  // ── Render dispatch ──
  function render(view) {
    showLoad();
    switch (view) {
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
    var s = DS.stats.all();
    document.getElementById('navStats').textContent = s.guests + ' guests | ' + s.tables + ' tables | ' + s.seated + ' seated';
    document.getElementById('statGuests').textContent = s.guests;
    document.getElementById('statRelationships').textContent = s.relationships;
    document.getElementById('statTables').textContent = s.tables;
    document.getElementById('statSeated').textContent = s.seated;
  }

  function esc(str) {
    if (str == null) return '';
    var d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
  }

  // ═══════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════

  function renderDashboard() {
    var s = DS.stats.all();
    document.getElementById('statGuests').textContent = s.guests;
    document.getElementById('statRelationships').textContent = s.relationships;
    document.getElementById('statTables').textContent = s.tables;
    document.getElementById('statSeated').textContent = s.seated;

    var run = s.last_run;
    var infoEl = document.getElementById('lastRunInfo');
    if (run) {
      infoEl.innerHTML =
        '<div class="stat-card" style="cursor:default;margin-top:1rem">' +
          '<div class="stat-card__indicator stat-card__indicator--guests"></div>' +
          '<div class="stat-card__value" style="font-size:1.1rem">' + (run.score || 0).toFixed(0) + '</div>' +
          '<div class="stat-card__label">' +
            (run.hard_met || 0) + '/' + (run.hard_total || 0) + ' hard constraints met | ' +
            (run.duration_ms || '?') + 'ms | ' + (run.iterations || 0) + ' iterations' +
          '</div>' +
        '</div>';
    } else {
      infoEl.innerHTML = '';
    }
  }

  // ═══════════════════════════════════════════════
  // GUESTS
  // ═══════════════════════════════════════════════

  function renderGuests() {
    var guests = DS.guests.list();
    var search = (document.getElementById('guestSearch').value || '').toLowerCase();
    var side = document.getElementById('filterSide').value;
    var cat = document.getElementById('filterCategory').value;
    if (search) guests = guests.filter(function(g) { return g.name.toLowerCase().indexOf(search) !== -1; });
    if (side) guests = guests.filter(function(g) { return g.side === side; });
    if (cat) guests = guests.filter(function(g) { return g.category === cat; });

    var list = document.getElementById('guestList');
    var empty = document.getElementById('guestEmpty');
    if (!guests.length) { list.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    var html = '';
    for (var i = 0; i < guests.length; i++) {
      var g = guests[i];
      var roleTag = g.role ? '<span class="badge badge--vip">' + esc(g.role) + '</span>' : '';
      html +=
        '<div class="guest-card" role="listitem">' +
          '<div class="guest-card__header">' +
            '<div class="guest-card__name">' + esc(g.name) + '</div>' +
            '<div class="guest-card__actions">' +
              '<button class="btn btn--sm btn--outline" data-edit-guest="' + g.id + '" aria-label="Edit">Edit</button>' +
              '<button class="btn btn--sm btn--danger" data-del-guest="' + g.id + '" aria-label="Delete">Del</button>' +
            '</div>' +
          '</div>' +
          '<div class="guest-card__meta">' +
            '<span class="badge badge--' + g.side + '">' + g.side + '</span>' +
            '<span class="badge badge--' + g.category + '">' + g.category.replace('_', ' ') + '</span>' +
            roleTag +
          '</div>' +
        '</div>';
    }
    list.innerHTML = html;

    list.querySelectorAll('[data-edit-guest]').forEach(function(el) {
      el.addEventListener('click', function() {
        var g = DS.guests.get(parseInt(el.dataset.editGuest));
        if (!g) return;
        document.getElementById('editGuestId').value = g.id;
        document.getElementById('editGuestName').value = g.name;
        document.getElementById('editGuestSide').value = g.side;
        document.getElementById('editGuestCategory').value = g.category;
        document.getElementById('editGuestRole').value = g.role || '';
        openModal('editGuestModal');
      });
    });
    list.querySelectorAll('[data-del-guest]').forEach(function(el) {
      el.addEventListener('click', function() {
        var g = DS.guests.get(parseInt(el.dataset.delGuest));
        if (!g) return;
        if (!confirm('Delete "' + g.name + '"?')) return;
        DS.guests.delete(g.id);
        toast('Deleted ' + g.name, 'success');
        renderGuests();
        updateNavStats();
      });
    });
  }

  // ═══════════════════════════════════════════════
  // RELATIONSHIPS
  // ═══════════════════════════════════════════════

  function renderRelations() {
    var rels = DS.relationships.list();
    var search = (document.getElementById('relationSearch').value || '').toLowerCase();
    if (search) {
      rels = rels.filter(function(r) {
        return r.guest_a_name.toLowerCase().indexOf(search) !== -1 ||
               r.guest_b_name.toLowerCase().indexOf(search) !== -1;
      });
    }

    // Stats
    var counts = {};
    rels.forEach(function(r) { counts[r.type] = (counts[r.type] || 0) + 1; });
    var parts = [];
    for (var k in counts) parts.push(k + ': ' + counts[k]);
    document.getElementById('relationStats').textContent = parts.join('  |  ') || 'No connections';

    var list = document.getElementById('relationList');
    var empty = document.getElementById('relationEmpty');
    if (!rels.length) { list.innerHTML = ''; empty.hidden = false; } else {
      empty.hidden = true;
      var labels = { couple: 'Couple', inseparable: 'Inseparable', enemy: 'Enemy', friend: 'Friendship' };
      var colors = { couple: 'badge--couple', inseparable: 'badge--couple', enemy: 'badge--enemy', friend: 'badge--friend' };
      var html = '';
      for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        var weightHtml = '';
        if (r.type === 'friend') {
          var dots = '';
          for (var j = 0; j < 10; j++) dots += (j < r.weight ? '●' : '○');
          weightHtml = '<div class="relation-card__weight">Strength: ' + dots + '</div>';
        }
        html +=
          '<div class="relation-card">' +
            '<div class="relation-card__header">' +
              '<div class="relation-card__guests">' + esc(r.guest_a_name) + ' &harr; ' + esc(r.guest_b_name) + '</div>' +
              '<span class="badge ' + colors[r.type] + '">' + (labels[r.type] || r.type) + '</span>' +
            '</div>' +
            weightHtml +
            '<div style="margin-top:var(--space-sm);display:flex;gap:4px;justify-content:flex-end">' +
              '<button class="btn btn--sm btn--danger" data-del-rel="' + r.id + '">Remove</button>' +
            '</div>' +
          '</div>';
      }
      list.innerHTML = html;
      list.querySelectorAll('[data-del-rel]').forEach(function(el) {
        el.addEventListener('click', function() {
          if (!confirm('Remove this connection?')) return;
          DS.relationships.delete(parseInt(el.dataset.delRel));
          toast('Connection removed', 'success');
          renderRelations();
          updateNavStats();
        });
      });
    }

    renderMatrix();
  }

  function renderMatrix() {
    var container = document.getElementById('relationMatrix');
    var mg = DS.relationships.matrix();
    var guests = mg.guests;
    var matrix = mg.matrix;
    if (!guests.length) { container.innerHTML = '<div class="empty-state__text">Add guests first</div>'; return; }

    var n = Math.min(guests.length, 30);
    var cellSize = n > 20 ? 22 : 26;
    var html = '';

    // Header
    html += '<div style="display:contents">' +
      '<div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px"></div>';
    for (var j = 0; j < n; j++) {
      html += '<div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px" title="' + esc(guests[j].name) + '">' + esc(guests[j].name.slice(0, 3)) + '</div>';
    }
    html += '</div>';

    for (var i = 0; i < n; i++) {
      html += '<div style="display:contents">';
      html += '<div class="matrix__cell matrix__cell--header" style="width:' + cellSize + 'px;height:' + cellSize + 'px" title="' + esc(guests[i].name) + '">' + esc(guests[i].name.slice(0, 3)) + '</div>';
      for (j = 0; j < n; j++) {
        var cell = matrix[i] ? matrix[i][j] : null;
        var cls = 'matrix__cell--none';
        var title = guests[i].name;
        var symbol = '';
        if (i !== j && cell) {
          title = guests[i].name + ' / ' + guests[j].name + ': ' + cell.type;
          if (cell.type === 'couple' || cell.type === 'inseparable') { cls = 'matrix__cell--couple'; symbol = 'C'; }
          else if (cell.type === 'enemy') { cls = 'matrix__cell--enemy'; symbol = 'X'; }
          else if (cell.type === 'friend') {
            var w = cell.weight || 5;
            cls = w <= 2 ? 'matrix__cell--friend-l1' : w <= 4 ? 'matrix__cell--friend-l2' : w <= 6 ? 'matrix__cell--friend-l3' : w <= 8 ? 'matrix__cell--friend-l4' : 'matrix__cell--friend-l5';
            symbol = '·';
          }
        }
        html += '<div class="matrix__cell ' + cls + '" style="width:' + cellSize + 'px;height:' + cellSize + 'px" title="' + esc(title) + '">' + symbol + '</div>';
      }
      html += '</div>';
    }

    container.innerHTML = '';
    container.style.gridTemplateColumns = 'repeat(' + (n + 1) + ', ' + cellSize + 'px)';
    container.innerHTML = html;
  }

  // ═══════════════════════════════════════════════
  // TABLES
  // ═══════════════════════════════════════════════

  function renderTables() {
    var tables = DS.tables.list();
    var grid = document.getElementById('tablesGrid');
    var empty = document.getElementById('tableEmpty');
    if (!tables.length) { grid.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;

    var html = '';
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var fillPct = t.capacity > 0 ? Math.round((t.guest_count / t.capacity) * 100) : 0;
      var fillClass = fillPct > 80 ? 'table-card__capacity-fill--high' : fillPct > 50 ? 'table-card__capacity-fill--mid' : 'table-card__capacity-fill--low';
      var labelHtml = t.label ? '<div class="table-card__info" style="color:var(--accent)">' + esc(t.label) + '</div>' : '';
      html +=
        '<div class="table-card" role="listitem">' +
          '<div class="table-card__header">' +
            '<div class="table-card__name">' + esc(t.name) + '</div>' +
            '<div class="table-card__info">' + t.capacity + ' seats &middot; ' + t.shape + '</div>' +
          '</div>' +
          '<div class="table-card__info">' + t.guest_count + ' / ' + t.capacity + ' guests</div>' +
          labelHtml +
          '<div class="table-card__capacity-bar">' +
            '<div class="table-card__capacity-fill ' + fillClass + '" style="width:' + fillPct + '%"></div>' +
          '</div>' +
          '<div class="table-card__actions">' +
            '<button class="btn btn--sm btn--outline" data-edit-table="' + t.id + '">Edit</button>' +
            '<button class="btn btn--sm btn--danger" data-del-table="' + t.id + '">Delete</button>' +
          '</div>' +
        '</div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll('[data-edit-table]').forEach(function(el) {
      el.addEventListener('click', function() {
        var t = DS.tables.get(parseInt(el.dataset.editTable));
        if (!t) return;
        document.getElementById('editTableId').value = t.id;
        document.getElementById('editTableName').value = t.name;
        document.getElementById('editTableCapacity').value = t.capacity;
        document.getElementById('editTableShape').value = t.shape;
        document.getElementById('editTableLabel').value = t.label || '';
        openModal('editTableModal');
      });
    });
    grid.querySelectorAll('[data-del-table]').forEach(function(el) {
      el.addEventListener('click', function() {
        var t = DS.tables.get(parseInt(el.dataset.delTable));
        if (!t || !confirm('Delete "' + t.name + '"?')) return;
        DS.tables.delete(t.id);
        toast('Deleted ' + t.name, 'success');
        renderTables();
        updateNavStats();
      });
    });
  }

  // ═══════════════════════════════════════════════
  // SEATING
  // ═══════════════════════════════════════════════

  function renderSeating() {
    var tables = DS.tables.list();
    var seatingByTable = DS.seating.getByTable();
    var guests = DS.guests.list();
    var canvas = document.getElementById('seatingCanvas');
    var results = document.getElementById('seatingResults');
    var violations = document.getElementById('seatingViolations');

    if (!tables.length) {
      canvas.innerHTML = '<div class="empty-state"><div class="empty-state__icon">+</div><div class="empty-state__text">No tables defined</div></div>';
      results.hidden = true; violations.hidden = true;
      return;
    }

    var hasAssignments = false;
    var html = '';
    for (var i = 0; i < tables.length; i++) {
      var t = tables[i];
      var assigned = seatingByTable[t.id] || [];
      if (assigned.length > 0) hasAssignments = true;
      var fillPct = t.capacity > 0 ? Math.round((assigned.length / t.capacity) * 100) : 0;
      var overfull = assigned.length > t.capacity;

      var seatsHtml = '';
      if (assigned.length === 0) {
        seatsHtml = '<div style="color:var(--text-muted);font-size:.75rem">No guests assigned</div>';
      } else {
        for (var j = 0; j < assigned.length; j++) {
          var s = assigned[j];
          var g = guests.find(function(x) { return x.id === s.guest_id; });
          if (!g) continue;
          var cls = 'seat-chip';
          if (g.side === 'bride') cls += ' seat-chip--bride';
          else if (g.side === 'groom') cls += ' seat-chip--groom';
          if (g.role) cls += ' seat-chip--vip';
          var roleSpan = g.role ? '<span class="seat-chip__role">' + esc(g.role) + '</span>' : '';
          seatsHtml += '<span class="' + cls + '" title="' + esc(g.name) + (g.role ? ' (' + esc(g.role) + ')' : '') + '">' + esc(g.name) + roleSpan + '</span>';
        }
      }

      html +=
        '<div class="canvas-table' + (overfull ? ' canvas-table--violation' : '') + '">' +
          '<div class="canvas-table__header">' +
            '<div>' +
              '<div class="canvas-table__name">' + esc(t.name) + '</div>' +
              '<div class="canvas-table__capacity">' + assigned.length + ' / ' + t.capacity + ' seated</div>' +
            '</div>' +
            '<div style="font-size:.6875rem;color:var(--text-dim)">' + fillPct + '% full</div>' +
          '</div>' +
          '<div class="canvas-table__seats">' + seatsHtml + '</div>' +
        '</div>';
    }
    canvas.innerHTML = html;
    if (!hasAssignments) {
      canvas.innerHTML += '<div class="empty-state"><div class="empty-state__hint">Click Generate Seating to run the algorithm</div></div>';
    }
  }

  // ═══════════════════════════════════════════════
  // ALGORITHM
  // ═══════════════════════════════════════════════

  function generateSeating() {
    var guests = DS.guests.list();
    var tables = DS.tables.list();
    var relationships = DS.relationships.list();

    if (!guests.length) { toast('Add guests first', 'error'); return; }
    if (!tables.length) { toast('Define tables first', 'error'); return; }

    // Check capacity
    var totalCap = tables.reduce(function(s, t) { return s + t.capacity; }, 0);
    if (totalCap < guests.length) {
      toast('Not enough seats (' + totalCap + ') for ' + guests.length + ' guests', 'error');
      return;
    }

    showLoad();
    setTimeout(function() {
      try {
        var t0 = performance.now();
        var result = SeatingAlgorithm.generate(guests, tables, relationships, 2000, 10);
        var duration = Math.round(performance.now() - t0);

        DS.seating.save(result.assignment);
        DS.stats.logRun({ score: result.score, hard_met: result.hard_met, hard_total: result.hard_total, violations: result.violations, iterations: result.iterations, duration_ms: duration });
        updateNavStats();
        renderSeating();

        // Show results
        var resultsEl = document.getElementById('seatingResults');
        resultsEl.hidden = false;
        document.getElementById('algoScore').textContent = (result.score || 0).toFixed(0);
        document.getElementById('algoHard').textContent = (result.hard_met || 0) + ' / ' + (result.hard_total || 0);
        document.getElementById('algoDuration').textContent = duration + 'ms (' + (result.iterations || 0) + ' iter)';

        // Violations
        var violEl = document.getElementById('seatingViolations');
        var violList = document.getElementById('violationsList');
        if (result.violations && result.violations.length) {
          violEl.hidden = false;
          var vhtml = '';
          for (var i = 0; i < result.violations.length; i++) {
            var v = result.violations[i];
            var names = (v.guests || []).map(function(id) { var g = guests.find(function(x) { return x.id === id; }); return g ? g.name : '#' + id; }).join(' vs ');
            vhtml += '<div style="padding:4px 0;font-size:.8125rem">! <strong>' + v.type + '</strong>: ' + names + '</div>';
          }
          violList.innerHTML = vhtml;
        } else {
          violEl.hidden = true;
        }

        toast('Seating generated. Score: ' + (result.score || 0).toFixed(0), 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
      hideLoad();
    }, 50);
  }

  // ═══════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════

  function init() {
    // Guest forms
    document.getElementById('addGuestForm').addEventListener('submit', function(e) {
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
        toast('Guest added', 'success');
        renderGuests(); updateNavStats();
      } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('bulkForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var text = document.getElementById('bulkNames').value.trim();
      if (!text) { toast('Paste names first', 'error'); return; }
      var names = text.split('\n').filter(function(n) { return n.trim(); });
      var result = DS.guests.bulkAdd(names,
        document.getElementById('bulkSide').value,
        document.getElementById('bulkCategory').value
      );
      e.target.closest('dialog').close();
      e.target.reset();
      var msg = 'Added ' + result.added + ' guest' + (result.added === 1 ? '' : 's');
      if (result.errors.length) msg += ', ' + result.errors.length + ' skipped (duplicates)';
      toast(msg, 'success');
      renderGuests(); updateNavStats();
    });

    document.getElementById('csvForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var text = document.getElementById('csvText').value.trim();
      if (!text) { toast('Paste CSV data first', 'error'); return; }
      var result = DS.guests.importCSV(text);
      e.target.closest('dialog').close();
      e.target.reset();
      var msg = 'Imported ' + result.added + ' guest' + (result.added === 1 ? '' : 's');
      if (result.errors.length) msg += ', ' + result.errors.length + ' skipped';
      toast(msg, 'success');
      renderGuests(); updateNavStats();
    });

    document.getElementById('editGuestForm').addEventListener('submit', function(e) {
      e.preventDefault();
      try {
        DS.guests.update(parseInt(document.getElementById('editGuestId').value), {
          name: document.getElementById('editGuestName').value,
          side: document.getElementById('editGuestSide').value,
          category: document.getElementById('editGuestCategory').value,
          role: document.getElementById('editGuestRole').value,
        });
        e.target.closest('dialog').close();
        toast('Guest updated', 'success');
        renderGuests(); updateNavStats();
      } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('guestSearch').addEventListener('input', renderGuests);
    document.getElementById('filterSide').addEventListener('change', renderGuests);
    document.getElementById('filterCategory').addEventListener('change', renderGuests);
    document.getElementById('relationSearch').addEventListener('input', renderRelations);

    // Relationship form
    document.getElementById('addRelationForm').addEventListener('submit', function(e) {
      e.preventDefault();
      var a = parseInt(document.getElementById('relGuestA').value);
      var b = parseInt(document.getElementById('relGuestB').value);
      if (!a || !b) { toast('Select both guests', 'error'); return; }
      try {
        DS.relationships.add({
          guest_a_id: a,
          guest_b_id: b,
          type: document.getElementById('relType').value,
          weight: parseInt(document.getElementById('relWeight').value),
        });
        e.target.closest('dialog').close();
        e.target.reset();
        toast('Connection added', 'success');
        renderRelations(); updateNavStats();
      } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('relType').addEventListener('change', function() {
      var isFriend = document.getElementById('relType').value === 'friend';
      document.getElementById('relWeightField').style.display = isFriend ? 'block' : 'none';
    });
    document.getElementById('relType').dispatchEvent(new Event('change'));

    document.getElementById('relWeight').addEventListener('input', function() {
      document.getElementById('relWeightDisplay').textContent = document.getElementById('relWeight').value;
    });

    // Table forms
    document.getElementById('addTableForm').addEventListener('submit', function(e) {
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
        toast('Table added', 'success');
        renderTables(); updateNavStats();
      } catch (err) { toast(err.message, 'error'); }
    });

    document.getElementById('editTableForm').addEventListener('submit', function(e) {
      e.preventDefault();
      DS.tables.update(parseInt(document.getElementById('editTableId').value), {
        name: document.getElementById('editTableName').value,
        capacity: parseInt(document.getElementById('editTableCapacity').value),
        shape: document.getElementById('editTableShape').value,
        label: document.getElementById('editTableLabel').value,
      });
      e.target.closest('dialog').close();
      toast('Table updated', 'success');
      renderTables(); updateNavStats();
    });

    document.getElementById('btnAutoTables').addEventListener('click', function() {
      var count = parseInt(document.getElementById('autoTableCount').value) || 5;
      var cap = parseInt(document.getElementById('autoTableCapacity').value) || 8;
      if (count < 1 || count > 30) { toast('Count must be 1-30', 'error'); return; }
      var guestCount = DS.guests.list().length;
      var total = count * cap;
      if (guestCount > 0 && total < guestCount) {
        if (!confirm(guestCount + ' guests need at least ' + guestCount + ' seats across ' + count + ' tables (' + total + ' seats). Increase capacity or count?')) return;
      }
      DS.tables.clearAll();
      DS.tables.autoCreate(count, cap);
      toast('Created ' + count + ' tables (capacity: ' + cap + ' each)', 'success');
      renderTables(); updateNavStats();
    });

    // Seating
    document.getElementById('btnGenerate').addEventListener('click', generateSeating);

    document.getElementById('btnClearSeating').addEventListener('click', function() {
      if (!confirm('Clear all seating assignments?')) return;
      DS.seating.clear();
      renderSeating();
      document.getElementById('seatingResults').hidden = true;
      document.getElementById('seatingViolations').hidden = true;
      toast('Seating cleared', 'info');
    });

    document.getElementById('btnExportCSV').addEventListener('click', function() { DS.export.downloadCSV(); });
    document.getElementById('btnExportJSON').addEventListener('click', function() { DS.export.downloadJSON(); });

    document.getElementById('btnResetData').addEventListener('click', function() {
      if (!confirm('This permanently deletes ALL data (guests, relationships, tables, seating). Export first if needed.\n\nReset?')) return;
      DS.reset();
      toast('All data reset', 'info');
      render('dashboard');
    });

    // Populate relation selects on modal open
    var relationBtn = document.querySelector('[data-modal="addRelationModal"]');
    if (relationBtn) {
      relationBtn.addEventListener('click', function() {
        setTimeout(function() {
          var guestsList = DS.guests.list();
          var opts = '';
          for (var i = 0; i < guestsList.length; i++) {
            var g = guestsList[i];
            var label = g.name;
            if (g.role) label += ' (' + g.role + ')';
            opts += '<option value="' + g.id + '">' + esc(label) + '</option>';
          }
          document.getElementById('relGuestA').innerHTML = '<option value="">Select guest</option>' + opts;
          document.getElementById('relGuestB').innerHTML = '<option value="">Select guest</option>' + opts;
        }, 50);
      });
    }

    // Navigate from hash
    var view = location.hash ? location.hash.slice(1) : 'dashboard';
    navigate(view);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
