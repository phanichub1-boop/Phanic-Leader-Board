/* ═══════════════════════════════════════════════════════════════
   PHANIC LEADERBOARD — SCRIPT.JS  (v2 — redesigned)
   Changes:
   1. Class Statistics section — rendered from live data
   2. Rank table rows are clickable — each position shows a toast
   3. "Add new student" section removed entirely
   4. Podium section untouched
   ═══════════════════════════════════════════════════════════════ */

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTSyqab0en46TeJxrvZAuhRz1hevjBCer7AvahYsk-7eD6geubmOfWQqBy9MP3PKw/pub?gid=1635849007&single=true&output=csv';

/* ─────────────────────────────────────────────────────────────
   CHAMPION DURATION TRACKING
───────────────────────────────────────────────────────────── */
const CHAMPION_KEY = 'phanic_lb_champion';

function getChampionRecord() {
  try { return JSON.parse(localStorage.getItem(CHAMPION_KEY)); }
  catch { return null; }
}

function setChampionRecord(name) {
  try { localStorage.setItem(CHAMPION_KEY, JSON.stringify({ name, since: Date.now() })); }
  catch { /* storage unavailable */ }
}

function updateChampionTracking(name) {
  const rec = getChampionRecord();
  if (!rec || rec.name !== name) { setChampionRecord(name); return 'Just became Champion! 🎉'; }
  return formatDuration(Date.now() - rec.since);
}

function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor(ms / 60000);
  if (d >= 1) return `Champion for ${d} day${d !== 1 ? 's' : ''}`;
  if (h >= 1) return `Champion for ${h} hr${h !== 1 ? 's' : ''}`;
  if (m >= 1) return `Champion for ${m} min`;
  return 'Just became Champion! 🎉';
}

/* ─────────────────────────────────────────────────────────────
   STATE
   topStudents: always the REAL top 3 from original data.
   Never replaced by search-filtered data.
───────────────────────────────────────────────────────────── */
let allData     = [];
let topStudents = [];

/* ─────────────────────────────────────────────────────────────
   MODAL CONTROLS
───────────────────────────────────────────────────────────── */
function openLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.classList.add('lb-open');
  document.body.style.overflow = 'hidden';
  if (allData.length === 0) loadData();
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  modal.classList.remove('lb-open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLeaderboard(); });

/* ─────────────────────────────────────────────────────────────
   DATA FETCHING
───────────────────────────────────────────────────────────── */
async function loadData() {
  setStatus('SYNCING…', false);
  try {
    const resp = await fetch(CSV_URL + `&_=${Date.now()}`);
    const text = await resp.text();
    const rows = text.split('\n').map(r => r.split(','));

    const startIdx = rows.findIndex(r => r.join('').includes('Rank'));
    if (startIdx === -1) throw new Error('Header not found');

    allData = rows.slice(startIdx).filter(r => {
      const line = r.join(' ');
      return r.some(c => c.trim() !== '')
        && !line.includes('(/100)')
        && !line.includes('GRADE KEY');
    });

    // Lock in the real top 3 — only set once per data load, never by search
    topStudents = allData.slice(1).filter(s => s.some(c => c.trim())).slice(0, 3);

    renderPodium(topStudents);
    renderStats(allData[0], allData.slice(1).filter(s => s.some(c => c.trim())));
    renderTable(allData[0], allData.slice(1).filter(s => s.some(c => c.trim())), 5);
    updateTimestamps();
    setStatus('LIVE', true);
  } catch (err) {
    console.error('Sync error:', err);
    document.getElementById('table-container').innerHTML = `
      <div class="lb-error">
        <div class="lb-error-icon">⚠️</div>
        <p>Unable to sync with Google Sheets.<br/>Please check your connection and try again.</p>
      </div>`;
    setStatus('OFFLINE', false);
  }
}

function setStatus(label, isLive) {
  const pill = document.getElementById('sync-status');
  if (!pill) return;
  pill.querySelector('span:last-child').textContent = label;
  pill.classList.toggle('lb-live', isLive);
}

/* ─────────────────────────────────────────────────────────────
   RENDER — PODIUM
   Called ONLY with topStudents. Never called from search handler.
───────────────────────────────────────────────────────────── */
function renderPodium(students) {
  const podium = document.getElementById('podium-area');
  if (!podium) return;

  const medals   = ['🥇', '🥈', '🥉'];
  const cssClass = ['lb-rank-1', 'lb-rank-2', 'lb-rank-3'];

  podium.innerHTML = students.map((s, i) => {
    const name    = (s[2] || '—').trim();
    const score   = (s[4] || '0.00').trim();
    const isFirst = i === 0;

    const championHTML = isFirst ? `
      <div class="lb-champion-badge">
        <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ${updateChampionTracking(name)}
      </div>
      <span class="lb-celebrate-hint">TAP TO CELEBRATE ✦</span>` : '';

    const safeName = name.replace(/'/g, "\\'");

    return `
      <div class="lb-podium-card ${cssClass[i]}"
        ${isFirst ? `onclick="celebrate('${safeName}')"` : ''}
        role="${isFirst ? 'button' : 'presentation'}"
        ${isFirst ? `tabindex="0" aria-label="Celebrate ${name}"` : ''}>
        <span class="lb-podium-medal">${medals[i]}</span>
        <span class="lb-podium-name">${name}</span>
        <span class="lb-podium-score">${score}</span>
        ${championHTML}
      </div>`;
  }).join('');

  const firstCard = podium.querySelector('.lb-rank-1');
  if (firstCard) {
    firstCard.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        celebrate(topStudents[0] ? (topStudents[0][2] || '').trim() : '');
      }
    });
  }
}


