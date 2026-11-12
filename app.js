/* ==========================================================================
   Data Mining & Exploration (CSC213) - Application Script
   University: Delta University for Science & Technology
   Instructor: Dr. Samia M. Abd-Alhalem
   ========================================================================== */

// --- Global State ---
const State = {
  activeTab: 'overview',
  soundEnabled: true,
  theme: 'dark',
  audioCtx: null,
  
  // Flashcards state
  fcFilter: 'all',
  fcList: [],
  fcIndex: 0,
  fcMastery: {}, // id -> boolean
  
  // Final Exam state
  examStarted: false,
  examFinished: false,
  examTimeLeft: 40 * 60, // 40 minutes in seconds
  examTimerInterval: null,
  examCurrentQ: 0,
  examAnswers: {}, // qIndex -> selectedOptionIndex
  examQuestions: []
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSound();
  renderChapters();
  initFlashcards();
  initLabTools();
  renderKaTeX();
});

// --- KaTeX Auto-Render Helper ---
function renderKaTeX() {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false}
      ],
      throwOnError: false
    });
  }
}

// --- Web Audio API Synthetic Sound Engine ---
function getAudioContext() {
  if (!State.audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      State.audioCtx = new AudioContext();
    }
  }
  if (State.audioCtx && State.audioCtx.state === 'suspended') {
    State.audioCtx.resume();
  }
  return State.audioCtx;
}

function playSound(type) {
  if (!State.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    if (type === 'correct') {
      // Pleasant high double chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.setValueAtTime(880.00, now + 0.1); // A5
      osc2.frequency.setValueAtTime(880.00, now + 0.1);
      
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      osc1.start(now);
      osc2.start(now + 0.1);
      osc1.stop(now + 0.35);
      osc2.stop(now + 0.35);
    } else if (type === 'wrong') {
      // Gentle low buzzer
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(160, now + 0.25);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'click') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(450, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'fanfare') {
      // Triumphant 4-note victory chord
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.1;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    }
  } catch (e) {
    console.warn('Audio not supported or blocked:', e);
  }
}

// --- Theme & Sound Toggles ---
function initTheme() {
  const saved = localStorage.getItem('dm_theme') || 'dark';
  setTheme(saved);
}

function setTheme(theme) {
  State.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dm_theme', theme);
  const icon = document.querySelector('#theme-toggle-btn i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
  }
}

function toggleTheme() {
  playSound('click');
  setTheme(State.theme === 'dark' ? 'light' : 'dark');
}

function initSound() {
  const saved = localStorage.getItem('dm_sound');
  State.soundEnabled = saved !== 'false';
  updateSoundIcon();
}

function updateSoundIcon() {
  const icon = document.querySelector('#sound-toggle-btn i');
  if (icon) {
    icon.className = State.soundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  }
}

function toggleSound() {
  State.soundEnabled = !State.soundEnabled;
  localStorage.setItem('dm_sound', State.soundEnabled);
  updateSoundIcon();
  if (State.soundEnabled) playSound('click');
}

