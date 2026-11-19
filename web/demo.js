/* 离线演示引擎：后端不在时，按钮依然能用（前端内置岗位库 + 规则计算） */
(function (root) {
  const JOBS = [
    { t: "新媒体运营", c: "唐山", s: "4-6K", must: ["新媒体", "文案", "小红书", "抖音"], plus: ["剪映", "ps"], core: "文案" },
    { t: "短视频编导", c: "唐山", s: "5-7K", must: ["剪辑", "分镜", "短视频", "策划"], plus: ["剪映", "pr"], core: "剪辑" },
    { t: "平面设计师", c: "唐山", s: "4-7K", must: ["ps", "版式", "海报"], plus: ["illustrator", "配色"], core: "ps" },
    { t: "电商美工", c: "唐山", s: "4-6K", must: ["ps", "排版", "海报"], plus: ["illustrator", "剪映"], core: "ps" },
    { t: "短视频剪辑", c: "天津", s: "4-6K", must: ["剪辑", "剪映", "调色"], plus: ["pr", "分镜"], core: "剪辑" },
    { t: "内容运营助理", c: "唐山", s: "3.5-5K", must: ["文案", "排版", "选题"], plus: ["ps", "公众号"], core: "文案" },
    { t: "视觉设计实习生", c: "唐山", s: "3-4K", must: ["ps", "版式"], plus: ["illustrator", "figma"], core: "ps" },
    { t: "文创产品设计", c: "本地", s: "4-6K", must: ["ps", "文创", "版式"], plus: ["3ds max", "手绘"], core: "文创" },
  ];

  const SKILL_WORDS = ["ps", "ai", "pr", "ae", "c4d", "3ds max", "剪映", "figma", "html", "css",
    "javascript", "python", "文案", "新媒体", "公众号", "运营", "剪辑", "海报", "版式", "文创",
    "分镜", "调色", "排版", "策划", "直播", "数据标注", "提示词", "小红书", "抖音", "快手",
    "选题", "软文", "手绘", "建模", "摄影"];

  function extract(q) {
    const p = { name: "", edu: "", skills: [], target: "", projects: "", certs: "" };
    const m = q.match(/(?:我叫|姓名[:：]?)\s*([\u4e00-\u9fa5]{2,4})/);
    if (m) p.name = m[1];
    const school = q.match(/([\u4e00-\u9fa5]{2,15}(?:大学|学院|职业技术学院))/);
    const level = ["博士", "硕士", "本科", "大专", "专科", "高职", "中专"].find(w => q.includes(w)) || "";
    if (school || level) p.edu = [(school ? school[1] : ""), level].filter(Boolean).join(" ");
    const low = q.toLowerCase();
    p.skills = SKILL_WORDS.filter(w => low.includes(w));
    const job = JOBS.find(j => q.includes(j.t));
    if (job) p.target = job.t;
    if (/四级/.test(q)) p.certs = "英语四级备考中";
    const pm = q.match(/(?:做过|负责过|参与过|实习|实践)\s*([^。，；]{2,30})/);
    if (pm) p.projects = pm[1];
    return p;
  }

  function score(job, p) {
    const text = (p.skills.join(" ") + " " + p.projects + " " + p.target).toLowerCase();
    let got = 0, total = 0;
    job.must.forEach(m => {
      const w = m === job.core ? 1.5 : 1;
      total += w;
      if (text.includes(m.toLowerCase())) got += w;
    });
    const rate = total ? got / total : 0;
    return Math.round(100 * (rate * 0.7 + 0.3 * Math.min(1, p.skills.length / 3)));
  }

  function resume(p) {
    const job = JOBS.find(j => j.t === p.target);
    const lines = [
      (p.name || "【姓名】") + "｜" + (p.edu || "【学历/学校/专业】") + "｜求职意向：" + (p.target || "【目标岗位】"),
      "联系方式：【电话 / 邮箱 / 作品集链接】",
      "",
      "■ 核心技能",
      "- " + (p.skills.length ? p.skills.join("、") : "【按目标岗位补 4-6 个具体工具名，写熟练度】"),
      "",
      "■ 项目/实践经历（按 STAR 写）",
      p.projects ? "- " + p.projects + "（结果待补：数量/涨粉/交付量）" : "- 【项目名】：情境 → 任务 → 行动 → 结果（带数字）",
      "",
      "■ 教育背景",
      "- " + (p.edu || "【学校 / 专业 / 起止时间】"),
      "",
      "■ 证书与荣誉",
      "- " + (p.certs || "【四级 / 普通话 / 职业技能等级 / 竞赛奖项】"),
      "",
      job ? "■ 关键词投放\n- 硬性：" + job.must.join("、") + "\n- 加分：" + job.plus.join("、") : "■ 关键词投放\n- 【告诉我目标岗位，我列该岗位关键词】",
      "",
      "写作提醒：每条经历一行半以内，动词开头，结果带数字。",
    ];
    return "【简历草案】\n\n" + lines.join("\n");
  }

  function match(p, jobTitle) {
    const job = JOBS.find(j => j.t === jobTitle) || JOBS.find(j => p.target && j.t === p.target);
    if (!job) return "先告诉我目标岗位，我才能算匹配度。当前可选：" + JOBS.map(j => j.t).join("、");
    const s = score(job, p);
    const text = (p.skills.join(" ") + " " + p.projects).toLowerCase();
    const strong = job.must.filter(m => text.includes(m.toLowerCase()));
    const gap = job.must.filter(m => !text.includes(m.toLowerCase()));
    return [
      "【岗位匹配】" + job.t + "（" + job.c + "，" + job.s + "）",
      "加权匹配度：" + s + "/100（核心技能加权算法，与后端一致）",
      "完全具备：" + (strong.join("、") || "无"),
      "明显缺口：" + (gap.join("、") || "无"),
      "结论：" + (s >= 75 ? "可以直接投。" : s >= 50 ? "有基础，补 1-2 个缺口再投。" : "差距较大，先补核心技能或改投相邻岗位。"),
      gap.length ? "补齐：用 1 个小作品证明 " + gap.slice(0, 2).join("、") + "，写进简历项目栏。" : "",
    ].filter(Boolean).join("\n");
  }

  function rank(p) {
    const rows = JOBS.map(j => ({ j, s: score(j, p) })).sort((a, b) => b.s - a.s).slice(0, 3);
    return "【岗位推荐】按匹配度排序\n" + rows.map(r => "- " + r.j.t + "（" + r.j.c + "，" + r.j.s + "）匹配度 " + r.s).join("\n");
  }

  function analyze(p) {
    const parts = [];
    parts.push("学历 " + (p.edu.includes("本科") ? 18 : p.edu.includes("大专") || p.edu.includes("高职") ? 14 : 10));
    parts.push("技能 " + Math.min(40, p.skills.length * 8));
    parts.push("项目 " + (p.projects ? 16 : 4));
    parts.push("证书 " + (p.certs ? 8 : 2));
    const total = parts.reduce((a, b) => a + parseInt(b.split(" ")[1]), 0);
    return "【简历体检】综合得分 " + Math.min(100, total) + "/100\n分项：" + parts.join("、") +
      "\n待改进：" + (p.projects ? "1. 给项目补量化结果" : "1. 缺项目经历，先补 1 段可讲流程的实践") +
      "\n2. 简历用目标岗位的原词，别用同义词";
  }

  function merge(prof, q) {
    const p = Object.assign({}, prof || {});
    const e = extract(q);
    ["name", "edu", "target", "projects", "certs"].forEach(k => {
      if (e[k] && !(p[k] || "")) p[k] = e[k];
    });
    const sk = new Set((p.skills || []).concat(e.skills || []));
    p.skills = Array.from(sk);
    return p;
  }

  function answer(q, prof) {
    const p = merge(prof, q);
    const low = q.toLowerCase();
    if (/(生成|写|做|弄|改|起草).{0,4}简历|简历.{0,4}(生成|写|做|弄|改)/.test(q)) return { text: resume(p), action: "build_resume" };
    if (/面试.*(问|题)|会问什么/.test(q)) {
      return { text: question(p.target, 0), action: "interview_question" };
    }
    if (/点评|这么答/.test(q)) return { text: evaluate(q, q), action: "evaluate_answer" };
    if (/投什么|适合什么|推荐岗位|岗位适合|适合干啥|能投什么/.test(q)) return { text: rank(p), action: "rank_jobs" };
    if (/匹配|差什么|能投|岗位/.test(q)) return { text: match(p, p.target), action: "match_job" };
    if (/简历|体检|打分|评估/.test(q)) return { text: analyze(p), action: "analyze_resume" };
    if (/计划|规划|几周|准备/.test(q)) {
      const m = q.match(/(\d+)\s*(?:小时|h)/);
      return { text: plan(q, "数字媒体", m ? m[1] : 12), action: "career_plan" };
    }
    return { text: "离线模式：我可以做简历生成 / 体检 / 匹配 / 推荐 / 面试 / 计划。\n试试左侧的快捷按钮，或直接说“我大专，会 PS 剪映，想投新媒体运营”。", action: "help" };
  }

  function doc(p) {
    const esc = s => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const body = resume(p).split("\n").map(l => "<p>" + esc(l) + "</p>").join("");
    return "<html xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'>" +
      "<style>body{font-family:'微软雅黑',sans-serif;font-size:11pt;line-height:1.7}</style></head><body>" +
      "<h1>" + esc((p.name || "我") + "的简历") + "</h1>" + body + "</body></html>";
  }


  const BANK = {
    "新媒体运营": ["请讲一个你从 0 到 1 做完的作品，说清你负责什么、遇到什么困难、结果如何。",
      "如果一条笔记数据很差，你怎么判断是选题问题还是封面问题？",
      "你怎么理解“人设”，它和账号数据有什么关系？"],
    "短视频编导": ["给你一个 60 秒短片，你怎么排分镜？",
      "拍摄预算只有 200 元，你怎么取舍？",
      "你怎么判断一个视频的完播率问题出在哪？"],
    "平面设计师": ["挑一张你满意的作品，讲清需求、思路、落地。",
      "客户要“大气一点”，你怎么把这句话变成设计决策？",
      "同一版式要做 5 个尺寸，你怎么保证一致？"],
    "通用": ["讲一次你在团队里承担主要责任的经历。",
      "说一个你最近自学的新技能，怎么学的？",
      "遇到不会做的任务，你第一步做什么？"],
  };

  function question(job, idx) {
    const list = BANK[job] || BANK["通用"];
    const i = (idx || 0) % list.length;
    return "【模拟面试】" + (job || "通用") + " 第 " + (i + 1) + " 题：\n" + list[i] + "\n\n（把回答发我，我按 STAR 点评）";
  }

  function evaluateParts(q, ans) {
    const a = (ans || q || "");
    const has = {
      情境: /当时|背景|情况|我们|那天/.test(a),
      任务: /负责|任务|目标|要我做|安排/.test(a),
      行动: /我(先|然后|就|把|去|按)|做法|步骤|具体|拆|测|试|改|排|跑|找|问/.test(a),
      结果: /\d|结果|最后|提升|完成|涨|播放|倍|%|万|千|上线|交付|成交/.test(a),
    };
    const w = { 情境: 18, 任务: 18, 行动: 38, 结果: 26 };
    let score = a.length >= 8 ? 20 : 0;
    const flags = [];
    Object.keys(has).forEach(k => {
      if (has[k]) score += w[k];
      flags.push({ name: k, ok: has[k] });
    });
    score += Math.min(10, Math.floor(a.length / 30));
    score = Math.min(100, score);
    const miss = Object.keys(has).filter(k => !has[k]);
    const text = "【STAR 点评】得分 " + score + "/100\n" +
      "情境 " + (has.情境 ? "√" : "×") + "　任务 " + (has.任务 ? "√" : "×") +
      "　行动 " + (has.行动 ? "√" : "×") + "　结果 " + (has.结果 ? "√" : "×") +
      "\n" + (miss.length ? "缺：" + miss.join("、") + "。结果一定要带数字，行动要拆成 2-3 步。" : "四要素齐全，可以把语言再压到 90 秒。");
    return { score, text, flags };
  }

  function evaluate(q, ans) { return evaluateParts(q, ans).text; }

  function plan(goal, major, hours) {
    const h = hours || 12;
    const up = (goal || "").indexOf("升本") >= 0;
    const lines = ["【8 周计划】目标：" + (up ? "升本" : "就业") + "｜专业：" + (major || "数字媒体") + "｜每周 " + h + " 小时"];
    const wk = up
      ? [["第 1-2 周", "英语：每天 60 分钟单词 + 1 篇阅读；高数：过一遍函数与极限"],
         ["第 3-4 周", "高数刷题 2 套/周；英语四级真题 1 套/周"],
         ["第 5-6 周", "专业课过重点章节，整理错题本"],
         ["第 7-8 周", "整套真题计时训练，同时保持 1 个作品集项目"]]
      : [["第 1-2 周", "按目标岗位补 2 个核心技能，各做 1 个小作品"],
         ["第 3-4 周", "按岗位关键词改简历，投 10 家并记录反馈"],
         ["第 5-6 周", "模拟面试 8 题，每题录屏复盘"],
         ["第 7-8 周", "集中投递 + 每场面试写复盘，补 1 个缺口作品"]];
    wk.forEach(w => lines.push(w[0] + "：" + w[1]));
    lines.push("每周固定：" + Math.max(2, Math.round(h / 4)) + " 小时作品/投递，" + Math.max(3, Math.round(h / 2)) + " 小时技能训练，剩余时间刷题或复盘。");
    return lines.join("\n");
  }

  /* ---------------- 随机演示样例：每次组合不同的占位身份，不写死任何人/校/项目 ---------------- */
  const DEMO_NAMES = ["李明", "王芳", "陈晨", "赵磊", "周婷", "孙悦", "吴迪", "郑好"];
  const DEMO_SCHOOLS = ["某某学院", "某职业技术学院", "某某职业学院", "某学院"];
  const DEMO_MAJORS = ["数字媒体技术", "视觉传达设计", "广告设计与制作", "动漫制作技术"];
  const DEMO_SKILL_SETS = [
    ["PS", "剪映", "3ds Max"],
    ["PS", "Illustrator", "排版"],
    ["剪映", "PR", "分镜"],
    ["PS", "公众号", "文案"],
  ];
  const DEMO_PROJECTS = ["校园文创设计项目", "课程海报设计项目", "短视频剪辑实训项目", "公众号内容运营项目"];

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomProfile() {
    const job = pick(JOBS);
    const skills = pick(DEMO_SKILL_SETS);
    return {
      name: pick(DEMO_NAMES),
      school: pick(DEMO_SCHOOLS),
      major: pick(DEMO_MAJORS),
      skills: skills,
      project: pick(DEMO_PROJECTS),
      target: job.t,
      edu: pick(["大专", "高职"]),
    };
  }

  function randomIntro() {
    const p = randomProfile();
    return {
      profile: p,
      sentence: `我叫${p.name}，${p.school} ${p.major} ${p.edu}，会 ${p.skills.join("、")}，做过${p.project}，想投${p.target}`,
    };
  }

  root.CareerDemo = { answer, extract, doc, JOBS, match, rank, score, analyze, resume, question, evaluate, evaluateParts, plan, merge, randomProfile, randomIntro };
})(typeof window !== "undefined" ? window : globalThis);