/* ─────────────────────────────────────────────────────────────
   RENDER — CLASS STATISTICS (Redesigned)
   Computes and displays summary stats in dark panel
───────────────────────────────────────────────────────────── */
function renderStats(headers, students) {
  const statsEl = document.getElementById('stats-container');
  if (!statsEl) return;

  const scores = students
    .map(s => parseFloat((s[4] || '').trim()))
    .filter(v => !isNaN(v));

  const total = students.length;
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highest = scores.length ? Math.max(...scores) : 0;
  const passing = scores.filter(v => v >= 50).length;
  const passRate = total ? Math.round((passing / total) * 100) : 0;

  // Update DOM elements
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pass').textContent = passRate + '%';
  document.getElementById('stat-avg').textContent = avg.toFixed(1);
  document.getElementById('stat-top').textContent = highest.toFixed(1);
}

/* ─────────────────────────────────────────────────────────────
   RANK POSITION MESSAGES
   Map of rank → { emoji, label, message }
───────────────────────────────────────────────────────────── */
const RANK_MESSAGES = {
  1:  { emoji: '🥇', label: '1st Place',  msg: 'Excellent job! Keep it up — you are the Champion! 🎉', cls: 'lb-toast-gold'   },
  2:  { emoji: '🥈', label: '2nd Place',  msg: 'Amazing work! You are so close to the top. Push harder! 💪', cls: 'lb-toast-silver' },
  3:  { emoji: '🥉', label: '3rd Place',  msg: 'Great effort! You are on the podium — keep climbing! 🚀', cls: 'lb-toast-bronze' },
  4:  { emoji: '🎯', label: '4th Place',  msg: 'Very good! One more push and you will be on the podium! 🔥', cls: 'lb-toast-accent' },
  5:  { emoji: '⭐', label: '5th Place',  msg: 'Good performance! Stay consistent and aim higher! ⬆️',  cls: ''               },
  6:  { emoji: '💡', label: '6th Place',  msg: 'You are doing well! Keep learning and improving every day.', cls: '' },
  7:  { emoji: '📚', label: '7th Place',  msg: 'Solid work! Dedication is the key — keep at it! 📖', cls: '' },
  8:  { emoji: '🌟', label: '8th Place',  msg: 'Nice effort! Small improvements daily lead to big results.', cls: '' },
  9:  { emoji: '💪', label: '9th Place',  msg: 'Keep going! Every position you gain tells your growth story. 📈', cls: '' },
  10: { emoji: '🎓', label: '10th Place', msg: 'Double digits, but your potential is unlimited! Study hard! 📝', cls: '' },
};