// --- Navigation Tabs ---
function switchTab(tabId) {
  playSound('click');
  State.activeTab = tabId;
  
  // Update Tab Buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });
  
  // Update Tab Views
  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabId}`);
  });
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(renderKaTeX, 50);
}

// --- Render Chapters & In-Section Quizzes ---
function renderChapters() {
  if (!window.COURSE_DATA || !window.COURSE_DATA.chapters) return;
  
  window.COURSE_DATA.chapters.forEach(chapter => {
    const tocEl = document.getElementById(`toc-${chapter.id}`);
    const contentEl = document.getElementById(`content-${chapter.id}`);
    if (!tocEl || !contentEl) return;
    
    let tocHtml = '';
    let contentHtml = '';
    
    chapter.sections.forEach((sec, idx) => {
      // TOC Item
      tocHtml += `
        <li class="toc-item ${idx === 0 ? 'active' : ''}">
          <a href="#${sec.id}" onclick="smoothScrollTo('${sec.id}')">
            <i class="fa-solid fa-angle-left"></i>
            <span>${sec.title}</span>
          </a>
        </li>
      `;
      
      // Section Block
      const quizQuestions = (window.SECTION_QUIZZES && window.SECTION_QUIZZES[sec.id]) || [];
      
      contentHtml += `
        <article id="${sec.id}" class="section-block">
          <header class="section-header">
            <h3 class="section-title">
              <i class="fa-solid ${chapter.icon}"></i>
              ${sec.title}
            </h3>
          </header>
          
          <div class="section-body">
            ${sec.content}
          </div>
          
          ${quizQuestions.length > 0 ? renderSectionQuiz(sec.id, quizQuestions) : ''}
        </article>
      `;
    });
    
    tocEl.innerHTML = tocHtml;
    contentEl.innerHTML = contentHtml;
  });
}

function smoothScrollTo(id) {
  const el = document.getElementById(id);
  if (el) {
    playSound('click');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function renderSectionQuiz(sectionId, questions) {
  let qHtml = `
    <div class="section-quiz-wrapper">
      <div class="quiz-header">
        <h4><i class="fa-solid fa-circle-question"></i> كويز سريع لتاكيد فهم هذه الجزئية</h4>
        <span class="quiz-badge">${questions.length} أسئلة فورية</span>
      </div>
      <div class="quiz-questions-list">
  `;
  
  questions.forEach((q, qIdx) => {
    qHtml += `
      <div class="question-card" id="qcard-${sectionId}-${qIdx}">
        <div class="question-text">${qIdx + 1}. ${q.question}</div>
        <div class="options-list">
          ${q.options.map((opt, optIdx) => `
            <button class="option-btn" onclick="handleOptionSelect('${sectionId}', ${qIdx}, ${optIdx}, this)">
              <span class="option-indicator">${String.fromCharCode(65 + optIdx)}</span>
              <span>${opt}</span>
            </button>
          `).join('')}
        </div>
        <div class="explanation-box" id="exp-${sectionId}-${qIdx}">
          <strong>💡 الشرح والتوضيح:</strong> ${q.explanation}
        </div>
      </div>
    `;
  });
  
  qHtml += `
      </div>
    </div>
  `;
  return qHtml;
}

function handleOptionSelect(sectionId, qIdx, selectedIdx, btnEl) {
  const card = document.getElementById(`qcard-${sectionId}-${qIdx}`);
  if (!card) return;
  
  const questions = window.SECTION_QUIZZES[sectionId];
  if (!questions || !questions[qIdx]) return;
  
  const qData = questions[qIdx];
  const allBtns = card.querySelectorAll('.option-btn');
  const expBox = document.getElementById(`exp-${sectionId}-${qIdx}`);
  
  // Disable all buttons once an answer is chosen
  allBtns.forEach(b => b.disabled = true);
  
  if (selectedIdx === qData.correctIndex) {
    btnEl.classList.add('correct');
    playSound('correct');
  } else {
    btnEl.classList.add('wrong');
    allBtns[qData.correctIndex].classList.add('correct');
    playSound('wrong');
  }
  
  if (expBox) {
    expBox.classList.add('show');
    renderKaTeX();
  }
}

// --- Flashcards System ---
function initFlashcards() {
  State.fcList = [...(window.FLASHCARDS_DATA || [])];
  const savedMastery = localStorage.getItem('dm_fc_mastery');
  if (savedMastery) {
    try { State.fcMastery = JSON.parse(savedMastery); } catch(e){}
  }
  updateFlashcardUI();
}

function filterFlashcards(filter) {
  playSound('click');
  State.fcFilter = filter;
  
  document.querySelectorAll('#fc-filter-group .filter-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-filter') === filter);
  });
  
  const allCards = window.FLASHCARDS_DATA || [];
  if (filter === 'all') {
    State.fcList = [...allCards];
  } else {
    State.fcList = allCards.filter(c => c.chapter === filter);
  }
  
  State.fcIndex = 0;
  updateFlashcardUI();
}

function updateFlashcardUI() {
  const card = State.fcList[State.fcIndex];
  const cardEl = document.getElementById('active-flashcard');
  if (!card || !cardEl) return;
  
  // Always reset flip state when changing card
  cardEl.classList.remove('is-flipped');
  
  setTimeout(() => {
    document.getElementById('fc-category').textContent = card.category;
    document.getElementById('fc-front-text').textContent = card.front;
    document.getElementById('fc-term-en').textContent = card.termEn || '';
    document.getElementById('fc-back-text').textContent = card.back;
    
    document.getElementById('fc-counter').textContent = `${State.fcIndex + 1} / ${State.fcList.length}`;
    
    const percent = ((State.fcIndex + 1) / State.fcList.length) * 100;
    document.getElementById('fc-progress-fill').style.width = `${percent}%`;
    
    renderKaTeX();
  }, 150);
}

function flipFlashcard() {
  playSound('click');
  const cardEl = document.getElementById('active-flashcard');
  if (cardEl) {
    cardEl.classList.toggle('is-flipped');
  }
}

function nextFlashcard() {
  if (State.fcIndex < State.fcList.length - 1) {
    playSound('click');
    State.fcIndex++;
    updateFlashcardUI();
  }
}

function prevFlashcard() {
  if (State.fcIndex > 0) {
    playSound('click');
    State.fcIndex--;
    updateFlashcardUI();
  }
}

function markCardMastery(known) {
  const currentCard = State.fcList[State.fcIndex];
  if (!currentCard) return;
  
  State.fcMastery[currentCard.id] = known;
  localStorage.setItem('dm_fc_mastery', JSON.stringify(State.fcMastery));
  
  playSound(known ? 'correct' : 'click');
  
  if (State.fcIndex < State.fcList.length - 1) {
    nextFlashcard();
  }
}

// --- Interactive Lab Tools Engine ---
function initLabTools() {
  // Setup default presets
}

// Tool 1: Five-Number Summary & Boxplot Outlier Detector
function loadTool1Preset(type) {
  playSound('click');
  const input = document.getElementById('tool1-input');
  if (type === 'slide') {
    input.value = "10, 15, 20, 25, 30, 35, 40, 45, 50, 100";
  } else if (type === 'salaries') {
    input.value = "3000, 3200, 3500, 3600, 3700, 4000, 4200, 85000";
  } else if (type === 'normal') {
    input.value = "12, 18, 20, 22, 25, 25, 28, 30, 32, 38";
  }
  calculateTool1();
}

function calculateTool1() {
  playSound('click');
  const raw = document.getElementById('tool1-input').value;
  const numbers = raw.split(/[\s,]+/).map(Number).filter(n => !isNaN(n)).sort((a, b) => a - b);
  
  const resEl = document.getElementById('tool1-result');
  const svgEl = document.getElementById('tool1-svg');
  
  if (numbers.length < 4) {
    alert('يرجى إدخال 4 أرقام على الأقل لحساب الربيعات.');
    return;
  }
  
  const n = numbers.length;
  const min = numbers[0];
  const max = numbers[n - 1];
  
  // Median helper
  function getMedian(arr) {
    const len = arr.length;
    const mid = Math.floor(len / 2);
    return len % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }
  
  const median = getMedian(numbers);
  
  // Quartiles Q1 and Q3
  const midIndex = Math.floor(n / 2);
  const lowerHalf = numbers.slice(0, midIndex);
  const upperHalf = n % 2 !== 0 ? numbers.slice(midIndex + 1) : numbers.slice(midIndex);
  
  const q1 = getMedian(lowerHalf);
  const q3 = getMedian(upperHalf);
  const iqr = q3 - q1;
  
  const lowerFence = q1 - 1.5 * iqr;
  const upperFence = q3 + 1.5 * iqr;
  
  const outliers = numbers.filter(x => x < lowerFence || x > upperFence);
  const validPoints = numbers.filter(x => x >= lowerFence && x <= upperFence);
  const whiskerLow = validPoints[0];
  const whiskerHigh = validPoints[validPoints.length - 1];
  
  // Display text results
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-row"><span>الحد الأدنى (Min):</span> <span class="result-val">${min}</span></div>
    <div class="result-row"><span>الربيع الأول ($Q_1$):</span> <span class="result-val">${q1}</span></div>
    <div class="result-row"><span>الوسيط ($Q_2$ / Median):</span> <span class="result-val">${median}</span></div>
    <div class="result-row"><span>الربيع الثالث ($Q_3$):</span> <span class="result-val">${q3}</span></div>
    <div class="result-row"><span>الحد الأقصى (Max):</span> <span class="result-val">${max}</span></div>
    <div class="result-row"><span>المدى الربيعي ($IQR = Q_3 - Q_1$):</span> <span class="result-val">${iqr}</span></div>
    <div class="result-row"><span>السياج السفلي ($Q_1 - 1.5 \times IQR$):</span> <span class="result-val">${lowerFence.toFixed(2)}</span></div>
    <div class="result-row"><span>السياج العلوي ($Q_3 + 1.5 \times IQR$):</span> <span class="result-val">${upperFence.toFixed(2)}</span></div>
    <div class="result-row">
      <span>القيم الشاذة المكتشفة (Outliers):</span> 
      <span class="result-val" style="color: ${outliers.length > 0 ? 'var(--danger)' : 'var(--accent)'};">
        ${outliers.length > 0 ? outliers.join(', ') : 'لا توجد قيم شاذة (جميعها داخل الشاربين)'}
      </span>
    </div>
  `;
  
  // Render SVG Boxplot
  renderBoxplotSVG(svgEl, min, max, whiskerLow, q1, median, q3, whiskerHigh, outliers);
  renderKaTeX();
}

