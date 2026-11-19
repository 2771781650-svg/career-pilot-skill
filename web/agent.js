/* 浏览器端智能体：直连 OpenAI 兼容接口（DeepSeek / 豆包 Ark / 通义等），自己调工具。
   没有后端时也能真对话——用的是你填的 Key，Key 只存本机 localStorage。 */
(function (root) {
  const LS_KEY = "careerpilot.llm";

  const cfg = { base: "https://api.deepseek.com/v1", model: "deepseek-chat", key: "" };

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) Object.assign(cfg, JSON.parse(raw));
    } catch (e) {}
    return cfg;
  }
  function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(cfg));
  }
  function ready() {
    return !!(cfg.key && cfg.base && cfg.model);
  }

  const TOOLS = [
    { name: "analyze_resume", desc: "简历体检：五维评分+改进项。入参 {resume_text}", run: a => root.CareerDemo.analyze(root.CareerDemo.merge(ctx.profile, a.resume_text || "")) },
    { name: "build_resume", desc: "生成简历草案。入参 {name,edu,skills,experience,target_job,certs}", run: a => root.CareerDemo.resume(Object.assign({}, ctx.profile, {
        name: a.name || ctx.profile.name, edu: a.edu || ctx.profile.edu,
        skills: (ctx.profile.skills || []).concat(splitSkills(a.skills)),
        projects: a.experience || ctx.profile.projects, target: a.target_job || ctx.profile.target,
        certs: a.certs || ctx.profile.certs,
      })) },
    { name: "match_job", desc: "岗位匹配：加权匹配度+缺口。入参 {resume_text, job_title}", run: a =>
        root.CareerDemo.match(ctx.profile, a.job_title || "") },
    { name: "rank_jobs", desc: "岗位推荐：按匹配度排序前3。入参 {}", run: () => root.CareerDemo.rank(ctx.profile) },
    { name: "interview_question", desc: "面试出题。入参 {role, index}", run: a => root.CareerDemo.question(a.role || ctx.profile.target, a.index || 0) },
    { name: "evaluate_answer", desc: "STAR 点评。入参 {question, answer}", run: a => root.CareerDemo.evaluate(a.question || "", a.answer || "") },
    { name: "career_plan", desc: "8周规划。入参 {goal, hours_per_week}", run: a => root.CareerDemo.plan(a.goal, "数字媒体", a.hours_per_week) },
  ];

  let ctx = { profile: {}, persona: "zhitu" };

  function splitSkills(s) {
    return String(s || "").toLowerCase().split(/[、,，\s]+/).filter(Boolean)
      .filter(w => root.CareerDemo.JOBS.some(j => j.must.concat(j.plus).includes(w)) || w.length <= 6);
  }

  function systemPrompt() {
    const schema = TOOLS.map(t => `- ${t.name}：${t.desc}`).join("\n");
    const role = root.Persona ? root.Persona.prompt(ctx.persona) : "";
    return `你是「职途 CareerPilot」里的求职智能体，同时承担下面这个人设：\n${role}\n\n面向高职/大学生的求职智能体。你必须通过工具计算，不要自己编造分数。

可用工具：
${schema}

回答格式：只能输出一个 JSON 对象，两种形态之一：
{"thought":"一句话理由","action":"工具名","action_input":{...}}
{"thought":"一句话理由","final":"给用户看的结论（中文，分点，直接、具体）"}

规则：
1. 最多调用 3 个工具；有工具结果后必须给 final。
2. 用户需要简历体检/匹配时先调工具，再基于 observation 总结，不要重复工具原文，要提炼结论与下一步。
3. 用户信息不全就问一句最关键的（是什么岗位/会什么工具），不要一次问五个问题。
4. 不承诺包就业、不改分数、不编造岗位。`;
  }

  async function callLLM(messages) {
    const url = cfg.base.replace(/\/$/, "") + "/chat/completions";
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + cfg.key },
      body: JSON.stringify({ model: cfg.model, messages, temperature: 0.3 }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error("接口返回 " + res.status + "：" + t.slice(0, 160));
    }
    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error("模型没有返回内容");
    return content;
  }

  function parseJSON(text) {
    const clean = String(text).replace(/```json|```/g, "").trim();
    try { return JSON.parse(clean); } catch (e) {}
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { return JSON.parse(m[0]); } catch (e) { return null; }
  }

  async function run(question, profile, onStep) {
    if (!ready()) throw new Error("还没填 API Key");
    ctx.profile = root.CareerDemo.merge(profile || {}, question);
    const steps = [];
    const messages = [{ role: "system", content: systemPrompt() }];

    for (let i = 0; i < 3; i++) {
      const scratch = steps.length
        ? "\n\n已执行：\n" + steps.map(s => `工具 ${s.action} 结果：\n${s.observation}`).join("\n")
        : "";
      messages.length = 1;
      messages.push({ role: "user", content: question + scratch + (steps.length ? "\n请给 final。" : "") });

      let raw;
      try { raw = await callLLM(messages); } catch (e) { throw e; }
      const data = parseJSON(raw);
      if (!data) return { answer: raw, steps };

      if (data.final) return { answer: String(data.final), steps };

      const name = data.action;
      const tool = TOOLS.find(t => t.name === name);
      if (!tool) return { answer: "（模型选了未知工具 " + name + "）\n" + raw, steps };

      const observation = tool.run(data.action_input || {});
      steps.push({ action: name, thought: data.thought || "", observation: String(observation) });
      if (onStep) onStep(steps[steps.length - 1]);
    }
    if (steps.length) return { answer: steps[steps.length - 1].observation, steps };
    return { answer: "没有拿到有效结论，换个说法再问一次。", steps };
  }

  /* 模拟面试一轮：返回 {score, feedback, next, done, flags} */
  async function interviewTurn(st, answer, profile, personaId) {
    ctx.profile = root.CareerDemo.merge(profile || {}, answer || "");
    ctx.persona = personaId || st.persona;
    const q = root.Persona ? root.Persona.currentQuestion(st) : "请自我介绍";
    st.idx = st.idx || 0;
    st.log = st.log || [];

    if (!ready()) {
      const parts = root.CareerDemo.evaluateParts(q, answer);
      const score = parts.score;
      const r = parts.text;
      st.log.push({ q, answer, score, flags: parts.flags });
      st.idx += 1;
      if (st.idx >= (st.total || 5)) {
        st.done = true;
        return { score, feedback: r, done: true, report: root.Persona.report(st) };
      }
      return { score, feedback: r, done: false, next: root.Persona.currentQuestion(st) };
    }

    const sys = (root.Persona ? root.Persona.prompt(st.persona) : "") +
      "\n你是面试官，正在面试岗位：" + st.role + "，第 " + (st.idx + 1) + "/" + (st.total || 5) + " 题。";
    const userMsg = `当前问题：${q}\n候选人回答：${answer}\n\n` +
      `只输出 JSON：{"score":0-100,"feedback":"面试官口吻的一句话点评+一条改进","next_question":"下一题；如果已是最后一题则填空字符串","flags":["情境","任务","行动","结果"]中答到的项}`;

    const raw = await callLLM([{ role: "system", content: sys }, { role: "user", content: userMsg }]);
    const d = parseJSON(raw) || { score: 60, feedback: raw.slice(0, 200), next_question: "" };
    st.log.push({ q, answer, score: d.score || 0 });
    st.idx += 1;
    if (!d.next_question || st.idx >= (st.total || 5)) {
      st.done = true;
      return { score: d.score || 0, feedback: d.feedback, done: true, report: root.Persona.report(st) };
    }
    return { score: d.score || 0, feedback: d.feedback, done: false, next: d.next_question };
  }

  async function chatAs(q, profile, personaId, onStep) {
    ctx.persona = personaId || "zhitu";
    return run(q, profile, onStep);
  }

  root.CareerLLM = { cfg, load, save, ready, run, interviewTurn, chatAs };
})(typeof window !== "undefined" ? window : globalThis);
