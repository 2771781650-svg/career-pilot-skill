"""回归测试：python -m unittest discover -s tests -v"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent.profile import Profile
from tools import build_registry
from tools.exporter import sections_from_text
from tools.skills_graph import coverage, category_of


RESUME = """张明｜河北能源职业技术学院 数字媒体技术 大专｜求职意向：新媒体运营
技能：PS、剪映、3ds Max、公众号运营
项目：大境门文创设计，完成 20 张海报，公众号推文 8 篇
实习：北京上地派出所 夜班保安 3 个月
证书：英语四级备考中"""


class TestProfile(unittest.TestCase):
    def test_extract_basic(self):
        p = Profile().merge("我叫张明，河北能源职业技术学院 数字媒体技术 大专，会 PS 和剪映，想投新媒体运营")
        self.assertEqual(p.name, "张明")
        self.assertIn("数字媒体技术", p.major)
        self.assertIn("ps", p.skills.lower())
        self.assertEqual(p.target_job, "新媒体运营")

    def test_merge_keeps_first(self):
        p = Profile().merge("我叫张明").merge("我叫李四")
        self.assertEqual(p.name, "张明")

    def test_missing_asks_target_first(self):
        p = Profile().merge("会 PS 和剪映")
        keys = [k for k, _ in p.missing()]
        self.assertEqual(keys[0], "target_job")

    def test_certs_dedup(self):
        p = Profile().merge("英语四级在备考，四级重要")
        self.assertEqual(p.certs, "英语四级")


class TestSkillsGraph(unittest.TestCase):
    def test_exact(self):
        self.assertEqual(coverage("剪映", "我会用剪映剪片子"), 1.0)

    def test_same_category(self):
        self.assertGreaterEqual(coverage("pr", "我会剪映"), 0.5)

    def test_unknown(self):
        self.assertEqual(coverage("数据标注", "我会 PS 和剪映"), 0.0)

    def test_category_of(self):
        self.assertTrue(category_of("剪映"))


class TestTools(unittest.TestCase):
    def setUp(self):
        self.reg = build_registry()

    def test_analyze_resume_scores(self):
        out = self.reg.run("analyze_resume", {"resume_text": RESUME})
        self.assertIn("简历体检", out)
        self.assertRegex(out, r"\d+/100")

    def test_match_job_has_gap(self):
        out = self.reg.run("match_job", {"resume_text": RESUME, "job_title": "前端开发工程师"})
        self.assertIn("匹配度", out)
        self.assertIn("缺口", out)

    def test_match_job_unknown_title(self):
        out = self.reg.run("match_job", {"resume_text": RESUME, "job_title": "不存在的岗位"})
        self.assertIn("没有", out)

    def test_rank_jobs(self):
        out = self.reg.run("rank_jobs", {"resume_text": RESUME, "top": 3})
        self.assertIn("岗位推荐", out)

    def test_build_resume_has_sections(self):
        out = self.reg.run("build_resume", {"name": "张明", "edu": "大专 数媒",
                                           "skills": "PS 剪映", "experience": "做过公众号",
                                           "target_job": "新媒体运营", "certs": "英语四级备考中"})
        self.assertIn("核心技能", out)
        self.assertIn("关键词投放", out)

    def test_evaluate_answer_star(self):
        out = self.reg.run("evaluate_answer", {"question": "讲一次你带团队的经历",
                                              "answer": "当时社团要办活动，我负责排期，最后来了 300 人。"})
        self.assertIn("STAR", out)

    def test_career_plan_weeks(self):
        out = self.reg.run("career_plan", {"goal": "就业", "major": "数字媒体",
                                          "hours_per_week": 12, "weeks": 8})
        self.assertIn("第 8 周", out)


class TestExport(unittest.TestCase):
    def test_sections_from_text(self):
        from tools import build_registry as br
        text = br().run("build_resume", {"name": "张明", "edu": "大专", "skills": "PS 剪映",
                                         "experience": "做过公众号", "target_job": "新媒体运营"})
        head, sections = sections_from_text(text)
        self.assertTrue(sections)
        self.assertIn("核心技能", [s[0] for s in sections])

    def test_build_payload_bytes(self):
        from tools.exporter import build_payload
        fn, blob = build_payload("简历", [("技能", ["- PS", "- 剪映"])])
        self.assertTrue(fn.endswith((".docx", ".doc")))
        self.assertGreater(len(blob), 100)


if __name__ == "__main__":
    unittest.main()