function renderBoxplotSVG(svg, min, max, wLow, q1, med, q3, wHigh, outliers) {
  svg.style.display = 'block';
  const width = 400;
  const height = 100;
  const padding = 30;
  const drawWidth = width - padding * 2;
  
  const span = (max - min) || 1;
  const scale = x => padding + ((x - min) / span) * drawWidth;
  
  const yBox = 35;
  const hBox = 30;
  const yCenter = yBox + hBox / 2;
  
  let svgContent = `
    <!-- Scale line -->
    <line x1="${padding}" y1="85" x2="${width - padding}" y2="85" stroke="var(--border-light)" stroke-width="2" />
    <text x="${padding}" y="98" fill="var(--text-muted)" font-size="10" text-anchor="middle">${min}</text>
    <text x="${width - padding}" y="98" fill="var(--text-muted)" font-size="10" text-anchor="middle">${max}</text>
    
    <!-- Whiskers -->
    <line x1="${scale(wLow)}" y1="${yCenter}" x2="${scale(q1)}" y2="${yCenter}" stroke="var(--primary)" stroke-width="2" />
    <line x1="${scale(q3)}" y1="${yCenter}" x2="${scale(wHigh)}" y2="${yCenter}" stroke="var(--primary)" stroke-width="2" />
    <line x1="${scale(wLow)}" y1="${yCenter - 10}" x2="${scale(wLow)}" y2="${yCenter + 10}" stroke="var(--primary)" stroke-width="2" />
    <line x1="${scale(wHigh)}" y1="${yCenter - 10}" x2="${scale(wHigh)}" y2="${yCenter + 10}" stroke="var(--primary)" stroke-width="2" />
    
    <!-- Box -->
    <rect x="${scale(q1)}" y="${yBox}" width="${scale(q3) - scale(q1)}" height="${hBox}" fill="rgba(14, 165, 233, 0.25)" stroke="var(--primary)" stroke-width="2" rx="3" />
    
    <!-- Median Line -->
    <line x1="${scale(med)}" y1="${yBox}" x2="${scale(med)}" y2="${yBox + hBox}" stroke="var(--accent)" stroke-width="3" />
  `;
  
  // Draw Outliers
  outliers.forEach(outlier => {
    svgContent += `
      <circle cx="${scale(outlier)}" cy="${yCenter}" r="5" fill="var(--danger)" stroke="white" stroke-width="1.5">
        <title>قيمة شاذة: ${outlier}</title>
      </circle>
    `;
  });
  
  svg.innerHTML = svgContent;
}

