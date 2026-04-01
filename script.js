const CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Wx5mHbTZ6cfg72PndaANj8ZjufOAkYOft1RchV_JVzPx1K9LyjkHNuPwkOwpLg/pub?gid=132451101&single=true&output=csv`;
let allData = [];

async function loadData() {
  try {
    const resp = await fetch(CSV_URL);
    const text = await resp.text();
    const rows = text.split('\n').map(r => r.split(','));

    // Skip to header row starting with "Rank"
    const startIdx = rows.findIndex(r => r.join('').includes("Rank"));

    // Clean data: Remove (/100) and GRADE KEY rows
    allData = rows.slice(startIdx).filter(r => {
      const line = r.join(' ');
      return r.some(c => c.trim() !== "") &&
        !line.includes("(/100)") &&
        !line.includes("GRADE KEY");
    });

    renderUI(allData);
  } catch (e) {
    document.getElementById('table-container').innerHTML = "<p style='padding:40px; text-align:center;'>⚠️ Live Sync Connection Error</p>";
  }
}

function renderUI(data) {
  const headers = data[0];
  const students = data.slice(1);
  const colCount = 5; // STRICT STOP AT AVG SCORE

  // Render Podium
  const top3 = students.slice(0, 3);
  const icons = ['🥇', '🥈', '🥉'];
  const classes = ['rank-1', 'rank-2', 'rank-3'];

  document.getElementById('podium-area').innerHTML = top3.map((s, i) => {
    const isFirst = (i === 0);
    return `
      <div class="podium-card ${classes[i]}" ${isFirst ? 'onclick="celebrate()"' : ''}>
        <span class="podium-icon">${icons[i]}</span>
        <span class="podium-name">${s[2]}</span>
        <span class="score-badge">${s[4] || '0.00'}</span>
        ${isFirst ? '<div style="font-size:0.6rem; color:var(--gold); margin-top:8px;">TAP TO CELEBRATE!</div>' : ''}
      </div>
    `;
  }).join('');

  // Render Table
  let html = '<table><thead><tr>';
  for (let i = 0; i < colCount; i++) html += `<th>${headers[i]}</th>`;
  html += '</tr></thead><tbody>';

  students.forEach(s => {
    html += '<tr>';
    for (let i = 0; i < colCount; i++) {
      const val = s[i] || "---";
      html += `<td>${i === 4 ? `<span class="score-badge">${val}</span>` : val}</td>`;
    }
    html += '</tr>';
  });

  document.getElementById('table-container').innerHTML = html + '</tbody></table>';

  const now = new Date();
  document.getElementById('live-date').textContent = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  document.getElementById('sync-status').textContent = `LIVE: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

// Celebration Confetti
function celebrate() {
  const end = Date.now() + 3000;
  (function frame() {
    confetti({ particleCount: 7, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#C0272D'] });
    confetti({ particleCount: 7, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#C0272D'] });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

// Search Feature
document.getElementById('search-input').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allData.slice(1).filter(s => s[2].toLowerCase().includes(term));
  renderUI([allData[0], ...filtered]);
});

// PDF Export
function downloadPDF() {
  const el = document.querySelector('.container');
  document.querySelectorAll('.controls').forEach(c => c.classList.add('no-print'));
  html2pdf().set({ margin: 5, filename: 'Leaderboard.pdf', html2canvas: { scale: 2, backgroundColor: '#080102' }, jsPDF: { unit: 'mm', format: 'a4' } })
    .from(el).save().then(() => {
      document.querySelectorAll('.controls').forEach(c => c.classList.remove('no-print'));
    });
}

loadData();
setInterval(loadData, 300000);