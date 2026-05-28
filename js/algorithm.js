/**
 * Wedding Seating Planner — Client-Side Seating Algorithm
 * Ported from Python heuristic with simulated annealing.
 * Runs entirely in the browser — no server needed.
 */

const SeatingAlgorithm = (() => {

  function generate(guests, tables, relationships, maxIterations = 2000, restarts = 10) {
    if (!guests.length) throw new Error('No guests to seat');
    if (!tables.length) throw new Error('No tables defined');

    const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);
    if (totalCapacity < guests.length) {
      throw new Error(`Not enough seats (${totalCapacity}) for ${guests.length} guests`);
    }

    const guestIds = guests.map(g => g.id);
    const tableIds = tables.map(t => t.id);
    const capacities = {};
    tables.forEach(t => capacities[t.id] = t.capacity);

    // Build relationship maps
    const coupleMap = {};    // id -> partner id
    const enemyMap = {};     // id -> Set of ids
    const friendMap = {};    // id -> [{id, weight}]

    for (const r of relationships) {
      const a = r.guest_a_id, b = r.guest_b_id;
      if (r.type === 'couple' || r.type === 'inseparable') {
        coupleMap[a] = b; coupleMap[b] = a;
      } else if (r.type === 'enemy') {
        if (!enemyMap[a]) enemyMap[a] = new Set();
        if (!enemyMap[b]) enemyMap[b] = new Set();
        enemyMap[a].add(b); enemyMap[b].add(a);
      } else if (r.type === 'friend') {
        if (!friendMap[a]) friendMap[a] = [];
        if (!friendMap[b]) friendMap[b] = [];
        friendMap[a].push({ id: b, weight: r.weight });
        friendMap[b].push({ id: a, weight: r.weight });
      }
    }

    function scoreAssignment(assign, tableGuests) {
      // assign: { guestId -> tableId }
      // tableGuests: { tableId -> [guestId] }
      let score = 0;
      let hardMet = 0;
      let hardTotal = 0;
      const violations = [];

      // Hard: enemies must not share a table
      for (const tid of tableIds) {
        const gset = new Set(tableGuests[tid] || []);
        for (const gid of (tableGuests[tid] || [])) {
          if (enemyMap[gid]) {
            for (const eid of enemyMap[gid]) {
              if (gset.has(eid)) {
                hardTotal++;
                violations.push({ type: 'enemy_together', guests: [gid, eid], table_id: tid });
              }
            }
          }
        }
      }
      score -= violations.filter(v => v.type === 'enemy_together').length * 1000;

      // Hard: couples must be together
      const checked = new Set();
      hardMet = 0;
      for (const [gid, partnerId] of Object.entries(coupleMap)) {
        const gidNum = parseInt(gid);
        if (checked.has(gidNum) || checked.has(partnerId)) continue;
        checked.add(gidNum); checked.add(partnerId);
        const tidA = assign[gidNum];
        const tidB = assign[partnerId];
        hardTotal++;
        if (tidA === tidB && tidA !== undefined) {
          hardMet++;
        } else {
          score -= 500;
          violations.push({ type: 'couple_separated', guests: [gidNum, partnerId] });
        }
      }

      // Soft: maximize friendship clusters
      for (const [gid, friends] of Object.entries(friendMap)) {
        const gidNum = parseInt(gid);
        const myTid = assign[gidNum];
        if (myTid === undefined) continue;
        const myTableSet = new Set(tableGuests[myTid] || []);
        for (const f of friends) {
          if (myTableSet.has(f.id)) {
            score += f.weight * 10;
          } else {
            score -= f.weight * 3;
          }
        }
      }

      // Soft: balance tables
      const fills = tableIds.map(tid => (tableGuests[tid]?.length || 0) / capacities[tid]);
      const avgFill = fills.length ? fills.reduce((a, b) => a + b, 0) / fills.length : 0;
      const balancePenalty = fills.reduce((sum, f) => sum + Math.abs(f - avgFill) * 20, 0);
      score -= balancePenalty;

      // Soft: diversity (avoid all-bride/all-groom tables)
      for (const tid of tableIds) {
        const gids = tableGuests[tid] || [];
        if (gids.length < 2) continue;
        const brideCount = gids.filter(id => guests.find(g => g.id === id)?.side === 'bride').length;
        const groomCount = gids.filter(id => guests.find(g => g.id === id)?.side === 'groom').length;
        if (brideCount === gids.length) score -= 30;
        if (groomCount === gids.length) score -= 30;
      }

      return { score, hardMet, hardTotal, violations };
    }

    function buildInitial() {
      const assign = {};
      const remaining = new Set(guestIds);
      const tableGuests = {};
      for (const tid of tableIds) tableGuests[tid] = [];

      // First: place couples together
      // Iterate over a copy since we mutate remaining
      for (const gid of [...remaining]) {
        if (!remaining.has(gid)) continue;
        const partner = coupleMap[gid];
        if (partner !== undefined && remaining.has(partner)) {
          remaining.delete(gid);
          remaining.delete(partner);
          let placed = false;
          // Find table with room for 2
          const sorted = [...tableIds].sort((a, b) => tableGuests[a].length - tableGuests[b].length);
          for (const tid of sorted) {
            if (tableGuests[tid].length + 2 <= capacities[tid]) {
              tableGuests[tid].push(gid, partner);
              assign[gid] = tid;
              assign[partner] = tid;
              placed = true;
              break;
            }
          }
          if (!placed) {
            const tid = sorted[0];
            tableGuests[tid].push(gid, partner);
            assign[gid] = tid;
            assign[partner] = tid;
          }
        }
      }

      // Remaining: place by friendship priority
      function guestPriority(g) {
        return (friendMap[g] || []).length;
      }
      const sorted = [...remaining].sort((a, b) => guestPriority(b) - guestPriority(a));
      for (const gid of sorted) {
        remaining.delete(gid);
        let bestTid = null;
        let bestScore = -Infinity;
        for (const tid of tableIds) {
          if (tableGuests[tid].length >= capacities[tid]) continue;
          const friendsHere = (friendMap[gid] || []).filter(f => tableGuests[tid].includes(f.id)).length;
          const enemiesHere = (enemyMap[gid] && [...enemyMap[gid]].some(e => tableGuests[tid].includes(e))) ? 1 : 0;
          const space = capacities[tid] - tableGuests[tid].length - 1;
          const partner = coupleMap[gid];
          const partnerHere = partner !== undefined && tableGuests[tid].includes(partner);

          let ts = friendsHere * 10 - enemiesHere * 1000 + space * 2;
          if (partnerHere) ts += 50;
          if (ts > bestScore) { bestScore = ts; bestTid = tid; }
        }
        if (bestTid !== null) {
          tableGuests[bestTid].push(gid);
          assign[gid] = bestTid;
        } else {
          // Overflow
          const tid = [...tableIds].sort((a, b) => tableGuests[a].length - tableGuests[b].length)[0];
          tableGuests[tid].push(gid);
          assign[gid] = tid;
        }
      }

      return { assign, tableGuests };
    }

    function mutate(assign, tableGuests) {
      if (guestIds.length < 2) return { assign, tableGuests };

      const g1 = guestIds[Math.floor(Math.random() * guestIds.length)];
      const g2 = guestIds[Math.floor(Math.random() * guestIds.length)];
      if (g1 === g2) return { assign, tableGuests };

      const t1 = assign[g1];
      const t2 = assign[g2];
      if (t1 === t2) return { assign, tableGuests };

      // Check capacity after swap
      if (tableGuests[t1].length - 1 + 1 > capacities[t1]) return { assign, tableGuests }; // actually check: remove g1, add g2
      if (tableGuests[t2].length - 1 + 1 > capacities[t2]) return { assign, tableGuests };

      // Swap
      assign[g1] = t2;
      assign[g2] = t1;
      tableGuests[t1] = tableGuests[t1].filter(x => x !== g1).concat([g2]);
      tableGuests[t2] = tableGuests[t2].filter(x => x !== g2).concat([g1]);

      return { assign, tableGuests };
    }

    // ── Main loop ──
    let bestResult = null;
    let bestScore = -Infinity;

    for (let restart = 0; restart < restarts; restart++) {
      let { assign, tableGuests } = buildInitial();
      let { score: currentScore, hardMet, hardTotal, violations } = scoreAssignment(assign, tableGuests);

      for (let iter = 0; iter < maxIterations; iter++) {
        const { assign: newAssign, tableGuests: newTG } = mutate(assign, tableGuests);
        const result = scoreAssignment(newAssign, newTG);
        const temperature = Math.max(0.01, 1.0 - iter / maxIterations);

        if (result.score > currentScore || Math.random() < Math.exp((result.score - currentScore) / (temperature * 100 + 1))) {
          assign = newAssign;
          tableGuests = newTG;
          currentScore = result.score;
          hardMet = result.hardMet;
          hardTotal = result.hardTotal;
          violations = result.violations;
        }

        if (currentScore > bestScore) {
          bestScore = currentScore;
          bestResult = {
            assignment: Object.entries(assign).map(([gid, tid]) => ({ guest_id: parseInt(gid), table_id: tid })),
            score: currentScore,
            hard_met: hardMet,
            hard_total: hardTotal,
            violations: [...violations],
            iterations: iter + 1,
            table_assignments: Object.fromEntries(
              Object.entries(tableGuests).map(([tid, gids]) => [parseInt(tid), gids])
            ),
          };
        }
      }
    }

    if (!bestResult) {
      // Fallback: round-robin
      const assign = {};
      const tg = {};
      for (const tid of tableIds) tg[tid] = [];
      guests.forEach((g, i) => {
        const tid = tableIds[i % tableIds.length];
        assign[g.id] = tid;
        tg[tid].push(g.id);
      });
      const { score, hardMet, hardTotal, violations } = scoreAssignment(assign, tg);
      bestResult = {
        assignment: Object.entries(assign).map(([gid, tid]) => ({ guest_id: parseInt(gid), table_id: tid })),
        score, hard_met: hardMet, hard_total: hardTotal,
        violations, iterations: 0,
        table_assignments: tg,
      };
    }

    return bestResult;
  }

  return { generate };
})();