// Tool 2: Binary Proximity & Jaccard Calculator
function loadTool2Preset(preset) {
  playSound('click');
  if (preset === 'jack-mary') {
    document.getElementById('t2-q').value = 1;
    document.getElementById('t2-r').value = 1;
    document.getElementById('t2-s').value = 1;
    document.getElementById('t2-t').value = 3;
  } else if (preset === 'jack-jim') {
    document.getElementById('t2-q').value = 1;
    document.getElementById('t2-r').value = 1;
    document.getElementById('t2-s').value = 1;
    document.getElementById('t2-t').value = 2;
  }
  calculateTool2();
}

function calculateTool2() {
  playSound('click');
  const q = Number(document.getElementById('t2-q').value) || 0;
  const r = Number(document.getElementById('t2-r').value) || 0;
  const s = Number(document.getElementById('t2-s').value) || 0;
  const t = Number(document.getElementById('t2-t').value) || 0;
  
  const total = q + r + s + t;
  const resEl = document.getElementById('tool2-result');
  
  if (total === 0) {
    alert('يرجى إدخال قيم عددية لجدول التوافق.');
    return;
  }
  
  const symDist = (r + s) / total;
  const asymDist = (q + r + s) > 0 ? (r + s) / (q + r + s) : 0;
  const jaccardSim = (q + r + s) > 0 ? q / (q + r + s) : 0;
  
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-row"><span>إجمالي السمات المختبرة ($p$):</span> <span class="result-val">${total}</span></div>
    <div class="result-row"><span>المسافة الثنائية المتماثلة ($d_{\text{sym}} = \frac{r+s}{q+r+s+t}$):</span> <span class="result-val">${symDist.toFixed(3)}</span></div>
    <div class="result-row"><span>المسافة الثنائية غير المتماثلة ($d_{\text{asym}} = \frac{r+s}{q+r+s}$):</span> <span class="result-val">${asymDist.toFixed(3)}</span></div>
    <div class="result-row"><span>معامل تشابه جاكارد ($\text{Jaccard} = \frac{q}{q+r+s}$):</span> <span class="result-val" style="color: var(--accent); font-size: 1.1rem;">${jaccardSim.toFixed(3)} (${(jaccardSim * 100).toFixed(1)}%)</span></div>
  `;
  renderKaTeX();
}

// Tool 3: Normalization Scaler
function loadTool3Preset(preset) {
  playSound('click');
  if (preset === 'slide-salary') {
    document.getElementById('t3-val').value = 73600;
    document.getElementById('t3-min').value = 12000;
    document.getElementById('t3-max').value = 98000;
    document.getElementById('t3-mean').value = 54000;
    document.getElementById('t3-std').value = 16000;
  } else if (preset === 'decimal-example') {
    document.getElementById('t3-val').value = 917;
    document.getElementById('t3-min').value = -986;
    document.getElementById('t3-max').value = 917;
    document.getElementById('t3-mean').value = 150;
    document.getElementById('t3-std').value = 350;
  }
  calculateTool3();
}

function calculateTool3() {
  playSound('click');
  const v = Number(document.getElementById('t3-val').value);
  const min = Number(document.getElementById('t3-min').value);
  const max = Number(document.getElementById('t3-max').value);
  const mean = Number(document.getElementById('t3-mean').value);
  const std = Number(document.getElementById('t3-std').value);
  
  const resEl = document.getElementById('tool3-result');
  
  // 1. Min-Max
  const minMax = (max - min !== 0) ? (v - min) / (max - min) : 0;
  
  // 2. Z-Score
  const zScore = (std !== 0) ? (v - mean) / std : 0;
  
  // 3. Decimal Scaling
  const maxAbs = Math.max(Math.abs(min), Math.abs(max), Math.abs(v));
  let j = 0;
  while (Math.pow(10, j) <= maxAbs) {
    j++;
  }
  const decimalScaled = v / Math.pow(10, j);
  
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-row">
      <span>1. معايرة Min-Max في النطاق $[0, 1]$:</span>
      <span class="result-val">${minMax.toFixed(4)}</span>
    </div>
    <div class="result-row">
      <span>2. معايرة الدرجة المعيارية (Z-Score):</span>
      <span class="result-val">${zScore.toFixed(4)}</span>
    </div>
    <div class="result-row">
      <span>3. معايرة المقياس العشري ($j=${j}$ والقسمة على $10^${j}$):</span>
      <span class="result-val">${decimalScaled.toFixed(4)}</span>
    </div>
  `;
  renderKaTeX();
}

