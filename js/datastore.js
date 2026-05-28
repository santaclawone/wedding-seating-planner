/**
 * Wedding Seating Planner — Client-Side Data Store
 * Replaces Flask backend with localStorage persistence.
 * Same schema as SQLite version, same API shape.
 */

const DS = (() => {
  const STORAGE_KEY = 'wedding_planner_data';

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { guests: [], relationships: [], tables: [], seating: [], nextId: { guests: 1, relationships: 1, tables: 1, seating: 1 }, algorithmRuns: [] };
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_data)); } catch {}
  }

  let _data = load();
  let _version = 0;
  let _callbacks = [];

  function onChange(fn) { _callbacks.push(fn); }
  function notify() { _version++; _callbacks.forEach(fn => fn(_data)); }

  // ── Helpers ──
  function nextId(entity) { return _data.nextId[entity]++; }
  function now() { return new Date().toISOString(); }

  // ── Guests ──
  const GuestStore = {
    list() { return [..._data.guests].sort((a, b) => a.name.localeCompare(b.name)); },
    get(id) { return _data.guests.find(g => g.id === id); },
    add({ name, side = 'joint', category = 'other', role = null }) {
      name = name.trim();
      if (!name) throw new Error('Name is required');
      if (_data.guests.some(g => g.name.toLowerCase() === name.toLowerCase())) {
        throw new Error(`Guest "${name}" already exists`);
      }
      const guest = { id: nextId('guests'), name, side, category, role: role || null, created_at: now() };
      _data.guests.push(guest);
      save(); notify();
      return { ...guest };
    },
    bulkAdd(names, side = 'joint', category = 'other', role = null) {
      const added = [];
      const errors = [];
      for (const n of names) {
        const name = n.trim();
        if (!name) continue;
        try {
          const g = this.add({ name, side, category, role });
          added.push(g);
        } catch {
          errors.push(name);
        }
      }
      return { added: added.length, errors, guests: added };
    },
    importCSV(text) {
      const lines = text.split('\n').filter(l => l.trim());
      if (!lines.length) return { added: 0, errors: [], guests: [] };
      // Try to detect header
      const header = lines[0].toLowerCase();
      const hasHeader = /name|guest|side|category|role|type/.test(header) && lines.length > 1;
      const start = hasHeader ? 1 : 0;
      const added = [];
      const errors = [];

      for (let i = start; i < lines.length; i++) {
        const parts = lines[i].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
        if (!parts[0]) continue;
        const name = parts[0];
        const side = ['bride', 'groom'].includes(parts[1]?.toLowerCase()) ? parts[1].toLowerCase() : 'joint';
        const catRaw = (parts[2] || '').toLowerCase().replace(/\s+/g, '_');
        const catMap = { family: 'family', friend: 'friend', work: 'work_colleague', colleague: 'work_colleague', coworker: 'work_colleague', other: 'other' };
        const category = catMap[catRaw] || 'other';
        const role = parts[3] || null;
        try {
          added.push(this.add({ name, side, category, role }));
        } catch {
          errors.push(name);
        }
      }
      return { added: added.length, errors, guests: added };
    },
    update(id, updates) {
      const idx = _data.guests.findIndex(g => g.id === id);
      if (idx === -1) throw new Error('Guest not found');
      if (updates.name && _data.guests.some((g, i) => i !== idx && g.name.toLowerCase() === updates.name.trim().toLowerCase())) {
        throw new Error('Name conflict');
      }
      const g = _data.guests[idx];
      if (updates.name) g.name = updates.name.trim();
      if (updates.side) g.side = updates.side;
      if (updates.category) g.category = updates.category;
      if (updates.role !== undefined) g.role = updates.role || null;
      save(); notify();
      return { ...g };
    },
    delete(id) {
      _data.guests = _data.guests.filter(g => g.id !== id);
      _data.relationships = _data.relationships.filter(r => r.guest_a_id !== id && r.guest_b_id !== id);
      _data.seating = _data.seating.filter(s => s.guest_id !== id);
      save(); notify();
    },
  };

  // ── Relationships ──
  const RelationStore = {
    list() {
      return _data.relationships.map(r => {
        const a = _data.guests.find(g => g.id === r.guest_a_id);
        const b = _data.guests.find(g => g.id === r.guest_b_id);
        return { ...r, guest_a_name: a?.name || '?', guest_b_name: b?.name || '?' };
      }).sort((a, b) => {
        const order = { couple: 0, inseparable: 0, enemy: 1, friend: 2 };
        return (order[a.type] || 9) - (order[b.type] || 9);
      });
    },
    add({ guest_a_id, guest_b_id, type = 'friend', weight = 5 }) {
      if (!guest_a_id || !guest_b_id) throw new Error('Both guests required');
      if (guest_a_id === guest_b_id) throw new Error('Cannot relate a guest to themselves');
      const [a, b] = guest_a_id < guest_b_id ? [guest_a_id, guest_b_id] : [guest_b_id, guest_a_id];
      if (_data.relationships.some(r => r.guest_a_id === a && r.guest_b_id === b)) {
        throw new Error('Relationship already exists');
      }
      const rel = { id: nextId('relationships'), guest_a_id: a, guest_b_id: b, type, weight, created_at: now() };
      _data.relationships.push(rel);
      save(); notify();
      const ga = _data.guests.find(g => g.id === a);
      const gb = _data.guests.find(g => g.id === b);
      return { ...rel, guest_a_name: ga?.name, guest_b_name: gb?.name };
    },
    update(id, { type, weight }) {
      const r = _data.relationships.find(x => x.id === id);
      if (!r) throw new Error('Relationship not found');
      if (type) r.type = type;
      if (weight !== undefined) r.weight = weight;
      save(); notify();
      const ga = _data.guests.find(g => g.id === r.guest_a_id);
      const gb = _data.guests.find(g => g.id === r.guest_b_id);
      return { ...r, guest_a_name: ga?.name, guest_b_name: gb?.name };
    },
    delete(id) {
      _data.relationships = _data.relationships.filter(r => r.id !== id);
      save(); notify();
    },
    matrix() {
      const guests = this._sortedGuests();
      const n = guests.length;
      const gidToIdx = {};
      guests.forEach((g, i) => gidToIdx[g.id] = i);
      const matrix = Array.from({ length: n }, () => Array(n).fill(null));
      for (const r of _data.relationships) {
        const i = gidToIdx[r.guest_a_id];
        const j = gidToIdx[r.guest_b_id];
        if (i !== undefined && j !== undefined) {
          matrix[i][j] = matrix[j][i] = { type: r.type, weight: r.weight };
        }
      }
      return { guests, matrix };
    },
    _sortedGuests() {
      return [..._data.guests].sort((a, b) => a.name.localeCompare(b.name));
    },
  };

  // ── Tables ──
  const TableStore = {
    list() {
      return _data.tables.map(t => ({
        ...t,
        guest_count: _data.seating.filter(s => s.table_id === t.id).length,
      })).sort((a, b) => a.name.localeCompare(b.name));
    },
    get(id) { return _data.tables.find(t => t.id === id); },
    add({ name, capacity = 8, shape = 'round', label = null }) {
      if (!name.trim()) throw new Error('Table name required');
      const table = { id: nextId('tables'), name: name.trim(), capacity, shape, pos_x: 0, pos_y: 0, label, created_at: now() };
      _data.tables.push(table);
      save(); notify();
      return { ...table, guest_count: 0 };
    },
    autoCreate(count, capacity) {
      const created = [];
      for (let i = 1; i <= count; i++) {
        const shape = i === 1 ? 'round' : (i % 2 === 0 ? 'round' : 'rectangular');
        created.push(this.add({ name: `Table ${i}`, capacity: capacity || Math.max(4, 8), shape }));
      }
      return created;
    },
    clearAll() {
      _data.tables = [];
      _data.seating = [];
      save(); notify();
    },
    update(id, updates) {
      const t = _data.tables.find(x => x.id === id);
      if (!t) throw new Error('Table not found');
      if (updates.name) t.name = updates.name.trim();
      if (updates.capacity) t.capacity = updates.capacity;
      if (updates.shape) t.shape = updates.shape;
      if (updates.label !== undefined) t.label = updates.label || null;
      if (updates.pos_x !== undefined) t.pos_x = updates.pos_x;
      if (updates.pos_y !== undefined) t.pos_y = updates.pos_y;
      save(); notify();
      return { ...t, guest_count: _data.seating.filter(s => s.table_id === id).length };
    },
    delete(id) {
      _data.tables = _data.tables.filter(t => t.id !== id);
      _data.seating = _data.seating.filter(s => s.table_id !== id);
      save(); notify();
    },
  };

  // ── Seating ──
  const SeatingStore = {
    list() {
      return _data.seating.map(s => {
        const g = _data.guests.find(x => x.id === s.guest_id);
        const t = _data.tables.find(x => x.id === s.table_id);
        return { ...s, guest_name: g?.name || '?', guest_side: g?.side, guest_category: g?.category, guest_role: g?.role, table_name: t?.name, table_capacity: t?.capacity, table_shape: t?.shape };
      }).sort((a, b) => a.table_id - b.table_id || (a.seat_number || 0) - (b.seat_number || 0));
    },
    save(assignments) {
      _data.seating = assignments.map(a => ({ guest_id: a.guest_id, table_id: a.table_id, seat_number: a.seat_number || null }));
      save(); notify();
    },
    clear() {
      _data.seating = [];
      save(); notify();
    },
    getByTable() {
      const map = {};
      for (const s of _data.seating) {
        if (!map[s.table_id]) map[s.table_id] = [];
        map[s.table_id].push(s);
      }
      return map;
    },
  };

  // ── Statistics ──
  const StatsStore = {
    all() {
      const guestCount = _data.guests.length;
      const totalCapacity = _data.tables.reduce((s, t) => s + t.capacity, 0);
      const seated = _data.seating.length;
      const tableCount = _data.tables.length;
      const relCount = _data.relationships.length;
      const lastRun = _data.algorithmRuns?.[_data.algorithmRuns.length - 1] || null;
      return {
        guests: guestCount,
        total_capacity: totalCapacity,
        seated,
        unseated: guestCount - seated,
        relationships: relCount,
        tables: tableCount,
        last_run: lastRun,
      };
    },
    logRun(result) {
      if (!_data.algorithmRuns) _data.algorithmRuns = [];
      _data.algorithmRuns.push({ ...result, created_at: now() });
      save();
    },
  };

  // ── Export ──
  const ExportStore = {
    json() {
      return {
        guests: [..._data.guests],
        relationships: [..._data.relationships],
        tables: [..._data.tables],
        seating: SeatingStore.list(),
      };
    },
    csv() {
      const rows = [['Table', 'Shape', 'Capacity', 'Guest', 'Side', 'Category', 'Role', 'Seat']];
      for (const s of SeatingStore.list()) {
        rows.push([s.table_name, s.table_shape, s.table_capacity, s.guest_name, s.guest_side, s.guest_category, s.guest_role || '', s.seat_number || '']);
      }
      return rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    },
    downloadJSON() {
      const blob = new Blob([JSON.stringify(this.json(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'wedding_seating_export.json'; a.click();
      URL.revokeObjectURL(url);
    },
    downloadCSV() {
      const blob = new Blob([this.csv()], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'seating_chart.csv'; a.click();
      URL.revokeObjectURL(url);
    },
  };

  // ── Reset ──
  function reset() {
    _data = { guests: [], relationships: [], tables: [], seating: [], nextId: { guests: 1, relationships: 1, tables: 1, seating: 1 }, algorithmRuns: [] };
    save(); notify();
  }

  // Public API
  return {
    get version() { return _version; },
    get raw() { return _data; },
    onChange,
    guests: GuestStore,
    relationships: RelationStore,
    tables: TableStore,
    seating: SeatingStore,
    stats: StatsStore,
    export: ExportStore,
    reset,
  };
})();
