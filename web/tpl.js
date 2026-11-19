/* 简历模板引擎：纯前端生成 .doc（Word 可打开），三套版式，不依赖后端 */
(function (root) {
  const KINDS = {
    simple: { name: "简洁版", tip: "黑白紧凑，投递通用" },
    design: { name: "设计版", tip: "带色块，适合设计/新媒体岗" },
    ats: { name: "机器版", tip: "纯文本骨架，过 ATS 筛选" },
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  }
  function skills(p) {
    const list = Array.isArray(p.skills) ? p.skills : String(p.skills || "").split(/[、,，\s]+/);
    return list.filter(Boolean).slice(0, 12);
  }

  function body(p) {
    const s = skills(p);
    const rows = [];
    rows.push(`<h1>${esc(p.name || "你的名字")}</h1>`);
    rows.push(`<div class="meta">${esc(p.edu || "学历")}　·　求职意向：${esc(p.target || p.target_job || "待定")}${p.phone ? "　·　" + esc(p.phone) : ""}</div>`);
    if (s.length) rows.push(`<h2>核心技能</h2><p>${s.map(t => esc(t)).join("　|　")}</p>`);
    if (p.projects) rows.push(`<h2>项目 / 实习经历</h2><p>${esc(p.projects).replace(/\n/g, "<br>")}</p>`);
    if (p.certs) rows.push(`<h2>证书与荣誉</h2><p>${esc(p.certs)}</p>`);
    rows.push(`<h2>自我评价</h2><p>${esc(summary(p, s))}</p>`);
    return rows.join("\n");
  }

  function summary(p, s) {
    const t = p.target || p.target_job || "目标岗位";
    const top = s.slice(0, 3).join("、") || "常用工具";
    return `能独立完成${t}的日常执行，熟练使用${top}；做事按"先出结果、再优化"的顺序推进，愿意用数据校准判断。`;
  }

  function css(kind) {
    const base = `body{font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:10.5pt;color:#222;line-height:1.7;margin:0}
      h1{font-size:17pt;margin:0 0 4pt}
      .meta{color:#666;font-size:9.5pt;margin-bottom:10pt}
      h2{font-size:11pt;margin:12pt 0 4pt;border-left:3pt solid #0369a1;padding-left:6pt}
      p{margin:0 0 6pt;white-space:pre-wrap}`;
    if (kind === "design") {
      return base + `h1{color:#0369a1;letter-spacing:1pt}
        h2{border-left:0;background:#eaf5fb;padding:4pt 8pt;color:#08425f}
        .meta{background:#f0f9ff;padding:5pt 8pt;border-radius:4pt}`;
    }
    if (kind === "ats") {
      return base + `h1{font-size:14pt;text-align:left;letter-spacing:0}
        h2{border-left:0;font-size:10.5pt;margin-top:10pt;text-transform:none}
        p{margin-bottom:4pt}`;
    }
    return base;
  }

  function build(p, kind) {
    kind = KINDS[kind] ? kind : "simple";
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${esc(p.name || "简历")}的简历</title><style>${css(kind)}</style></head>
<body>${body(p)}</body></html>`;
    const name = (p.name || "简历") + "-" + KINDS[kind].name + ".doc";
    return { html, filename: name };
  }

  root.ResumeTPL = { KINDS, build };
})(typeof window !== "undefined" ? window : globalThis);