function getRankMessage(rank) {
  if (RANK_MESSAGES[rank]) return RANK_MESSAGES[rank];
  if (rank <= 15) return { emoji: '🌱', label: `${rank}${ordinal(rank)} Place`, msg: 'You are growing! Keep putting in the work — results will follow. 🌿', cls: '' };
  if (rank <= 20) return { emoji: '🏃', label: `${rank}${ordinal(rank)} Place`, msg: 'You are in the race! Make a study plan and stick to it. 📅', cls: '' };
  return { emoji: '💫', label: `${rank}${ordinal(rank)} Place`, msg: 'Every expert was once a beginner. Keep going — you have got this! ✨', cls: '' };
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/* ─────────────────────────────────────────────────────────────
   TOAST — show/hide
───────────────────────────────────────────────────────────── */
let toastTimer = null;

function showRankToast(rank, name) {
  const info = getRankMessage(rank);

  let toast = document.getElementById('lb-rank-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lb-rank-toast';
    toast.className = 'lb-rank-toast';
    toast.innerHTML = `
      <span class="lb-toast-emoji" id="lb-toast-emoji"></span>
      <span class="lb-toast-text">
        <span class="lb-toast-rank" id="lb-toast-rank"></span>
        <span class="lb-toast-msg"  id="lb-toast-msg"></span>
      </span>`;
    document.body.appendChild(toast);
  }

  // Reset accent classes
  toast.className = 'lb-rank-toast';
  if (info.cls) toast.classList.add(info.cls);

  toast.querySelector('#lb-toast-emoji').textContent = info.emoji;
  toast.querySelector('#lb-toast-rank').textContent  = `${name} — ${info.label}`;
  toast.querySelector('#lb-toast-msg').textContent   = info.msg;

  // Show
  requestAnimationFrame(() => {
    toast.classList.add('lb-toast-show');
  });

  // Auto-hide after 4 seconds
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('lb-toast-show');
  }, 4000);
}

