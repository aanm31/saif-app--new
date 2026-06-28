let hhMatchType = "friendly";

async function openSupervisorEvaluation() {
  if (!weeklySupervisor) return showToast("لا يوجد مشرف حاليًا");
  try {
    const qData = await api("supervisor/evaluation-questions");
    const questions = qData.questions.filter(q => q.active);
    if (!questions.length) return showToast("لا توجد أسئلة تقييم متاحة");
    let html = `<h2>📋 تقييم المشرف: ${escapeHtml(weeklySupervisor.name)}</h2><p>قم بتقييم المشرف بناءً على الأسئلة التالية:</p><div class="eval-questions">`;
    questions.forEach((q) => {
      const val = Math.floor(q.score / 2);
      html += `<div class="eval-question"><label><strong>${escapeHtml(q.question_text)}</strong><small>الدرجة القصوى: ${q.score}</small></label><input type="range" min="0" max="${q.score}" value="${val}" id="evalQ-${q.id}" oninput="document.querySelector('#evalVal-${q.id}').textContent=this.value"><span id="evalVal-${q.id}">${val}</span></div>`;
    });
    html += `</div><div class="modal-actions"><button class="outline-button" onclick="closeModal()">إلغاء</button><button class="primary-button" onclick="submitSupervisorEvaluation()">إرسال التقييم</button></div>`;
    openModal(html);
  } catch (error) { showToast(error.message); }
}

async function submitSupervisorEvaluation() {
  if (!weeklySupervisor) return;
  const answers = [];
  document.querySelectorAll("#modalContent .eval-question").forEach(el => {
    const input = el.querySelector("input[type=range]");
    if (input) {
      const id = Number(input.id.replace("evalQ-", ""));
      const score = Number(input.value);
      answers.push({ questionId: id, score });
    }
  });
  try {
    await api("supervisor/evaluations", { method: "POST", body: JSON.stringify({ supervisorId: weeklySupervisor.id, answers }) });
    closeModal();
    showToast("تم إرسال تقييمك للمشرف شكراً لك 🎉");
  } catch (error) { showToast(error.message); }
}