// Tool 4: Chi-Square Test
function loadTool4Preset(preset) {
  playSound('click');
  if (preset === 'lecture-reading') {
    document.getElementById('t4-o11').value = 250;
    document.getElementById('t4-o12').value = 200;
    document.getElementById('t4-o21').value = 50;
    document.getElementById('t4-o22').value = 1000;
  } else if (preset === 'independent') {
    document.getElementById('t4-o11').value = 100;
    document.getElementById('t4-o12').value = 100;
    document.getElementById('t4-o21').value = 200;
    document.getElementById('t4-o22').value = 200;
  }
  calculateTool4();
}

function calculateTool4() {
  playSound('click');
  const o11 = Number(document.getElementById('t4-o11').value) || 0;
  const o12 = Number(document.getElementById('t4-o12').value) || 0;
  const o21 = Number(document.getElementById('t4-o21').value) || 0;
  const o22 = Number(document.getElementById('t4-o22').value) || 0;
  
  const r1 = o11 + o12;
  const r2 = o21 + o22;
  const c1 = o11 + o21;
  const c2 = o12 + o22;
  const n = r1 + r2;
  
  const resEl = document.getElementById('tool4-result');
  if (n === 0) return;
  
  const e11 = (r1 * c1) / n;
  const e12 = (r1 * c2) / n;
  const e21 = (r2 * c1) / n;
  const e22 = (r2 * c2) / n;
  
  const chi11 = Math.pow(o11 - e11, 2) / e11;
  const chi12 = Math.pow(o12 - e12, 2) / e12;
  const chi21 = Math.pow(o21 - e21, 2) / e21;
  const chi22 = Math.pow(o22 - e22, 2) / e22;
  
  const chiSquare = chi11 + chi12 + chi21 + chi22;
  const df = (2 - 1) * (2 - 1); // 1
  const criticalVal = 10.828; // at alpha = 0.001
  const isCorrelated = chiSquare > criticalVal;
  
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-row"><span>إجمالي العينة ($n$):</span> <span class="result-val">${n}</span></div>
    <div class="result-row"><span>التكرارات المتوقعة ($E_{ij}$):</span> <span class="result-val">E11=${e11.toFixed(1)}, E12=${e12.toFixed(1)}, E21=${e21.toFixed(1)}, E22=${e22.toFixed(1)}</span></div>
    <div class="result-row"><span>قيمة مربع كاي المحسوبة ($\chi^2$):</span> <span class="result-val" style="font-size: 1.15rem; color: var(--primary);">${chiSquare.toFixed(2)}</span></div>
    <div class="result-row"><span>درجات الحرية (df):</span> <span class="result-val">${df}</span></div>
    <div class="result-row"><span>القيمة الحرجة عند دلالة $\alpha = 0.001$:</span> <span class="result-val">${criticalVal}</span></div>
    <div class="result-row">
      <span>القرار الإحصائي:</span> 
      <span class="result-val" style="color: ${isCorrelated ? 'var(--accent)' : 'var(--warning)'}; font-weight: 800;">
        ${isCorrelated ? 'نرفض الاستقلال: يوجد ارتباط دال إحصائياً بين الصفتين! (كما بمثال المحاضرة 507.93)' : 'نقبل فرضية الاستقلال: لا يوجد ارتباط معنوي بين الصفتين.'}
      </span>
    </div>
  `;
  renderKaTeX();
}

// Tool 5: Gini Index & Split Gain
function loadTool5Preset(preset) {
  playSound('click');
  if (preset === 'lecture-gini') {
    document.getElementById('t5-p-yes').value = 6;
    document.getElementById('t5-p-no').value = 4;
    document.getElementById('t5-l-yes').value = 4;
    document.getElementById('t5-l-no').value = 0;
    document.getElementById('t5-r-yes').value = 2;
    document.getElementById('t5-r-no').value = 4;
  } else if (preset === 'pure-split') {
    document.getElementById('t5-p-yes').value = 5;
    document.getElementById('t5-p-no').value = 5;
    document.getElementById('t5-l-yes').value = 5;
    document.getElementById('t5-l-no').value = 0;
    document.getElementById('t5-r-yes').value = 0;
    document.getElementById('t5-r-no').value = 5;
  }
  calculateTool5();
}

function calculateTool5() {
  playSound('click');
  const pYes = Number(document.getElementById('t5-p-yes').value) || 0;
  const pNo = Number(document.getElementById('t5-p-no').value) || 0;
  const lYes = Number(document.getElementById('t5-l-yes').value) || 0;
  const lNo = Number(document.getElementById('t5-l-no').value) || 0;
  const rYes = Number(document.getElementById('t5-r-yes').value) || 0;
  const rNo = Number(document.getElementById('t5-r-no').value) || 0;
  
  const pTotal = pYes + pNo;
  const lTotal = lYes + lNo;
  const rTotal = rYes + rNo;
  
  const resEl = document.getElementById('tool5-result');
  if (pTotal === 0 || (lTotal + rTotal === 0)) return;
  
  function getGini(yes, no) {
    const tot = yes + no;
    if (tot === 0) return 0;
    const p1 = yes / tot;
    const p2 = no / tot;
    return 1 - (p1 * p1 + p2 * p2);
  }
  
  const parentGini = getGini(pYes, pNo);
  const leftGini = getGini(lYes, lNo);
  const rightGini = getGini(rYes, rNo);
  
  const splitGini = (lTotal / pTotal) * leftGini + (rTotal / pTotal) * rightGini;
  const gain = parentGini - splitGini;
  
  resEl.style.display = 'block';
  resEl.innerHTML = `
    <div class="result-row"><span>مؤشر جيني للعقدة الأم (Parent Gini):</span> <span class="result-val">${parentGini.toFixed(3)}</span></div>
    <div class="result-row"><span>مؤشر جيني للابن الأيسر (Left Child):</span> <span class="result-val">${leftGini.toFixed(3)} ${leftGini === 0 ? '(نقاء تام! Pure Node)' : ''}</span></div>
    <div class="result-row"><span>مؤشر جيني للابن الأيمن (Right Child):</span> <span class="result-val">${rightGini.toFixed(3)}</span></div>
    <div class="result-row"><span>عدم النقاء الموزون للتقسيم (Weighted Split Gini):</span> <span class="result-val">${splitGini.toFixed(3)}</span></div>
    <div class="result-row">
      <span>كسب انقسام جيني ($\Delta_{\text{Gini}}$ Gain):</span> 
      <span class="result-val" style="color: var(--accent); font-size: 1.2rem; font-weight: 800;">+${gain.toFixed(3)}</span>
    </div>
  `;
  renderKaTeX();
}

// --- Final Exam Simulator Engine ---
function startExam() {
  playSound('click');
  const nameInput = document.getElementById('student-name-input');
  if (nameInput && nameInput.value.trim() !== '') {
    localStorage.setItem('dm_student_name', nameInput.value.trim());
  }
  
  State.examStarted = true;
  State.examFinished = false;
  State.examTimeLeft = 40 * 60;
  State.examAnswers = {};
  State.examCurrentQ = 0;
  State.examQuestions = [...(window.FINAL_EXAM_DATA || [])];
  
  document.getElementById('exam-start-card').style.display = 'none';
  document.getElementById('exam-results-card').style.display = 'none';
  document.getElementById('exam-interface').classList.add('active');
  
  renderExamPalette();
  renderExamActiveQuestion();
  startExamTimer();
}

function startExamTimer() {
  clearInterval(State.examTimerInterval);
  updateTimerDisplay();
  
  State.examTimerInterval = setInterval(() => {
    State.examTimeLeft--;
    updateTimerDisplay();
    
    if (State.examTimeLeft <= 0) {
      clearInterval(State.examTimerInterval);
      alert('انتهى الوقت المخصص للامتحان (40 دقيقة)! سيتم الآن تسليم إجاباتك وعرض النتيجة.');
      finishExam(false);
    }
  }, 1000);
}

function updateTimerDisplay() {
  const min = Math.floor(State.examTimeLeft / 60);
  const sec = State.examTimeLeft % 60;
  const text = `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  
  const timerDisplay = document.getElementById('timer-text');
  if (timerDisplay) timerDisplay.textContent = text;
  
  const wrapper = document.getElementById('exam-timer-display');
  if (wrapper) {
    wrapper.classList.toggle('warning', State.examTimeLeft <= 300); // 5 min warning
  }
}