/* ─────────────────────────────────────────────────────────────
   RENDER — TABLE
   Now with clickable rows that trigger rank toast.
───────────────────────────────────────────────────────────── */
function renderTable(headers, students, colCount) {
  const container = document.getElementById('table-container');
  if (!container) return;

  if (!students.length) {
    container.innerHTML = `
      <div class="lb-empty">
        <div class="lb-empty-icon">🔍</div>
        <p>No students found matching your search.</p>
      </div>`;
    return;
  }

  let html = `<table role="table" aria-label="Student Rankings"><thead><tr>`;
  for (let i = 0; i < colCount; i++) {
    html += `<th scope="col">${(headers[i] || '').trim()}</th>`;
  }
  html += `</tr></thead><tbody>`;

  students.forEach((s, rowIdx) => {
    const rank      = rowIdx + 1;
    const rankClass = rowIdx < 3 ? ` lb-row-${rowIdx + 1}` : '';
    const delay     = Math.min(rowIdx * 35, 400);
    const name      = (s[2] || '—').trim().replace(/'/g, "\'");

    // Click handler only on name cell, not entire row
    const nameClickAttrs = `onclick="showRankToast(${rank}, '${name}')" title="Click to see position message" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showRankToast(${rank},'${name}');}"`;

    html += `<tr class="${rankClass}" style="animation-delay:${delay}ms">`;

    for (let i = 0; i < colCount; i++) {
      const raw = (s[i] || '—').trim();
      if (i === 0) {
        const topCls = rowIdx === 0 ? ' lb-top-1' : rowIdx === 1 ? ' lb-top-2' : rowIdx === 2 ? ' lb-top-3' : '';
        html += `<td><span class="lb-rank-cell${topCls}">${raw}</span></td>`;
      } else if (i === 2) {
        // Name cell only gets click handler
        html += `<td class="lb-name-cell" ${nameClickAttrs}>${(s[i] || '—').trim()}</td>`;
      } else if (i === colCount - 1) {
        html += `<td><span class="lb-score-badge">${raw}</span></td>`;
      } else {
        html += `<td>${raw}</td>`;
      }
    }
    html += `</tr>`;
  });

  container.innerHTML = html + `</tbody></table>`;
}

/* ─────────────────────────────────────────────────────────────
   TIMESTAMPS
───────────────────────────────────────────────────────────── */
function updateTimestamps() {
  const now = new Date();
  const dateEl = document.getElementById('live-date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).toUpperCase();
  }
  const updEl = document.getElementById('lb-last-updated');
  if (updEl) {
    updEl.textContent = `Last synced: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
}

/* ─────────────────────────────────────────────────────────────
   SEARCH — ONLY updates the TABLE. Podium is never touched.
───────────────────────────────────────────────────────────── */
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');

if (searchInput) {
  searchInput.addEventListener('input', e => {
    const term = e.target.value.toLowerCase().trim();
    if (searchClear) searchClear.style.display = term ? 'flex' : 'none';
    if (!allData.length) return;

    const allStudents = allData.slice(1).filter(s => s.some(c => c.trim()));
    const filtered = term
      ? allStudents.filter(s => (s[2] || '').toLowerCase().includes(term))
      : allStudents;

    renderTable(allData[0], filtered, 5);
  });
}

function clearSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  if (searchClear) searchClear.style.display = 'none';
  if (allData.length) {
    renderStats(allData[0], allData.slice(1).filter(s => s.some(c => c.trim())));
    renderTable(allData[0], allData.slice(1).filter(s => s.some(c => c.trim())), 5);
  }
  searchInput.focus();
}

/* ─────────────────────────────────────────────────────────────
   CHAMPION SOUND — lazy Audio object
───────────────────────────────────────────────────────────── */
let championAudio = null;

function getChampionAudio() {
  if (!championAudio) {
    championAudio = new Audio('champion.mp3');
    championAudio.volume = 1.0;
  }
  return championAudio;
}

/* ─────────────────────────────────────────────────────────────
   CLICK COUNTER — 3rd click triggers twerk
───────────────────────────────────────────────────────────── */
let celebrateClickCount = 0;

/* ─────────────────────────────────────────────────────────────
   CELEBRATE
───────────────────────────────────────────────────────────── */
function celebrate(championName) {
  celebrateClickCount++;

  // ── 3rd click: TWERK MODE ─────────────────────────────────
  if (celebrateClickCount % 3 === 0) {
    triggerTwerk();
    return;
  }

  const card  = document.querySelector('.lb-rank-1');
  const panel = document.querySelector('.lb-panel');
  if (!panel) return;

  // ── 1. AUDIO ──────────────────────────────────────────────
  const audio = getChampionAudio();
  audio.currentTime = 0;
  audio.play().catch(err => console.warn('Audio play failed:', err));

  // Detect actual duration; fall back to 4s if metadata not loaded yet
  const fireDelay = () => {
    const dur = isFinite(audio.duration) && audio.duration > 0
      ? audio.duration * 1000
      : 4000;
    return Math.max(dur - 900, 400);
  };

  // ── 2. CONFETTI with gradual fade ─────────────────────────
  panel.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position:absolute; inset:0; width:100%; height:100%;
    pointer-events:none; z-index:9999; border-radius:inherit;
    transition: opacity 1.4s ease;
  `;
  panel.appendChild(canvas);

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
  const colors = ['#F5C842', '#FFD700', '#8B0000', '#DC143C', '#ffffff', '#FFA500'];

  const BURST_DURATION  = 2800;
  const TAPER_DURATION  = 1200;
  const burstEnd  = Date.now() + BURST_DURATION;
  const taperEnd  = burstEnd + TAPER_DURATION;

  (function frame() {
    const now      = Date.now();
    const inBurst  = now < burstEnd;
    const inTaper  = !inBurst && now < taperEnd;

    if (inBurst) {
      myConfetti({ particleCount: 7, angle: 60,  spread: 65, origin: { x: 0,   y: 0.55 }, colors });
      myConfetti({ particleCount: 7, angle: 120, spread: 65, origin: { x: 1,   y: 0.55 }, colors });
      requestAnimationFrame(frame);
    } else if (inTaper) {
      const progress = (now - burstEnd) / TAPER_DURATION;
      const count    = Math.max(0, Math.round(7 * (1 - progress)));
      if (count > 0) {
        myConfetti({ particleCount: count, angle: 60,  spread: 65, origin: { x: 0,   y: 0.55 }, colors });
        myConfetti({ particleCount: count, angle: 120, spread: 65, origin: { x: 1,   y: 0.55 }, colors });
      }
      requestAnimationFrame(frame);
    } else {
      canvas.style.opacity = '0';
      setTimeout(() => { myConfetti.reset(); canvas.remove(); }, 1500);
    }
  }());

  // ── 3. CARD PULSE ──────────────────────────────────────────
  if (card) card.classList.add('lb-champion-pulse');

  // ── 4. ERUPTION ────────────────────────────────────────────
  const scheduleEruption = () => {
    setTimeout(() => {
      if (card) triggerChampionEruption(card);
    }, fireDelay());
  };

  if (isFinite(audio.duration) && audio.duration > 0) {
    scheduleEruption();
  } else {
    audio.addEventListener('loadedmetadata', scheduleEruption, { once: true });
    setTimeout(scheduleEruption, 100);
  }
}

/* ─────────────────────────────────────────────────────────────
   TWERK — fires on every 3rd click
───────────────────────────────────────────────────────────── */
function triggerTwerk() {
  const audio = getChampionAudio();
  audio.currentTime = 0;
  audio.play().catch(err => console.warn('Audio play failed:', err));

  const podium = document.getElementById('podium-area');
  const card1  = document.querySelector('.lb-rank-1');
  const card2  = document.querySelector('.lb-rank-2');
  const card3  = document.querySelector('.lb-rank-3');
  if (!podium) return;

  [podium, card1, card2, card3].forEach(el => {
    if (el) el.classList.remove('lb-twerk', 'lb-twerk-ripple-l', 'lb-twerk-ripple-r');
  });

  void podium.offsetWidth;

  if (card1) card1.classList.add('lb-twerk');
  if (podium) podium.classList.add('lb-twerk-podium');

  setTimeout(() => { if (card2) card2.classList.add('lb-twerk-ripple-l'); }, 80);
  setTimeout(() => { if (card3) card3.classList.add('lb-twerk-ripple-r'); }, 80);

  const TWERK_DURATION = 2200;
  setTimeout(() => {
    if (card1)  card1.classList.remove('lb-twerk');
    if (card2)  card2.classList.remove('lb-twerk-ripple-l');
    if (card3)  card3.classList.remove('lb-twerk-ripple-r');
    if (podium) podium.classList.remove('lb-twerk-podium');
  }, TWERK_DURATION + 100);
}

/* ─────────────────────────────────────────────────────────────
   ERUPTION ANIMATION
───────────────────────────────────────────────────────────── */
function triggerChampionEruption(card) {
  card.classList.remove('lb-champion-pulse');
  card.classList.add('lb-champion-eruption');

  const overlay = document.createElement('div');
  overlay.className = 'lb-eruption-overlay';
  overlay.innerHTML = generateSparkles();
  card.appendChild(overlay);

  for (let i = 0; i < 5; i++) {
    setTimeout(() => launchCrown(card), i * 140);
  }

  setTimeout(() => {
    card.classList.remove('lb-champion-eruption');
    overlay.remove();
  }, 3500);
}

function generateSparkles() {
  const positions = [
    { x: 15, y: 20 }, { x: 80, y: 10 }, { x: 50, y: 5  },
    { x: 90, y: 50 }, { x: 10, y: 60 }, { x: 70, y: 80 },
    { x: 30, y: 85 }, { x: 55, y: 70 }, { x: 85, y: 25 },
    { x: 20, y: 45 },
  ];
  return positions.map((p, i) => `
    <div class="lb-sparkle" style="
      left:${p.x}%; top:${p.y}%;
      animation-delay:${i * 80}ms;
    ">✦</div>
  `).join('');
}

function launchCrown(card) {
  const crown = document.createElement('div');
  crown.className = 'lb-flying-crown';
  crown.textContent = '👑';
  crown.style.left = `${20 + Math.random() * 60}%`;
  crown.style.animationDuration = `${0.9 + Math.random() * 0.5}s`;
  card.appendChild(crown);
  crown.addEventListener('animationend', () => crown.remove());
}

/* ─────────────────────────────────────────────────────────────
   PDF EXPORT
───────────────────────────────────────────────────────────── */
function downloadPDF() {
  const panel = document.querySelector('.lb-panel');
  if (!panel) return;
  const controls = panel.querySelectorAll('.lb-controls, .lb-close-btn, .lb-sync-pill');
  controls.forEach(el => el.classList.add('lb-no-print'));
  html2pdf()
    .set({
      margin:      [8, 8, 8, 8],
      filename:    `Phanic_Leaderboard_${new Date().toISOString().slice(0, 10)}.pdf`,
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
    })
    .from(panel)
    .save()
    .then(() => controls.forEach(el => el.classList.remove('lb-no-print')));
}

/* ─────────────────────────────────────────────────────────────
   AUTO-OPEN (standalone demo page only)
───────────────────────────────────────────────────────────── */
(function autoOpen() {
  if (document.querySelector('.demo-page')) setTimeout(openLeaderboard, 300);
})();

/* ─────────────────────────────────────────────────────────────
   PERIODIC REFRESH — every 5 min, only when modal is open
───────────────────────────────────────────────────────────── */
setInterval(() => {
  if (document.getElementById('leaderboard-modal')?.classList.contains('lb-open')) loadData();
}, 300000);