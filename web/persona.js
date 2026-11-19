/* 角色与人设：小职（求职搭子）/ 陈老师（温和 HR）/ 张总监（压力面） */
(function (root) {
  const PERSONAS = {
    zhitu: {
      name: "小职",
      tag: "求职搭子",
      voice: "直接、不绕弯：先给结论，再给下一步；会催你补数字，不灌鸡汤；偶尔一句北方口语。",
      rule: "禁止夸大承诺（包就业、必过）；分数只引用工具结果。",
    },
    hr_warm: {
      name: "陈老师",
      tag: "温和面试官 · HR",
      voice: "语速慢、先暖场：先肯定一句，再按 STAR 追问一个细节；不刁难，但会追问“具体你做了什么”。",
      rule: "每轮只问一个问题；答完给「一句肯定 + 一个改进」。",
    },
    hr_hard: {
      name: "张总监",
      tag: "压力面试官 · 业务负责人",
      voice: "节奏快、直给：上来就压数字和细节，会质疑“这个数据真是你做的？”，不给台阶，但结论客观。",
      rule: "每轮只问一个问题；追问必须落在数字、责任边界、结果归因。",
    },
  };

  const BANK = {
    "新媒体运营": [
      "先自我介绍一下，控制在 60 秒，说清你会什么、做过什么。",
      "讲一个你做的内容，从选题到发布，你负责哪几步？",
      "一条笔记数据差，你怎么判断是选题、封面还是发布时间的问题？",
      "如果让你 30 天把账号涨到 5000 粉，你的前两周怎么排？",
      "你觉得自己最不适合做运营的一点是什么？",
    ],
    "短视频编导": [
      "自我介绍，说清你拍过什么、用什么工具。",
      "给你 60 秒产品短片，你怎么排分镜？",
      "预算只有 200 元，灯光、场地、演员你怎么取舍？",
      "完播率只有 20%，你从哪三个点排查？",
      "你怎么判断一个脚本能不能爆？",
    ],
    "平面设计师": [
      "自我介绍，说清你的软件熟练度和作品类型。",
      "挑一张你最满意的作品，讲需求、思路、落地。",
      "客户说“大气一点”，你怎么变成具体设计决策？",
      "同一版式要出 5 个尺寸，你怎么保证一致？",
      "设计被否了三版，你第四版怎么改？",
    ],
    "通用": [
      "先自我介绍，60 秒内说清学历、技能、想做什么。",
      "讲一次你在团队里承担主要责任的经历。",
      "说一个你最近自学的新技能，怎么学的、学到什么程度？",
      "遇到完全不会的任务，你第一步做什么？",
      "你未来一年最想补的能力是什么，为什么？",
    ],
  };

  function list() {
    return Object.keys(PERSONAS).map(id => ({ id, ...PERSONAS[id] }));
  }

  function prompt(id) {
    const p = PERSONAS[id] || PERSONAS.zhitu;
    return `你的角色：${p.name}（${p.tag}）。说话风格：${p.voice}\n约束：${p.rule}`;
  }

  function interview(role, persona) {
    const list2 = BANK[role] || BANK["通用"];
    return { role: role || "通用", persona: persona || "hr_warm", idx: 0, total: 5, log: [], done: false, questions: list2 };
  }

  function currentQuestion(st) {
    const qs = st.questions && st.questions.length ? st.questions : (BANK[st.role] || BANK["通用"]);
    return qs[Math.min(st.idx, qs.length - 1)];
  }

  function report(st) {
    const rows = st.log;
    const avg = rows.length ? Math.round(rows.reduce((a, b) => a + (b.score || 0), 0) / rows.length) : 0;
    const stat = {};
    rows.forEach(r => (r.flags || []).forEach(f => {
      stat[f.name] = stat[f.name] || { ok: 0, n: 0 };
      stat[f.name].n += 1;
      if (f.ok) stat[f.name].ok += 1;
    }));
    const dims = Object.keys(stat);
    const strong = dims.filter(d => stat[d].ok / stat[d].n >= 0.6);
    const weak = dims.filter(d => stat[d].ok / stat[d].n < 0.4);
    const uniq = a => Array.from(new Set(a));
    return [
      "【面试报告】岗位：" + st.role + "｜面试官：" + (PERSONAS[st.persona] || PERSONAS.hr_warm).name,
      "综合得分：" + avg + "/100（" + rows.length + " 题平均）",
      "答得住的：" + (uniq(strong).join("、") || "暂无"),
      "需要补的：" + (uniq(weak).join("、") || "暂无"),
      "最该改的一条：" + (uniq(weak)[0] ? "把「" + uniq(weak)[0] + "」补成带数字的具体动作" : "把每题压到 90 秒，先说结论"),
      "下一步：按这份报告改简历，再约一次同岗位面试。",
    ].join("\n");
  }

  root.Persona = { PERSONAS, list, prompt, interview, currentQuestion, report, BANK };
})(typeof window !== "undefined" ? window : globalThis);
