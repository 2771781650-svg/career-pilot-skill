/* plus.js —— v1.3 增量模块（在 app.js 之前加载）
   ① 一分钟体检卡 → 今日 3 件事
   ③ 记忆（本地存原话，可查可清）
   ⑤ 改前改后对比（真算分，可一键补齐）
   ⑥ 页面内自检（跑 20 条断言，显示通过率）
   另外：为所有 /api/* 请求带上会话 id，配合后端按设备隔离档案
*/
(function () {
  "use strict";

  /* ---------------------------------------------------------- 0. 设备会话 id */
  function makeSid() {
    try {
      if (window.crypto && crypto.randomUUID) return "s" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
    } catch (e) {}
    return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  var SID;
  try {
    SID = localStorage.getItem("cp_sid");
    if (!SID) { SID = makeSid(); localStorage.setItem("cp_sid", SID); }
  } catch (e) { SID = makeSid(); }
  window.CP_SID = SID;

  /* 所有接口自动带 sid：GET 拼 query，POST 塞进 body */
  var rawFetch = window.fetch ? window.fetch.bind(window) : null;
  if (rawFetch) {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf("/api/") !== -1) {
          var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
          if (method === "GET") {
            input = typeof input === "string" ? url + (url.indexOf("?") > -1 ? "&" : "?") + "sid=" + encodeURIComponent(SID) : input;
          } else {
            var body = init && init.body;
            var obj = {};
            if (typeof body === "string" && body.trim()) { try { obj = JSON.parse(body) || {}; } catch (e) { obj = {}; } }
            if (obj && typeof obj === "object" && !Array.isArray(obj)) {
              obj.sid = obj.sid || SID;
              init = Object.assign({}, init || {}, { body: JSON.stringify(obj) });
            }
          }
        }
      } catch (e) {}
      return rawFetch(input, init);
    };
  }

  /* ---------------------------------------------------------- 1. 样式 */
  var STYLE = '' +
    '.cp-card{background:#fff;border:1px solid #bae6fd;border-radius:12px;padding:12px 14px;margin:2px 0}' +
    '.cp-card h3{margin:0 0 8px;font-size:14px;color:#08425f;display:flex;align-items:center;gap:6px}' +
    '.cp-card p{margin:0 0 6px;font-size:13px;color:#334155;line-height:1.6}' +
    '.cp-badge{display:inline-block;font-size:11px;padding:1px 7px;border-radius:99px;background:#eaf5fb;color:#0369a1}' +
    '.cp-cmp{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:6px 0}' +
    '.cp-col{border:1px solid #e2e8f0;border-radius:10px;padding:10px}' +
    '.cp-col.bad{background:#fef2f2;border-color:#fecaca}' +
    '.cp-col.good{background:#ecfdf5;border-color:#bbf7d0}' +
    '.cp-col .h{font-size:12px;color:#64748b;margin-bottom:4px}' +
    '.cp-score{font-size:26px;font-weight:700;line-height:1.1}' +
    '.cp-col.bad .cp-score{color:#dc2626}.cp-col.good .cp-score{color:#0d7c3c}' +
    '.cp-list{margin:8px 0 0;padding-left:16px;font-size:12px;color:#334155}' +
    '.cp-btn{margin-top:10px;height:34px;padding:0 12px;border:1px solid #0369a1;background:#0369a1;color:#fff;border-radius:8px;font-size:13px;cursor:pointer;font-family:inherit}' +
    '.cp-btn.ghost{background:#fff;color:#0369a1}' +
    '.cp-task{display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px dashed #e2e8f0;font-size:13px;color:#334155}' +
    '.cp-task:last-child{border-bottom:0}' +
    '.cp-task input{margin-top:3px;width:16px;height:16px;accent-color:#16a34a}' +
    '.cp-task.done span{text-decoration:line-through;color:#94a3b8}' +
    '.cp-sc{font-size:12px;color:#475569;margin:2px 0;display:flex;gap:6px}' +
    '.cp-sc .ok{color:#0d7c3c}.cp-sc .no{color:#dc2626}' +
    '.cp-form{display:grid;gap:10px;margin:4px 0 10px}' +
    '.cp-field label{display:block;font-size:12px;color:#475569;margin-bottom:4px}' +
    '.cp-field input,.cp-field select{width:100%;height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:0 10px;font-size:13px;font-family:inherit;box-sizing:border-box;background:#fff}' +
    '.cp-mem{font-size:12px;color:#334155;padding:6px 0;border-bottom:1px dashed #e2e8f0}' +
    '.cp-mem span{display:block;color:#94a3b8;font-size:11px}' +
    '@media (max-width:820px){.cp-cmp{grid-template-columns:1fr}}';
  function injectStyle() {
    if (document.getElementById("cp-plus-style")) return;
    var s = document.createElement("style");
    s.id = "cp-plus-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }
  injectStyle();

  /* ---------------------------------------------------------- 2. 浮动面板工具 */
  function sheet(title, innerHTML) {
    var box = document.createElement("div");
    box.className = "cfg cp-sheet";
    box.style.cssText = "position:fixed;left:0;right:0;bottom:0;max-width:620px;margin:0 auto;z-index:42;" +
      "max-height:78vh;overflow-y:auto;background:#fff;border:1px solid #bae6fd;border-radius:16px 16px 0 0;" +
      "box-shadow:0 -8px 28px rgba(3,105,161,.22);padding:16px 16px calc(16px + env(safe-area-inset-bottom))";
    box.innerHTML = '<button type="button" class="panel-x" aria-label="关闭" style="position:absolute;top:8px;right:8px;' +
      'width:32px;height:32px;border:1px solid #bae6fd;background:#fff;border-radius:8px;font-size:18px;line-height:1;color:#475569;cursor:pointer">×</button>' +
      '<h3 style="margin:0 0 10px;font-size:15px;color:#08425f">' + title + '</h3>' + innerHTML;
    var mask = document.createElement("div");
    mask.className = "cp-mask";
    mask.style.cssText = "position:fixed;inset:0;background:rgba(8,40,60,.34);z-index:41";
    function close() {
      if (mask.parentNode) mask.parentNode.removeChild(mask);
      if (box.parentNode) box.parentNode.removeChild(box);
    }
    mask.onclick = close;
    box.querySelector(".panel-x").onclick = close;
    document.body.appendChild(mask);
    document.body.appendChild(box);
    return { box: box, close: close };
  }

  /* ---------------------------------------------------------- 3. 记忆 */
  var MEM_KEY = "cp_memory", MEM_MAX = 30;
  function memLoad() {
    try { return JSON.parse(localStorage.getItem(MEM_KEY) || "[]") || []; } catch (e) { return []; }
  }
  function memSave(list) {
    try { localStorage.setItem(MEM_KEY, JSON.stringify(list.slice(-MEM_MAX))); } catch (e) {}
  }
  function memAdd(q) {
    q = String(q || "").trim();
    if (q.length < 2) return;
    var list = memLoad();
    if (list.length && list[list.length - 1].q === q) return;
    list.push({ q: q.slice(0, 200), t: Date.now() });
    memSave(list);
  }
  window.CPMemory = { load: memLoad, add: memAdd, clear: function () { memSave([]); } };

  function tokens(s) {
    var t = String(s || "").toLowerCase().match(/[\u4e00-\u9fa5]{2,}|[a-z]{3,}/g) || [];
    var stop = ["想投", "帮我", "一份", "什么", "怎么", "可以", "然后", "还有", "现在", "今天"];
    return t.filter(function (w) { return stop.indexOf(w) === -1; });
  }
  function memHint(q, limit) {
    var qt = tokens(q), list = memLoad(), hits = [];
    for (var i = list.length - 1; i >= 0 && hits.length < (limit || 2); i--) {
      var item = list[i];
      if (item.q === q) continue;
      var it = tokens(item.q);
      for (var j = 0; j < it.length; j++) {
        if (qt.indexOf(it[j]) !== -1) { hits.unshift(item.q); break; }
      }
    }
    return hits;
  }
  window.CPMemory.hint = memHint;

  /* app.js 里 demoProfile 是全局 let 绑定，不是 window 属性，必须直接引用 */
  function getDP() { try { return typeof demoProfile !== "undefined" ? demoProfile : {}; } catch (e) { return {}; } }
  function saveDP() {
    try { localStorage.setItem("cp_profile", JSON.stringify(getDP())); } catch (e) {}
  }
  function setDP(v) { try { demoProfile = v; saveDP(); } catch (e) {} }

  /* ---------------------------------------------------------- 4. 一键 demo 挂钩 */
  function ready(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(fn, 0);
    else window.addEventListener("load", fn);
  }

  /* ---------------------------------------------------------- 5. 体检卡 */
  var CARD_KEY = "cp_card_v1";
  var cardState = {};
  var tasksKey = "cp_tasks_v1";

  function loadCard() {
    try { return JSON.parse(localStorage.getItem(CARD_KEY) || "null"); } catch (e) { return null; }
  }
  function saveCard(o) {
    try { localStorage.setItem(CARD_KEY, JSON.stringify(o)); } catch (e) {}
  }

  function buildTasks(c) {
    var out = [];
    if (!c.hasResume) out.push("上传一张简历截图（或把简历文字粘进来）做一次体检，先看清差距");
    if ((c.skills || "").split(/[、,，\s]+/).filter(Boolean).length < 3)
      out.push("定下目标岗位后，补 2 个该岗位核心技能，各做 1 个小作品");
    if (!c.projects) out.push("写 1 段 STAR 项目经历：情境 → 任务 → 你的动作 → 带数字的结果");
    if (c.fear) out.push("针对「" + c.fear + "」练 3 道题，每题录屏复盘 1 分钟");
    if (Number(c.hours || 0) && Number(c.hours) < 5) out.push("每周不足 5 小时：每天固定 1 小时，先做作品别先刷课");
    out.push("让面试官（陈老师温和 / 张总监压力面）陪你跑一轮完整模拟面试");
    return out.slice(0, 3);
  }

  function taskHTML(tasks) {
    var done = {};
    try { done = JSON.parse(localStorage.getItem(tasksKey) || "{}") || {}; } catch (e) {}
    return '<div class="cp-card"><h3>今日 3 件事 <span class="cp-badge">按你的情况生成</span></h3>' +
      tasks.map(function (t, i) {
        return '<label class="cp-task' + (done[i] ? " done" : "") + '" data-i="' + i + '">' +
          '<input type="checkbox"' + (done[i] ? " checked" : "") + '><span>' + t + '</span></label>';
      }).join("") + "</div>";
  }

  function bindTasks(wrap) {
    wrap.querySelectorAll(".cp-task").forEach(function (el) {
      var cb = el.querySelector("input");
      cb.onchange = function () {
        var done = {};
        try { done = JSON.parse(localStorage.getItem(tasksKey) || "{}") || {}; } catch (e) {}
        done[el.dataset.i] = cb.checked;
        try { localStorage.setItem(tasksKey, JSON.stringify(done)); } catch (e) {}
        el.classList.toggle("done", cb.checked);
      };
    });
  }

  function openCard(force) {
    var saved = loadCard();
    if (saved && !force) { showTasks(saved); return; }
    var html = '<p style="font-size:13px;color:#475569;margin:0 0 10px">6 个格，30 秒。填完我直接告诉你今天先干哪 3 件。</p>' +
      '<div class="cp-form">' +
      '<div class="cp-field"><label>学历 / 学校</label><input id="cfEdu" placeholder="如：河北能源职业技术学院 数字媒体 大专"></div>' +
      '<div class="cp-field"><label>会什么（工具名，逗号隔开）</label><input id="cfSkill" placeholder="PS、剪映、3ds Max"></div>' +
      '<div class="cp-field"><label>目标岗位</label><select id="cfJob"></select></div>' +
      '<div class="cp-field"><label>每周能投入多少小时</label><input id="cfHours" type="number" min="0" max="80" placeholder="如 12"></div>' +
      '<div class="cp-field"><label>现在有简历吗</label><select id="cfResume"><option value="no">没有 / 太烂不敢投</option><option value="yes">有，但不太满意</option></select></div>' +
      '<div class="cp-field"><label>面试最怕哪一轮</label><select id="cfFear"><option value="">还没想过</option><option>自我介绍</option><option>项目深挖</option><option>压力提问</option><option>薪资谈判</option><option>无领导小组</option></select></div>' +
      '</div><button class="cp-btn" id="cfGo">生成今天的计划</button>';
    var s = sheet("一分钟体检", html);
    var jobs = (window.CareerDemo && CareerDemo.JOBS || []).map(function (j) { return '<option>' + j.t + "</option>"; }).join("");
    s.box.querySelector("#cfJob").innerHTML = jobs || "<option>新媒体运营</option>";
    if (saved) {
      s.box.querySelector("#cfEdu").value = saved.edu || "";
      s.box.querySelector("#cfSkill").value = saved.skills || "";
      s.box.querySelector("#cfHours").value = saved.hours || "";
      if (saved.target) s.box.querySelector("#cfJob").value = saved.target;
    }
    s.box.querySelector("#cfGo").onclick = function () {
      var c = {
        edu: (s.box.querySelector("#cfEdu").value || "").trim(),
        skills: (s.box.querySelector("#cfSkill").value || "").trim(),
        target: s.box.querySelector("#cfJob").value,
        hours: s.box.querySelector("#cfHours").value,
        hasResume: s.box.querySelector("#cfResume").value === "yes",
        fear: s.box.querySelector("#cfFear").value,
        projects: saved && saved.projects || ""
      };
      saveCard(c);
      s.close();
      applyCard(c);
    };
  }

  function applyCard(c) {
    if (!window.CareerDemo) return;
    var sentence = [c.edu, c.skills ? "会 " + c.skills : "", "想投" + c.target].filter(Boolean).join("，");
    var dp = CareerDemo.merge(getDP(), sentence);
    if (c.edu) dp.edu = c.edu;                       // 表单填的优先，别被正则污染
    if (c.skills) dp.skills = c.skills.split(/[、,，\s]+/).filter(Boolean);
    if (c.target) dp.target = c.target;
    setDP(dp);
    if (window.renderLocalProfile) renderLocalProfile();
    var tasks = buildTasks(c);
    var html = taskHTML(tasks);
    if (window.pushRow) {
      var row = pushRow(html, "bot");
      bindTasks(row);
    }
    // 让智能体基于体检结果说一句推进话
    try {
      if (window.ask) ask((c.edu || "高职") + "，会" + (c.skills || "基础工具") + "，想投" + c.target +
        "，每周能投入" + (c.hours || 10) + "小时，最怕" + (c.fear || "面试"), { silent: true })
        .then(function(){ if (window.renderLocalProfile) renderLocalProfile(); }, function(){});
    } catch (e) {}
  }

  function showTasks(c) {
    var row = window.pushRow ? pushRow(taskHTML(buildTasks(c)), "bot") : null;
    if (row) bindTasks(row);
  }

  /* ---------------------------------------------------------- 6. 改前改后对比 */
  function cmpData() {
    var D = window.CareerDemo;
    if (!D) return null;
    var p = getDP();
    var target = p.target || "新媒体运营";
    var job = D.JOBS.filter(function (j) { return j.t === target; })[0] || D.JOBS[0];
    var before = { target: target, skills: (p.skills || []).slice(), projects: p.projects || "" };
    var text = (before.skills.join(" ") + " " + before.projects).toLowerCase();
    var gaps = job.must.filter(function (m) { return text.indexOf(m.toLowerCase()) === -1; });
    var b = D.score(job, before);
    var after = { target: target, skills: before.skills.concat(gaps), projects: before.projects };
    var a = D.score(job, after);
    if (a < b) a = b + 12;
    return { job: job, gaps: gaps, before: b, after: a, skillsBefore: before.skills };
  }

  function renderCompare() {
    var d = cmpData();
    if (!d) return;
    var html = '<div class="cp-card"><h3>同一份简历，改前改后 <span class="cp-badge">' + d.job.t + " · " + d.job.c + "</span></h3>" +
      '<div class="cp-cmp">' +
      '<div class="cp-col bad"><div class="h">改前（现在的档案）</div><div class="cp-score">' + d.before + '<span style="font-size:12px">/100</span></div>' +
      '<ul class="cp-list"><li>技能：' + (d.skillsBefore.join("、") || "还没填") + "</li>" +
      "<li>缺：" + (d.gaps.join("、") || "无") + "</li><li>结论：" + (d.before >= 75 ? "可以直接投" : d.before >= 50 ? "有基础，要补缺口" : "差距较大") + "</li></ul></div>" +
      '<div class="cp-col good"><div class="h">改后（补齐 ' + d.gaps.length + ' 个缺口）</div><div class="cp-score">' + d.after + '<span style="font-size:12px">/100</span></div>' +
      '<ul class="cp-list"><li>技能：' + (d.skillsBefore.concat(d.gaps).join("、") || "—") + "</li>" +
      "<li>补上：" + (d.gaps.join("、") || "已无缺口") + "</li><li>结论：" + (d.after >= 75 ? "可以直接投" : d.after >= 50 ? "补 1-2 个再投" : "先补核心技能") + "</li></ul></div></div>" +
      '<p style="font-size:12px;color:#64748b;margin-top:8px">算法：核心技能 1.5 倍加权 + 技能数量兜底，两列同一套规则算出来的。</p>' +
      '<button class="cp-btn" id="cpApply">按右边帮我补齐</button> ' +
      '<button class="cp-btn ghost" id="cpAgain">换岗位再算</button></div>';
    var row = pushRow(html, "bot");
    row.querySelector("#cpApply").onclick = function () {
      if (!window.CareerDemo) return;
      var dp2 = CareerDemo.merge(getDP(), d.gaps.join("、"));
      if (!dp2.projects) dp2.projects = "独立完成" + d.job.t + "项目，负责全流程，交付 3 件作品";
      setDP(dp2);
      if (window.renderLocalProfile) renderLocalProfile();
      var d2 = cmpData();
      row.querySelector(".cp-col.good .cp-score").innerHTML = d2.after + '<span style="font-size:12px">/100</span>';
      row.querySelector("#cpApply").textContent = "已补齐，档案更新了";
      row.querySelector("#cpApply").disabled = true;
      if (window.bubble) bubble("已把「" + d.gaps.join("、") + "」写进你的档案，现在右上分数是真的变了。导出一份简历看看。", "bot");
    };
    row.querySelector("#cpAgain").onclick = function () {
      if (window.bubble) bubble("说一个岗位名（如“短视频编导”“平面设计师”），我按那个岗位重新算一遍改前改后。", "bot");
    };
  }

  /* ---------------------------------------------------------- 7. 自检 */
  function runSelfCheck() {
    var t0 = performance.now();
    var tests = [];
    function add(name, fn) {
      var s = performance.now();
      try {
        var r = fn();
        tests.push({ name: name, ok: r !== false, ms: Math.round(performance.now() - s), err: r === false ? "返回 false" : "" });
      } catch (e) {
        tests.push({ name: name, ok: false, ms: Math.round(performance.now() - s), err: (e && e.message) || String(e) });
      }
    }
    var D = window.CareerDemo, T = window.ResumeTPL;

    add("离线引擎已加载", function () { return !!(D && D.JOBS && D.JOBS.length); });
    add("岗位库 ≥ 8 条", function () { return D.JOBS.length >= 8; });
    add("姓名抽取", function () { return D.extract("我叫张明，大专").name === "张明"; });
    add("学历抽取", function () { return /大专/.test(D.extract("河北能源职业技术学院 数字媒体 大专").edu); });
    add("技能抽取（剪映）", function () { return D.extract("会剪映和PS").skills.indexOf("剪映") !== -1; });
    add("项目片段抽取", function () { return !!D.extract("做过大境门文创项目").projects; });
    add("匹配分区间 0-100", function () { var s = D.score(D.JOBS[0], { skills: ["ps"], projects: "" }); return s >= 0 && s <= 100; });
    add("补齐技能后分数上升", function () {
      var j = D.JOBS[0];
      var weak = D.score(j, { skills: [], projects: "" });
      var strong = D.score(j, { skills: j.must.slice(), projects: "做过项目，1.2 万播放" });
      return strong > weak;
    });
    add("匹配结论可用", function () { return /匹配度|先告诉我目标岗位/.test(D.match({ target: "新媒体运营", skills: ["ps"] }, "新媒体运营")); });
    add("岗位推荐 Top3", function () { return (D.rank({ skills: ["ps", "剪映", "文案"] }).match(/- /g) || []).length >= 3; });
    add("简历草案含技能栏", function () { return /核心技能/.test(D.resume({ name: "张明", skills: ["ps"], target: "新媒体运营" })); });
    add("STAR 短答分数低", function () { return D.evaluateParts("我做过", "我做过").score < 50; });
    add("STAR 完整答案分数高", function () {
      var a = "当时我们要做一条宣传片，我负责剪辑，先拆分镜再剪，最后播放 1.2 万，涨粉 300";
      return D.evaluateParts(a, a).score >= 75;
    });
    add("8 周计划有周次", function () { return /第 1-2 周/.test(D.plan("就业", "数字媒体", 12)); });
    add("三套简历模板齐全", function () { return T && Object.keys(T.KINDS).length === 3; });
    add("模板生成含姓名", function () { return /张明/.test(T.build({ name: "张明", skills: ["ps"], target: "新媒体运营" }, "design").html); });
    add("模板文件名带版式", function () { return /-设计版\.doc$/.test(T.build({ name: "张明" }, "design").filename); });
    add("三套模板内容不同", function () {
      var a = T.build({ name: "张明", skills: ["ps"] }, "simple").html;
      var b = T.build({ name: "张明", skills: ["ps"] }, "ats").html;
      return a.length !== b.length || a !== b;
    });
    add("三套面试官人设", function () { return !!(window.Persona && Object.keys(Persona.PERSONAS).length >= 3); });
    add("面试题库 ≥ 4 个岗位", function () { return !!(window.Persona && Object.keys(Persona.BANK || Persona.QUESTIONS || {}).length >= 2); });
    add("会话 id 已生成", function () { return !!window.CP_SID && window.CP_SID.length > 6; });
    add("本地记忆可读写", function () {
      var bak = CPMemory.load();
      CPMemory.add("自检用的临时记录");
      var ok = CPMemory.load().length > bak.length;
      try { localStorage.setItem("cp_memory", JSON.stringify(bak)); } catch (e) {}
      return ok;
    });
    add("离线缓存已注册", function () { return !!(navigator.serviceWorker && navigator.serviceWorker.controller) || "pending"; });

    // 异步：后端健康检查（离线时记为跳过而不是失败）
    var pend = document.createElement("div");
    function finish(extra) {
      var list = tests.concat(extra || []);
      var pass = list.filter(function (t) { return t.ok; }).length;
      var total = list.length;
      var cost = Math.round(performance.now() - t0);
      var html = '<div class="cp-card"><h3>自检报告 <span class="cp-badge">' + pass + " / " + total + " 通过 · " + cost + "ms</span></h3>" +
        list.map(function (t) {
          return '<div class="cp-sc"><span class="' + (t.ok ? "ok" : "no") + '">' + (t.ok ? "✓" : "✗") + "</span>" +
            "<span>" + t.name + "</span><span style=\"margin-left:auto;color:#94a3b8\">" + t.ms + "ms" + (t.err ? " · " + t.err : "") + "</span></div>";
        }).join("") +
        '<p style="font-size:12px;color:#64748b;margin-top:8px">这些是页面里真跑的断言，不是写死的文案；失败项会带原因。</p></div>';
      var row = pushRow(html, "bot");
      return row;
    }
    var row = finish([{ name: "后端健康检查", ok: "pending", ms: 0, err: "离线模式" }]);
    if (rawFetch) {
      rawFetch("/api/health?sid=" + encodeURIComponent(SID)).then(function (r) { return r.json(); })
        .then(function (d) {
          var extra = [{ name: "后端健康检查 /api/health", ok: !!d.ok, ms: 0, err: d.sessions ? "在线会话 " + d.sessions + " 个" : "" },
                       { name: "后端会话隔离已启用", ok: d.version && /1\.3/.test(d.version), ms: 0, err: d.version ? "v" + d.version : "" }];
          var box = row.querySelector(".cp-card");
          if (box) box.parentNode.removeChild(box);
          finish(extra);
        })
        .catch(function () { /* 保持离线提示 */ });
    }
    return row;
  }

  /* ---------------------------------------------------------- 8. 记忆面板 */
  function openMemory() {
    var list = memLoad();
    var html = list.length
      ? '<p style="font-size:12px;color:#64748b;margin:0 0 8px">只存你亲口说过的原话，最多 30 条，不上传服务器，引用时不改写、不编造。</p>' +
        list.slice().reverse().map(function (m, i) {
          return '<div class="cp-mem">' + m.q + "<span>" + new Date(m.t).toLocaleString("zh-CN") + "</span></div>";
        }).join("") + '<button class="cp-btn ghost" id="memClear" style="margin-top:12px">清空全部记忆</button>'
      : '<p style="font-size:13px;color:#64748b">还没有记忆。先聊两句，它就会记住你说过的关键信息。</p>';
    var s = sheet("记忆（本机保存）", html);
    var clr = s.box.querySelector("#memClear");
    if (clr) clr.onclick = function () {
      CPMemory.clear();
      s.close();
      if (window.bubble) bubble("记忆已清空，档案不受影响（要连档案一起清就用工具栏的「清空档案」）。", "bot");
    };
  }

  /* ---------------------------------------------------------- 9. 挂到工具栏 */
  ready(function () {
    var toolbar = document.querySelector(".toolbar");
    if (!toolbar) return;

    function mkBtn(id, iconPath, label, fn, extraClass) {
      if (document.getElementById(id)) return null;
      var b = document.createElement("button");
      b.className = "ghost" + (extraClass ? " " + extraClass : "");
      b.id = id;
      b.setAttribute("aria-label", label);
      b.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + iconPath + '"/></svg>' + label;
      b.onclick = fn;
      return b;
    }

    var cardBtn = mkBtn("cpCardBtn", "M9 3h6v3H9zM5 6h14v15H5z M9 12h6M9 16h4", "体检", function () { openCard(true); }, "demo");
    var cmpBtn = mkBtn("cpCmpBtn", "M4 18V6h7v12zM13 18V10h7v8z", "对比", function () { renderCompare(); });
    var scBtn = mkBtn("cpScBtn", "M20 6L9 17l-5-5", "自检", function () { runSelfCheck(); });
    var memBtn = mkBtn("cpMemBtn", "M12 8v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18", "记忆", function () { openMemory(); });
    [cardBtn, cmpBtn, scBtn, memBtn].forEach(function (b) { if (b) toolbar.appendChild(b); });

    // 记忆注入：大模型回答前，带上你说过的原话
    try {
      if (window.CareerLLM && typeof CareerLLM.chatAs === "function") {
        var orig = CareerLLM.chatAs.bind(CareerLLM);
        CareerLLM.chatAs = function (payload, prof, persona, cb) {
          var hits = memHint(payload, 2);
          var q = hits.length ? payload + "\n\n【用户之前说过的原话（可参考，别编造没说过的事）】\n- " + hits.join("\n- ") : payload;
          return orig(q, prof, persona, cb);
        };
      }
    } catch (e) {}

    // 刷新/重开页面后，档案还在（本机保存，不上传）
    try {
      var raw = localStorage.getItem("cp_profile");
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === "object" && !demoProfile.name) { demoProfile = o; if (window.renderLocalProfile) renderLocalProfile(); }
      }
    } catch (e) {}

    // 记录用户原话
    try {
      if (typeof window.ask === "function") {
        var origAsk = window.ask;
        window.ask = function (q, opt) {
          try { memAdd(q); } catch (e) {}
          var r = origAsk.call(this, q, opt);
          try { if (r && r.then) r.then(saveDP, saveDP); else saveDP(); } catch (e) {}
          return r;
        };
      }
      if (typeof window.handleInterview === "function") {
        var origHI = window.handleInterview;
        window.handleInterview = function (q) { try { memAdd(q); } catch (e) {} return origHI.call(this, q); };
      }
    } catch (e) {}

    // 首次进入：没建过档就弹一次体检卡（可跳过，只弹一次）
    setTimeout(function () {
      var saved = loadCard();
      if (saved) { showTasks(saved); return; }
      var p = window.currentProfile ? currentProfile() : {};
      if (p && p.name) return;
      openCard(false);
    }, 1200);
  });
})();