async function renderSupervisorKnight() {
  const page = document.querySelector("#supervisorKnightPage");
  page.innerHTML = `<div class="loading-state">جارٍ تحميل ترتيب فارس المشرفين...</div>`;
  try {
    const data = await api("supervisor/leaderboard");
    const rows = data.leaderboard.length ? data.leaderboard.map((entry, index) => {
      const cls = index === 0 ? "knight-first" : index === 1 ? "knight-second" : index === 2 ? "knight-third" : "";
      const rankIcon = index <= 2 ? ["🥇", "🥈", "🥉"][index] : entry.rank;
      return `<div class="knight-row ${cls}"><span class="knight-rank">${rankIcon}</span><span class="knight-name"><strong>${escapeHtml(entry.name)}</strong></span><span>${entry.contestantScore.toLocaleString("ar-SA")}</span><span>${entry.platformScore.toLocaleString("ar-SA")}</span><span class="knight-total">${entry.totalScore.toLocaleString("ar-SA")}</span></div>`;
    }).join("") : `<div class="empty-state">لا يوجد مشرفين حاليًا</div>`;
    page.innerHTML = pageBanner("فارس المشرفين", "ترتيب المشرفين بناءً على تقييم المتسابقين وتقييم المنصة") + (data.leaderboard.length ? `<div class="knight-table"><div class="knight-head"><span>الترتيب</span><span>الاسم</span><span>تقييم المتسابقين</span><span>تقييم المنصة</span><span>المجموع</span></div>${rows}</div>` : rows);
  } catch (error) { page.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}

function ownerSupervisorSection() {
  return `<div class="owner-panel"><div class="panel-title"><div><h3>👑 تعيين مشرف الأسبوع</h3><p>اختر مستفيداً ليكون مشرف الأسبوع، وستمنحه جميع صلاحيات المالك.</p></div></div><div class="supervisor-assign-form"><select id="supervisorSelect" class="supervisor-select"><option value="">-- اختر مشرفاً --</option>${(authData.users || []).filter(u => u.role === "student" && u.status === "active").map(u => `<option value="${u.id}" ${Number(weeklySupervisor?.id) === Number(u.id) ? "selected" : ""}>${escapeHtml(u.name)} (@${escapeHtml(u.username)})</option>`).join("")}</select><button class="primary-button" onclick="assignSupervisor()">${weeklySupervisor ? "تغيير المشرف" : "تعيين مشرف"}</button>${weeklySupervisor ? `<button class="outline-button" onclick="removeSupervisor()">إلغاء التعيين</button>` : ""}</div>${weeklySupervisor ? `<div class="supervisor-current"><span>👑</span><div><strong>المشرف الحالي:</strong> ${escapeHtml(weeklySupervisor.name)}</div></div>` : ""}</div>`;
}

async function assignSupervisor() {
  const select = document.querySelector("#supervisorSelect");
  const id = Number(select?.value);
  if (!id) return showToast("اختر مستفيداً من القائمة");
  try {
    const data = await api("supervisor/assign", { method: "PUT", body: JSON.stringify({ supervisorId: id }) });
    weeklySupervisor = data.supervisor;
    state.weeklySupervisorId = data.supervisor?.id || null;
    showToast("تم تعيين مشرف الأسبوع بنجاح");
    renderOwner("supervisorAssign");
  } catch (error) { showToast(error.message); }
}

async function removeSupervisor() {
  try {
    await api("supervisor/assign", { method: "PUT", body: JSON.stringify({ supervisorId: 0 }) });
    weeklySupervisor = null;
    state.weeklySupervisorId = null;
    showToast("تم إلغاء تعيين المشرف");
    renderOwner("supervisorAssign");
  } catch (error) { showToast(error.message); }
}

function ownerEvalQuestionsSection() {
  return `<div class="owner-panel"><div class="panel-title"><div><h3>📋 إدارة تقييم المشرفين</h3><p>أضف، عدّل، أو احذف أسئلة تقييم المشرفين. السؤال النشط فقط يظهر للمتسابقين.</p></div><button class="primary-button" onclick="openAddEvalQuestion()">+ سؤال جديد</button></div><div id="evalQuestionsList"><div class="loading-state">جارٍ تحميل الأسئلة...</div></div></div>`;
}

async function loadEvalQuestionsList() {
  const container = document.querySelector("#evalQuestionsList");
  if (!container) return;
  try {
    const data = await api("supervisor/evaluation-questions");
    if (!data.questions.length) { container.innerHTML = `<div class="empty-state">لا توجد أسئلة بعد. أضف أول سؤال.</div>`; return; }
    container.innerHTML = `<div class="table-scroll"><table class="data-table"><thead><tr><th>السؤال</th><th>الدرجة</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>${data.questions.map(q => `<tr><td><strong>${escapeHtml(q.question_text)}</strong></td><td>${q.score}</td><td><button class="${q.active ? "deliver-button" : "edit-button"}" onclick="toggleEvalQuestion(${q.id}, ${q.active ? 0 : 1})">${q.active ? "نشط" : "متوقف"}</button></td><td><div class="table-actions"><button class="edit-button" onclick="openEditEvalQuestion(${q.id})">تعديل</button><button class="delete-button" onclick="deleteEvalQuestion(${q.id})">حذف</button></div></td></tr>`).join("")}</tbody></table></div>`;
  } catch (error) { container.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; }
}

function openAddEvalQuestion() {
  openModal(`<h2>إضافة سؤال تقييم جديد</h2><div class="form-grid"><div class="form-field full"><label>نص السؤال</label><textarea id="evalQuestionText" maxlength="500" placeholder="اكتب سؤال التقييم"></textarea></div><div class="form-field"><label>الدرجة المخصصة</label><input id="evalQuestionScore" type="number" min="1" max="100" value="10"></div></div><div class="modal-actions"><button class="outline-button" onclick="closeModal()">إلغاء</button><button class="primary-button" onclick="saveEvalQuestion()">إضافة السؤال</button></div>`);
}

function openEditEvalQuestion(id) {
  api("supervisor/evaluation-questions").then(data => {
    const q = data.questions.find(item => item.id === id);
    if (!q) return showToast("السؤال غير موجود");
    openModal(`<h2>تعديل السؤال</h2><div class="form-grid"><div class="form-field full"><label>نص السؤال</label><textarea id="evalQuestionText" maxlength="500">${escapeHtml(q.question_text)}</textarea></div><div class="form-field"><label>الدرجة المخصصة</label><input id="evalQuestionScore" type="number" min="1" max="100" value="${q.score}"></div></div><div class="modal-actions"><button class="outline-button" onclick="closeModal()">إلغاء</button><button class="primary-button" onclick="saveEvalQuestion(${id})">حفظ التعديلات</button></div>`);
  }).catch(error => showToast(error.message));
}

async function saveEvalQuestion(id) {
  const text = document.querySelector("#evalQuestionText")?.value.trim();
  const score = Number(document.querySelector("#evalQuestionScore")?.value);
  if (!text || text.length < 3) return showToast("نص السؤال قصير جداً");
  if (!score || score < 1 || score > 100) return showToast("الدرجة يجب أن تكون بين 1 و100");
  try {
    if (id) {
      await api(`supervisor/admin/evaluation-questions/${id}`, { method: "PUT", body: JSON.stringify({ questionText: text, score }) });
    } else {
      await api("supervisor/admin/evaluation-questions", { method: "POST", body: JSON.stringify({ questionText: text, score }) });
    }
    closeModal();
    await loadEvalQuestionsList();
    showToast(id ? "تم تعديل السؤال" : "تمت إضافة السؤال");
  } catch (error) { showToast(error.message); }
}

async function toggleEvalQuestion(id, active) {
  try {
    await api(`supervisor/admin/evaluation-questions/${id}`, { method: "PUT", body: JSON.stringify({ active: !!active }) });
    await loadEvalQuestionsList();
    showToast(active ? "تم تفعيل السؤال" : "تم إيقاف السؤال");
  } catch (error) { showToast(error.message); }
}

async function deleteEvalQuestion(id) {
  if (!confirm("هل أنت متأكد من حذف هذا السؤال؟")) return;
  try {
    await api(`supervisor/admin/evaluation-questions/${id}`, { method: "DELETE" });
    await loadEvalQuestionsList();
    showToast("تم حذف السؤال");
  } catch (error) { showToast(error.message); }
}

function showSupervisorHeadhunterDialog() {
  openModal(`<h2>🧠 نوع المباراة</h2><p>اختر نوع المباراة التي تريد إنشاءها:</p><div class="hh-mode-cards"><button class="hh-mode" onclick="startSupervisorFriendly()"><span>🤝</span><strong>مباراة ودية</strong><small>لا تحتسب نقاط للمشاركين</small></button><button class="hh-mode" onclick="startSupervisorOfficial()"><span>🏆</span><strong>مباراة رسمية</strong><small>تحتسب النقاط في التصنيف الرئيسي</small></button></div><div class="modal-actions"><button class="outline-button" onclick="closeModal()">إلغاء</button></div>`);
}

function startSupervisorFriendly() {
  hhMatchType = "friendly";
  closeModal();
  origRenderHeadhunters();
  showToast("وضع المباراة الودية: لن تحتسب النقاط للمشاركين");
}

function startSupervisorOfficial() {
  hhMatchType = "official";
  closeModal();
  origRenderHeadhunters();
  showToast("وضع المباراة الرسمية: يمكنك اختيار الفرق والمشاركين واعتماد النتائج");
}

const origRenderHeadhunters = renderHeadhunters;
renderHeadhunters = function() {
  if (isSupervisor() && currentUser?.role !== "owner") {
    showSupervisorHeadhunterDialog();
    return;
  }
  origRenderHeadhunters();
};

let selectedEvaluationSupervisorId = null;

async function openSupervisorEvaluationV2() {
  try {
    const [qData, supervisorsData] = await Promise.all([api("supervisor/evaluation-questions"), api("supervisor/contestants")]);
    const questions = qData.questions.filter(q => q.active), supervisors = supervisorsData.supervisors || [];
    if (!supervisors.length) return showToast("لا يوجد مشرف متاح للتقييم");
    if (!questions.length) return showToast("لا توجد أسئلة تقييم مفعلة");
    selectedEvaluationSupervisorId = Number(weeklySupervisor?.id || supervisors[0].id);
    openModal(`<h2>📋 تقييم المشرفين</h2><div class="form-field"><label>اختر المشرف</label><select id="evaluationSupervisorSelect" onchange="selectedEvaluationSupervisorId=Number(this.value)">${supervisors.map(s=>`<option value="${s.id}" ${Number(s.id)===selectedEvaluationSupervisorId?"selected":""}>${escapeHtml(s.name)}</option>`).join("")}</select></div><div class="eval-questions">${questions.map(q=>{const value=Math.floor(Number(q.score)/2);return`<div class="eval-question"><label><strong>${escapeHtml(q.question_text)}</strong><small>الدرجة القصوى: ${q.score}</small></label><input type="range" min="0" max="${q.score}" value="${value}" id="evalQ-${q.id}" oninput="document.querySelector('#evalVal-${q.id}').textContent=this.value"><span id="evalVal-${q.id}">${value}</span></div>`}).join("")}</div><div class="modal-actions"><button class="outline-button" onclick="closeModal()">إلغاء</button><button class="primary-button" onclick="submitSupervisorEvaluationV2()">إرسال التقييم</button></div>`);
  } catch (error) { showToast(error.message); }
}

async function submitSupervisorEvaluationV2() {
  const supervisorId = Number(document.querySelector("#evaluationSupervisorSelect")?.value || selectedEvaluationSupervisorId);
  const answers = [...document.querySelectorAll("#modalContent [id^='evalQ-']")].map(input => ({ questionId: Number(input.id.replace("evalQ-", "")), score: Number(input.value) }));
  try { await api("supervisor/evaluations", { method: "POST", body: JSON.stringify({ supervisorId, answers }) }); closeModal(); showToast("تم إرسال تقييم المشرف بنجاح"); }
  catch (error) { showToast(error.message); }
}

async function createSupervisorHhMatch() {
  const mode=hhDraft.mode;let players=[];
  if(mode==="individual"){const count=Number(document.querySelector("#hhCount").value);players=[...document.querySelectorAll('[name="hhPlayer"]:checked')].map(input=>({userId:Number(input.value),side:String(input.value)}));if(players.length!==count)return showToast(`اختر ${count} مشاركين بالضبط`)}
  else{players=[...document.querySelectorAll('[name="hhTeam"]')].filter(select=>select.value).map(select=>({userId:Number(select.dataset.user),side:select.value}));const a=players.filter(p=>p.side==="A").length,b=players.filter(p=>p.side==="B").length;if(a<2||b<2)return showToast("يجب اختيار شخصين على الأقل في كل فريق")}
  try{const data=await api("game-matches",{method:"POST",body:JSON.stringify({gameKey:hhDraft.game.key,mode,matchType:hhMatchType,rounds:Number(document.querySelector("#hhRounds").value),timer:Number(document.querySelector("#hhTimer")?.value||0),maxBet:Number(document.querySelector("#hhBet")?.value||0),players})});closeModal();hhArena={...data.match,scores:Object.fromEntries(data.match.sides.map(side=>[side.key,0]))};openHhArena()}catch(error){showToast(error.message)}
}

async function finishSupervisorHhMatch() {
  if(!Object.values(hhArena.scores).some(Number))return showToast("سجّل نقطة واحدة على الأقل قبل اعتماد النتيجة");
  try{const result=await api(`game-matches/${hhArena.id}/complete`,{method:"POST",body:JSON.stringify({scores:hhArena.scores})});closeModal();hhData.balance=result.balance;hhData.matches=result.matches;paintHeadhunters();if(result.matchType==="friendly")showToast(`تم اعتماد المباراة الودية دون نقاط · الفائز: ${result.winners.join("، ")}`);else showToast(`تم اعتماد النتيجة وإضافة ${result.awarded} نقطة رئيسية للفائزين`)}catch(error){showToast(error.message)}
}

openSupervisorEvaluation = openSupervisorEvaluationV2;
submitSupervisorEvaluation = submitSupervisorEvaluationV2;
const originalCreateHhMatch = createHhMatch, originalFinishHhMatch = finishHhMatch;
const originalOpenHhArena = openHhArena;
createHhMatch = function(){ return isSupervisor() && currentUser?.role !== "owner" ? createSupervisorHhMatch() : originalCreateHhMatch(); };
finishHhMatch = function(){ return isSupervisor() && currentUser?.role !== "owner" ? finishSupervisorHhMatch() : originalFinishHhMatch(); };
openHhArena = function(){originalOpenHhArena();if(isSupervisor()&&currentUser?.role!=="owner"){const note=document.querySelector("#modalContent .hh-arena-note"),button=[...document.querySelectorAll("#modalContent .modal-actions .primary-button")].at(-1),type=hhArena.matchType==="official"?"مباراة رسمية":"مباراة ودية";if(note)note.insertAdjacentHTML("afterbegin",`<strong>${type}</strong> · `);if(button)button.textContent="اعتماد النتائج"}};

Object.assign(window, { openSupervisorEvaluation, submitSupervisorEvaluation, submitSupervisorEvaluationV2, selectedEvaluationSupervisorId, renderSupervisorKnight, ownerSupervisorSection, assignSupervisor, removeSupervisor, ownerEvalQuestionsSection, loadEvalQuestionsList, openAddEvalQuestion, openEditEvalQuestion, saveEvalQuestion, toggleEvalQuestion, deleteEvalQuestion, showSupervisorHeadhunterDialog, startSupervisorFriendly, startSupervisorOfficial, createHhMatch, openHhArena, finishHhMatch, hhMatchType });
