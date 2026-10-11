/**
 * 教師端：AI 遊戲提示詞產生器（保留原有造句膠囊流程）
 */
window.PromptGenerator = (() => {
  const optionsData = {
    device: ['平板電腦 📱', '電腦/筆電 💻', '電子白板 🖥️', '智能手機 📱'],
    gameType: ['接球 🧺', '爆破 🎈', '分類 📦', '跑酷 🏃', '射擊 🎯', '迷宮 🧀'],
    mode: ['單人練習 👤', '二人對戰 ⚔️', '雙人合作 🤝', '限時衝刺 ⏱️'],
    character: ['魚 🐟', '小貓 🐱', '蛋糕 🎂', '珍珠奶茶 🧋', '太空人 👨‍🚀', '恐龍 🦖', '魔法師 🧙', '獨角獸 🦄', '自拍照片做主角 📸']
  };

  let state = {
    grade: 'p4',
    device: '平板電腦 📱',
    gameType: '接球 🧺',
    mode: '單人練習 👤',
    topic: '如何比較分數',
    goal: '比較分數與基準值（例如 1/2 或 1）',
    character: '魚 🐟',
    avatarBase64: null,
    exerciseBase64: null
  };

  let activeField = null;
  let curriculumData = null;

  function init() {
    curriculumData = Curriculum.asPromptCurriculum();
    setGrade('p4');
  }

  function setGrade(gradeKey) {
    state.grade = gradeKey;
    ['p4', 'p5', 'p6'].forEach(g => {
      const btn = document.getElementById(`btn-grade-${g}`);
      if (!btn) return;
      btn.className = g === gradeKey
        ? 'py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 bg-amber-400 text-slate-950 shadow-md'
        : 'py-2.5 sm:py-3 px-3 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 bg-slate-800 text-slate-300 hover:text-white';
    });
    const firstTopic = curriculumData[gradeKey].topics[0];
    state.topic = firstTopic.title;
    state.goal = firstTopic.goals[0];
    const lt = document.getElementById('label-topic');
    const lg = document.getElementById('label-goal');
    if (lt) lt.textContent = state.topic;
    if (lg) lg.textContent = state.goal;
    updatePrompt();
  }

  function openPopover(field, triggerEl) {
    activeField = field;
    const popoverBox = document.getElementById('ios-popover-box');
    const backdrop = document.getElementById('popover-backdrop');
    const optionsList = document.getElementById('popover-options-list');
    const popoverTitle = document.getElementById('popover-title');

    let list = [];
    let currentValue = state[field];
    let titleText = '請選擇項目';

    if (field === 'device') { titleText = '選擇遊玩裝置'; list = optionsData.device; }
    else if (field === 'gameType') { titleText = '選擇遊戲方式'; list = optionsData.gameType; }
    else if (field === 'mode') { titleText = '選擇遊玩模式'; list = optionsData.mode; }
    else if (field === 'character') { titleText = '選擇遊戲角色'; list = optionsData.character; }
    else if (field === 'topic') {
      titleText = '選擇教學課題（課本鎖定）';
      list = curriculumData[state.grade].topics.map(t => t.title);
    } else if (field === 'goal') {
      titleText = '選擇學習目標（課本鎖定・不可修改）';
      const cur = curriculumData[state.grade].topics.find(t => t.title === state.topic) || curriculumData[state.grade].topics[0];
      list = cur.goals;
    }

    popoverTitle.textContent = titleText;
    optionsList.innerHTML = '';
    list.forEach(item => {
      const row = document.createElement('div');
      const isSelected = item === currentValue;
      row.className = `ios-option ${isSelected ? 'selected bg-white/70' : ''}`;
      row.innerHTML = `<div class="w-5 text-center text-slate-800 font-black">${isSelected ? '✓' : ''}</div><div class="flex-1">${item}</div>`;
      row.onclick = (e) => { e.stopPropagation(); selectOption(field, item); };
      optionsList.appendChild(row);
    });

    backdrop.classList.remove('hidden');
    popoverBox.classList.remove('hidden');
    popoverBox.style.top = '50%';
    popoverBox.style.left = '50%';
    popoverBox.style.transform = 'translate(-50%, -50%) scale(1)';
    setTimeout(() => {
      popoverBox.classList.remove('opacity-0', 'scale-95');
      popoverBox.classList.add('opacity-100', 'scale-100');
    }, 10);
  }

  function closePopover() {
    const popoverBox = document.getElementById('ios-popover-box');
    const backdrop = document.getElementById('popover-backdrop');
    popoverBox.classList.add('opacity-0', 'scale-95');
    popoverBox.classList.remove('opacity-100', 'scale-100');
    setTimeout(() => {
      popoverBox.classList.add('hidden');
      backdrop.classList.add('hidden');
      activeField = null;
    }, 150);
  }

  function selectOption(field, value) {
    state[field] = value;
    document.getElementById(`label-${field}`).textContent = value;
    if (field === 'topic') {
      const cur = curriculumData[state.grade].topics.find(t => t.title === value);
      if (cur && cur.goals.length) {
        state.goal = cur.goals[0];
        document.getElementById('label-goal').textContent = state.goal;
      }
    }
    const avatarDrawer = document.getElementById('avatar-drawer');
    if (field === 'character' && avatarDrawer) {
      if (value.includes('自拍') || value.includes('相片')) avatarDrawer.classList.remove('hidden');
      else avatarDrawer.classList.add('hidden');
    }
    closePopover();
    updatePrompt();
  }

  function handleAvatarFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.avatarBase64 = e.target.result;
      const img = document.getElementById('avatar-preview-img');
      const placeholder = document.getElementById('avatar-placeholder-icon');
      img.src = state.avatarBase64;
      img.classList.remove('hidden');
      placeholder.classList.add('hidden');
      App.showToast('📸 學生頭像已載入！已寫入提示詞。');
      updatePrompt();
    };
    reader.readAsDataURL(file);
  }

  function handleExerciseFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      state.exerciseBase64 = e.target.result;
      document.getElementById('badge-exercise-status').classList.remove('hidden');
      App.showToast('📑 錯題照片已載入！已加入「AI 結構模仿出題」指令。');
      updatePrompt();
    };
    reader.readAsDataURL(file);
  }

  function updatePrompt() {
    const el = document.getElementById('prompt-output');
    if (!el) return;
    let prompt = `在 ${state.device}，編寫程式碼製作 ${state.gameType} ${state.mode}遊戲幫助學生學習 ${state.topic} 的「${state.goal}」。請讓遊戲元素看起來像 ${state.character}。

【重要遊戲與出題規格規範】：
1. 【防亂碼垂直分數排版】：
   - 分數表達絕對不能出現未排版的斜線或亂碼！
   - 所有分數必須使用乾淨標準的 HTML/CSS 垂直分數排版（例如：<span class="math-frac"><span class="math-num">分子</span><span class="math-den">分母</span></span>）或在 Canvas 中精確繪製水平分數線，保證在平板螢幕上清晰美觀。
2. 【純演算法隨機動態出題（無限題庫）】：
   - 絕對禁止使用死板固定的題目清單！
   - 必須編寫純 JavaScript 題目生成函數（如 generateQuestion()），每輪自動隨機產生合理的分子與分母數字，保證每一次遊玩都是全新題目，題庫無限！
3. 【多元化題目型態】：
   - 題目需融合直式數字分數、帶分數、圓形比例圖 (Canvas/SVG繪製) 與數線等多種幾何視覺表達形式。
${state.exerciseBase64 ? `4. 【學生自學難點模仿出題】：
   - 參考學生上載的自學難點題目照片：請 AI 深度分析該難點題目的數學結構、運算瓶頸與常見易錯點，並在遊戲中「模仿該題型結構，但隨機改變數字」，進行針對性的變式出題與誘答設計！\n` : ''}${state.avatarBase64 ? `5. 【自拍主角】：遊戲開頭提供學生自拍/上傳相片介面，將相片裁切為圓形作為遊戲操控角色。\n` : ''}6. 【輸出規範】：請直接輸出一個完整、可獨立執行的單一 HTML5 檔案（內含所有 HTML、CSS 與 JS，無外部依賴，可直接在瀏覽器打開或嵌入 Google Sites）。`;
    el.value = prompt;
  }

  function copyPromptText() {
    const textarea = document.getElementById('prompt-output');
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    if (!ok && navigator.clipboard) {
      navigator.clipboard.writeText(textarea.value).then(() => showCopySuccess());
    } else showCopySuccess();
  }

  function showCopySuccess() {
    const label = document.getElementById('copy-btn-label');
    const icon = document.getElementById('copy-icon');
    label.textContent = '已成功複製！';
    icon.className = 'fa-solid fa-check';
    App.showToast('✨ 提示詞已複製！可貼到 Gemini 生成遊戲。');
    setTimeout(() => {
      label.textContent = '複製提示詞';
      icon.className = 'fa-regular fa-copy';
    }, 2500);
  }

  function openSandboxModal() { document.getElementById('sandbox-modal').classList.remove('hidden'); }
  function closeSandboxModal() { document.getElementById('sandbox-modal').classList.add('hidden'); }

  function runSandboxCode() {
    const code = document.getElementById('sandbox-code').value;
    const iframe = document.getElementById('sandbox-frame');
    if (!code.trim()) { App.showToast('⚠️ 請先貼上 HTML 程式碼！'); return; }
    iframe.src = URL.createObjectURL(new Blob([code], { type: 'text/html' }));
    App.showToast('🚀 遊戲已成功載入並運行！');
  }

  function loadDemoGame() {
    const demo = `<!DOCTYPE html>
<html lang="zh-HK"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>隨機防亂碼接魚示範</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
body{margin:0;background:#0e1e38;color:white;text-align:center;overflow:hidden;touch-action:none;font-family:sans-serif}
.math-frac{display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;font-weight:bold;line-height:1}
.math-num{border-bottom:2px solid white;padding-bottom:1px}.math-den{padding-top:1px}
</style></head>
<body class="flex flex-col items-center justify-between h-screen p-2">
<div class="w-full max-w-md bg-slate-900/90 rounded-2xl p-2.5 flex justify-between items-center text-xs">
<div>接住大於 <span class="math-frac text-amber-300"><span class="math-num">1</span><span class="math-den">2</span></span> 的分數魚 🐟</div>
<div class="bg-amber-400 text-slate-900 px-3 py-1 rounded-xl font-bold">得分：<span id="sc">0</span></div>
</div>
<canvas id="cv" class="w-full max-w-md flex-1 rounded-2xl my-2 bg-slate-950 border border-slate-800"></canvas>
<div class="text-[11px] text-slate-400 pb-1">左右滑動接住正確的魚！</div>
<script>
const cv=document.getElementById('cv');const ctx=cv.getContext('2d');
let w,h,score=0,bx=120,items=[];
function rs(){w=cv.width=cv.clientWidth;h=cv.height=cv.clientHeight;}
window.onresize=rs;setTimeout(rs,50);
function spawn(){if(!w)return;const den=Math.floor(Math.random()*6)+3;const num=Math.floor(Math.random()*(den-1))+1;
items.push({x:Math.random()*(w-60)+30,y:-20,num,den,val:num/den,speed:2+Math.random()*2});}
setInterval(spawn,1200);
function move(x){const r=cv.getBoundingClientRect();bx=Math.max(30,Math.min(w-30,x-r.left));}
window.onmousemove=e=>move(e.clientX);
window.ontouchmove=e=>{if(e.touches[0])move(e.touches[0].clientX);};
function loop(){if(w&&h){ctx.clearRect(0,0,w,h);ctx.font="30px sans-serif";ctx.textAlign="center";ctx.fillText("🐱🧺",bx,h-25);
for(let i=items.length-1;i>=0;i--){const it=items[i];it.y+=it.speed;ctx.font="20px sans-serif";ctx.fillText("🐟",it.x,it.y);
ctx.fillStyle="#fff";ctx.font="bold 12px sans-serif";ctx.fillText(it.num,it.x,it.y-18);ctx.fillRect(it.x-8,it.y-16,16,2);ctx.fillText(it.den,it.x,it.y-6);
if(it.y>h-50&&Math.abs(it.x-bx)<40){if(it.val>0.5)score+=10;else score=Math.max(0,score-5);document.getElementById('sc').innerText=score;items.splice(i,1);continue;}
if(it.y>h+20)items.splice(i,1);}}requestAnimationFrame(loop);}loop();
<\/script></body></html>`;
    document.getElementById('sandbox-code').value = demo;
    runSandboxCode();
  }

  function openGoogleSitesModal() { document.getElementById('gsites-modal').classList.remove('hidden'); }
  function closeGoogleSitesModal() { document.getElementById('gsites-modal').classList.add('hidden'); }

  return {
    init, setGrade, openPopover, closePopover, selectOption,
    handleAvatarFile, handleExerciseFile, updatePrompt, copyPromptText,
    openSandboxModal, closeSandboxModal, runSandboxCode, loadDemoGame,
    openGoogleSitesModal, closeGoogleSitesModal, optionsData,
    getState: () => state
  };
})();