function renderExamPalette() {
  const palEl = document.getElementById('exam-palette');
  if (!palEl) return;
  
  let html = '';
  State.examQuestions.forEach((q, idx) => {
    const isAnswered = State.examAnswers[idx] !== undefined;
    const isCurrent = idx === State.examCurrentQ;
    html += `
      <button class="palette-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" onclick="jumpToExamQ(${idx})">
        ${idx + 1}
      </button>
    `;
  });
  palEl.innerHTML = html;
}

function jumpToExamQ(idx) {
  playSound('click');
  State.examCurrentQ = idx;
  renderExamPalette();
  renderExamActiveQuestion();
}

function renderExamActiveQuestion() {
  const qBox = document.getElementById('exam-question-box');
  const qNumDisplay = document.getElementById('exam-current-q-num');
  if (!qBox || !State.examQuestions[State.examCurrentQ]) return;
  
  const q = State.examQuestions[State.examCurrentQ];
  const qIdx = State.examCurrentQ;
  
  if (qNumDisplay) {
    qNumDisplay.textContent = `${qIdx + 1} / ${State.examQuestions.length}`;
  }
  
  const selected = State.examAnswers[qIdx];
  
  qBox.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <span class="card-category-badge">الفصل ${q.chapter}</span>
      <span style="font-size: 0.85rem; color: var(--text-muted);">سؤال رقم ${qIdx + 1}</span>
    </div>
    <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 1.25rem;">
      ${q.question}
    </h4>
    <div class="options-list">
      ${q.options.map((opt, optIdx) => `
        <button class="option-btn ${selected === optIdx ? 'correct' : ''}" onclick="selectExamAnswer(${optIdx})">
          <span class="option-indicator">${String.fromCharCode(65 + optIdx)}</span>
          <span>${opt}</span>
        </button>
      `).join('')}
    </div>
  `;
  renderKaTeX();
}

function selectExamAnswer(optIdx) {
  playSound('click');
  State.examAnswers[State.examCurrentQ] = optIdx;
  renderExamPalette();
  renderExamActiveQuestion();
}

function examNextQ() {
  if (State.examCurrentQ < State.examQuestions.length - 1) {
    playSound('click');
    State.examCurrentQ++;
    renderExamPalette();
    renderExamActiveQuestion();
  }
}

function examPrevQ() {
  if (State.examCurrentQ > 0) {
    playSound('click');
    State.examCurrentQ--;
    renderExamPalette();
    renderExamActiveQuestion();
  }
}

function finishExam(confirmPrompt) {
  if (confirmPrompt) {
    const answeredCount = Object.keys(State.examAnswers).length;
    const total = State.examQuestions.length;
    const msg = answeredCount < total 
      ? `لقد أجبت على ${answeredCount} من أصل ${total} سؤالاً. هل أنت متأكد من رغبتك في تسليم الامتحان الآن؟`
      : 'هل أنت متأكد من تسليم ورقة الامتحان النهائية؟';
    if (!confirm(msg)) return;
  }
  
  clearInterval(State.examTimerInterval);
  State.examFinished = true;
  
  // Calculate Score
  let correctCount = 0;
  State.examQuestions.forEach((q, idx) => {
    if (State.examAnswers[idx] === q.correctIndex) {
      correctCount++;
    }
  });
  
  const total = State.examQuestions.length;
  const percent = Math.round((correctCount / total) * 100);
  const passed = percent >= 70;
  
  document.getElementById('exam-interface').classList.remove('active');
  const resultsCard = document.getElementById('exam-results-card');
  resultsCard.style.display = 'block';
  
  // Update Results UI
  const titleEl = document.getElementById('result-status-title');
  const descEl = document.getElementById('result-status-desc');
  const scorePercentEl = document.getElementById('result-score-percent');
  const scoreRatioEl = document.getElementById('result-score-ratio');
  const certWrapper = document.getElementById('certificate-wrapper');
  
  scorePercentEl.textContent = `${percent}%`;
  scoreRatioEl.textContent = `${correctCount} / ${total}`;
  
  if (passed) {
    playSound('fanfare');
    titleEl.textContent = '🎉 مبارك! لقد اجتزت الامتحان بنجاح فائق';
    titleEl.style.color = 'var(--accent)';
    descEl.textContent = 'تهانينا! أظهرت فهماً متميزاً لمفاهيم ومسائل تنقيب البيانات وفق المعايير الأكاديمية.';
    certWrapper.style.display = 'block';
    
    // Fill certificate data
    const studentName = localStorage.getItem('dm_student_name') || 'طالب متميز';
    document.getElementById('cert-student-name').textContent = studentName;
    
    let gradeTitle = 'مقبول';
    if (percent >= 85) gradeTitle = 'امتياز (Excellent)';
    else if (percent >= 75) gradeTitle = 'جيد جداً (Very Good)';
    else if (percent >= 70) gradeTitle = 'جيد (Good)';
    
    document.getElementById('cert-grade').textContent = `${percent}% — ${gradeTitle}`;
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('cert-date').textContent = dateStr;
  } else {
    playSound('wrong');
    titleEl.textContent = 'تحتاج إلى مزيد من المراجعة والاستذكار';
    titleEl.style.color = 'var(--warning)';
    descEl.textContent = `حصلت على ${percent}%. نسبة الاجتياز المطلوبة هي 70%. راجع شروحات الفصول وأعد الاختبار مجدداً.`;
    certWrapper.style.display = 'none';
  }
}

function restartExam() {
  playSound('click');
  document.getElementById('exam-results-card').style.display = 'none';
  document.getElementById('exam-start-card').style.display = 'block';
}

// --- Global Search Functionality ---
function handleSearch(query) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return;
  
  // Search through course sections
  let foundTab = null;
  let foundSectionId = null;
  
  for (const ch of window.COURSE_DATA.chapters) {
    for (const sec of ch.sections) {
      if (sec.title.toLowerCase().includes(q) || sec.content.toLowerCase().includes(q)) {
        foundTab = ch.id;
        foundSectionId = sec.id;
        break;
      }
    }
    if (foundTab) break;
  }
  
  if (foundTab && foundSectionId) {
    switchTab(foundTab);
    setTimeout(() => {
      smoothScrollTo(foundSectionId);
    }, 200);
  }
}
