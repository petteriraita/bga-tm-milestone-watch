(function () {
  'use strict';

  if (window.__tmMilestoneWatchLoaded) return;
  window.__tmMilestoneWatchLoaded = true;

  const PANEL_ID = 'tm-milestone-watch';
  const LAYOUT_KEY = 'tmMilestoneWatchLayout';
  const CHECK_INTERVAL_MS = 1000;
  let lastThreatSignature = '';
  let lastRenderedData = '';
  let watchEnabled = null;

  function isTerraformingMars() {
    return globalThis.gameui?.game_name === 'terraformingmars' ||
      !!document.querySelector('#main_milestones, .bgagame-terraformingmars');
  }

  function forceLogsToSecondColumn() {
    // BGA can leave the selector at 1 while onGameUiWidthChange resets the
    // actual layout to normal. Enforce the framework's real visual state.
    if (globalThis.gameui) globalThis.gameui.log_mode = '2cols';
    document.body?.classList.add('logs_on_additional_column');
    for (const id of [
      'preference_global_control_logsSecondColumn',
      'preference_global_fontrol_logsSecondColumn'
    ]) {
      const select = document.getElementById(id);
      if (select instanceof HTMLSelectElement) select.value = '1';
    }
  }

  function findOperationInfo(node, operationType, seen = new Set()) {
    if (!node || typeof node !== 'object' || seen.has(node)) return null;
    seen.add(node);
    if (node.type === operationType && node.args?.info) return node.args.info;
    for (const value of Object.values(node)) {
      const found = findOperationInfo(value, operationType, seen);
      if (found) return found;
    }
    return null;
  }

  function getMilestones(game) {
    return Object.entries(game.gamedatas?.token_types || {})
      .filter(([id, token]) => id.startsWith('milestone_') && Number.isFinite(Number(token.min)))
      .map(([id, token]) => ({
        id,
        name: token.name || document.getElementById(id)?.dataset.name || id,
        min: Number(token.min),
        number: Number(token.num || id.split('_').pop())
      }))
      .sort((a, b) => a.number - b.number);
  }

  function getAwards(game) {
    return Object.entries(game.gamedatas?.token_types || {})
      .filter(([id]) => id.startsWith('award_'))
      .map(([id, token]) => ({
        id,
        name: token.name || document.getElementById(id)?.dataset.name || id,
        rule: token.r,
        number: Number(token.num || id.split('_').pop())
      }))
      .sort((a, b) => a.number - b.number);
  }

  function liveAwardCounter(rule, color) {
    if (typeof rule !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*(\+[a-zA-Z][a-zA-Z0-9]*)*$/.test(rule)) return null;
    // Restrict direct calculation to raw resources, production and TR.
    // Tag and board rules may include wild tags or other game-specific logic.
    const safeTrackers = new Set(['tr', 'm', 's', 'u', 'p', 'e', 'h', 'pm', 'ps', 'pu', 'pp', 'pe', 'ph']);
    let total = 0;
    for (const term of rule.split('+')) {
      if (!safeTrackers.has(term)) return null;
      const raw = document.getElementById(`tracker_${term}_${color}`)?.dataset.state;
      if (raw == null || raw.trim() === '' || !Number.isFinite(Number(raw))) return null;
      total += Number(raw);
    }
    return total;
  }

  function getWatchData() {
    const game = globalThis.gameui;
    const players = game?.gamedatas?.players;
    const progress = game?.cachedProgressTable || game?.gamedatas?.progressTable;
    const milestones = getMilestones(game);
    const awards = getAwards(game);
    if (!players || !progress || milestones.length === 0) return null;

    const ownId = String(game.player_id || '');
    const opponents = Object.entries(players).sort(([a], [b]) => Number(b === ownId) - Number(a === ownId));

    const milestoneRows = opponents.map(([id, player]) => {
      const info = findOperationInfo(progress[id], 'claim');
      const playerInfo = info || {};
      return {
        id,
        name: player.name || `Player ${id}`,
        color: player.color || '888888',
        milestones: milestones.map((milestone) => {
          const entry = playerInfo[milestone.id] || {};
          const count = entry.c == null ? null : Number(entry.c);
          const error = Number(entry.q || 0);
          const unavailable = !!entry.claimed || error === 7 || error === 10;
          let level = 'far';
          let label = `${count}/${milestone.min}`;
          if (count === null || !Number.isFinite(count)) {
            level = 'far'; label = '?';
          } else if (unavailable) {
            level = 'unavailable';
            label = entry.claimed ? 'claimed' : 'unavailable';
          } else if (count >= milestone.min && error === 0) {
            level = 'claimable';
            label = 'CAN CLAIM';
          } else if (count >= milestone.min) {
            level = 'qualified';
            label = `${count}/${milestone.min} qualified`;
          } else if (milestone.min - count === 1) {
            level = 'near';
            label = `${count}/${milestone.min} ONE AWAY`;
          }
          return { ...milestone, count, level, label };
        })
      };
    }).filter(Boolean);

    const awardRows = opponents.map(([id, player]) => {
      const info = findOperationInfo(progress[id], 'fund');
      const playerInfo = info || {};
      return {
        id,
        name: player.name || `Player ${id}`,
        color: player.color || '888888',
        awards: awards.map((award) => {
          const entry = playerInfo[award.id] || {};
          // For BGA's simple tracker rules, read every live tracker rather than
          // a potentially stale per-player summary. Complex board/card rules
          // use the same counter as BGA's own Awards Summary.
          const liveCounter = liveAwardCounter(award.rule, player.color);
          const rawCounter = liveCounter ?? entry.counter;
          const counter = rawCounter == null || !Number.isFinite(Number(rawCounter)) ? null : Number(rawCounter);
          const vp = entry.vp == null ? null : Number(entry.vp);
          const place = Number(entry.place || 0);
          const unavailable = Number(entry.q || 0) === 10;
          const level = unavailable ? 'unavailable' : vp >= 5 ? 'first' : vp >= 2 ? 'second' : 'far';
          const label = counter === null ? '?' : `${counter} (${liveCounter === null ? 'BGA summary; may be stale' : 'live tracker'}; ${vp ?? '?'} projected VP from BGA summary)`;
          return { ...award, counter, vp, place, level, label };
        })
      };
    }).filter(Boolean);

    return { milestoneRows, awardRows, ownId };
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="tm-watch-header">
        <div class="tm-watch-title">Milestone Watch</div>
        <div class="tm-watch-window-actions">
          <button class="tm-watch-collapse" type="button" title="Collapse">−</button>
          <button class="tm-watch-close" type="button" title="Turn off">×</button>
        </div>
      </div>
      <div class="tm-watch-body">
        <div class="tm-watch-section-title">Milestones</div>
        <div class="tm-watch-milestones"></div>
        <div class="tm-watch-section-title">Awards (score)</div>
        <div class="tm-watch-awards"></div>
      </div>`;
    document.body.appendChild(panel);
    setupWindowControls(panel);
    return panel;
  }

  function readLayout() {
    try { return JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveLayout(panel) {
    const rect = panel.getBoundingClientRect();
    const layout = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: panel.classList.contains('tm-watch-collapsed') ? null : Math.round(rect.height),
      collapsed: panel.classList.contains('tm-watch-collapsed')
    };
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch {}
  }

  function restoreLayout(panel) {
    const layout = readLayout();
    if (Number.isFinite(layout.width)) panel.style.width = `${Math.max(240, layout.width)}px`;
    if (Number.isFinite(layout.height)) panel.style.height = `${Math.max(120, layout.height)}px`;
    if (Number.isFinite(layout.left) && Number.isFinite(layout.top)) {
      const maxLeft = Math.max(0, innerWidth - (layout.width || panel.offsetWidth));
      const maxTop = Math.max(0, innerHeight - 50);
      panel.style.left = `${Math.min(Math.max(0, layout.left), maxLeft)}px`;
      panel.style.top = `${Math.min(Math.max(0, layout.top), maxTop)}px`;
      panel.style.right = 'auto';
    }
    panel.classList.toggle('tm-watch-collapsed', !!layout.collapsed);
    panel.querySelector('.tm-watch-collapse').textContent = layout.collapsed ? '+' : '−';
  }

  function setupWindowControls(panel) {
    restoreLayout(panel);
    const header = panel.querySelector('.tm-watch-header');
    const collapse = panel.querySelector('.tm-watch-collapse');
    const close = panel.querySelector('.tm-watch-close');
    let drag = null;

    header.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button')) return;
      const rect = panel.getBoundingClientRect();
      drag = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      panel.style.left = `${rect.left}px`;
      panel.style.top = `${rect.top}px`;
      panel.style.right = 'auto';
      header.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    header.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const left = Math.min(Math.max(0, event.clientX - drag.x), Math.max(0, innerWidth - panel.offsetWidth));
      const top = Math.min(Math.max(0, event.clientY - drag.y), Math.max(0, innerHeight - 42));
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    });
    const finishDrag = () => {
      if (!drag) return;
      drag = null;
      saveLayout(panel);
    };
    header.addEventListener('pointerup', finishDrag);
    header.addEventListener('pointercancel', finishDrag);

    collapse.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('tm-watch-collapsed');
      collapse.textContent = collapsed ? '+' : '−';
      collapse.title = collapsed ? 'Expand' : 'Collapse';
      saveLayout(panel);
    });
    close.addEventListener('click', () => {
      watchEnabled = false;
      panel.hidden = true;
      document.dispatchEvent(new CustomEvent('tm-watch-set-enabled', { detail: { enabled: false } }));
    });

    let resizeTimer;
    new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => saveLayout(panel), 120);
    }).observe(panel);
  }

  function createComparison(rows, itemKind, ownId) {
    const player = document.createElement('div');
    const legend = document.createElement('div');
    legend.className = 'tm-watch-legend';
    for (const row of rows) {
      const name = document.createElement('span');
      name.textContent = row.name;
      name.style.color = `#${/^[a-f0-9]{6}$/i.test(row.color) ? row.color : 'ffffff'}`;
      legend.appendChild(name);
    }
    player.appendChild(legend);
    const grid = document.createElement('div');
    grid.className = 'tm-watch-grid';
    const key = itemKind === 'milestone' ? 'milestones' : 'awards';
    for (const entry of rows[0]?.[key] || []) {
      const item = document.createElement('div');
      item.className = 'tm-watch-item';
      if (itemKind === 'milestone') {
        const levels = rows.filter(row => row.id !== ownId).map(row => row.milestones.find(value => value.id === entry.id)?.level);
        if (levels.includes('claimable') || levels.includes('qualified')) item.classList.add('tm-watch-milestone-claimable');
        else if (levels.includes('near')) item.classList.add('tm-watch-milestone-near');
        else if (levels.length && levels.every(level => level === 'unavailable')) item.classList.add('tm-watch-milestone-unavailable');
      }
      const itemName = document.createElement('span');
      itemName.textContent = entry.name;
      const itemValue = document.createElement('strong');
      rows.forEach((row, index) => {
        const value = row[key].find(candidate => candidate.id === entry.id);
        if (index) itemValue.append(' / ');
        const number = document.createElement('span');
        number.className = 'tm-watch-number';
        number.textContent = itemKind === 'milestone' ? (value?.count ?? '?') : (value?.counter ?? '?');
        number.style.color = `#${/^[a-f0-9]{6}$/i.test(row.color) ? row.color : 'ffffff'}`;
        number.title = `${row.name}: ${value?.label ?? 'unavailable'}`;
        itemValue.appendChild(number);
      });
      if (itemKind === 'milestone') itemValue.append(` / ${entry.min}`);
      item.append(itemName, itemValue);
      grid.appendChild(item);
    }
    player.appendChild(grid);
    return player;
  }

  function renderData(data) {
    const panel = createPanel();
    const fingerprint = JSON.stringify(data);
    if (fingerprint === lastRenderedData) return;
    lastRenderedData = fingerprint;
    const milestonesContainer = panel.querySelector('.tm-watch-milestones');
    const awardsContainer = panel.querySelector('.tm-watch-awards');
    const threats = [];

    milestonesContainer.replaceChildren();
    awardsContainer.replaceChildren();
    if (!data.milestoneRows.length) {
      milestonesContainer.textContent = 'Progress not available yet.';
      panel.dataset.level = 'far';
      return;
    }

    milestonesContainer.appendChild(createComparison(data.milestoneRows, 'milestone', data.ownId));
    for (const row of data.milestoneRows) {
      if (row.id === data.ownId) continue;
      for (const milestone of row.milestones) {
        if (['claimable', 'qualified', 'near'].includes(milestone.level)) {
          threats.push(`${row.name}:${milestone.name}:${milestone.level}`);
        }
      }
    }
    if (data.awardRows.length) awardsContainer.appendChild(createComparison(data.awardRows, 'award', data.ownId));
    else awardsContainer.textContent = 'Award progress not available yet.';

    panel.dataset.level = threats.some((x) => x.endsWith(':claimable')) ? 'claimable' :
      threats.length ? 'near' : 'far';
    const signature = threats.join('|');
    if (signature && signature !== lastThreatSignature) {
      panel.classList.remove('tm-watch-pulse');
      void panel.offsetWidth;
      panel.classList.add('tm-watch-pulse');
    }
    lastThreatSignature = signature;
  }

  function update() {
    if (!isTerraformingMars()) return;
    forceLogsToSecondColumn();
    if (watchEnabled !== true) return;
    const data = getWatchData();
    if (data) renderData(data);
  }

  document.addEventListener('tm-watch-config', (event) => {
    watchEnabled = event.detail?.enabled !== false;
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.hidden = !watchEnabled;
    if (watchEnabled) update();
  });
  document.dispatchEvent(new Event('tm-watch-request-config'));

  window.setInterval(update, CHECK_INTERVAL_MS);
})();
