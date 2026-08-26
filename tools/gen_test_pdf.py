# -*- coding: utf-8 -*-
"""生成用于测试的中文简历PDF（模拟真实用户简历结构）"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# 注册中文字体（微软雅黑）
FONT = None
for candidate in [
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]:
    if os.path.exists(candidate):
        try:
            pdfmetrics.registerFont(TTFont("CNFont", candidate, subfontIndex=0))
            FONT = "CNFont"
            break
        except Exception:
            continue
if not FONT:
    raise SystemExit("no chinese font")

out = os.path.join(os.path.dirname(__file__), "test_resume.pdf")
c = canvas.Canvas(out, pagesize=A4)
W, H = A4
x = 18 * mm
y = H - 18 * mm
line_h = 6.2 * mm

def line(text, size=10.5, bold=False):
    global y
    c.setFont(FONT, size)
    c.drawString(x, y, text)
    y -= line_h

# ===== 简历正文（模拟真实用户PDF简历）=====
line("王艺凯", 17)
line("求职意向：数据分析 / 产品运营    调剂意向：接受相近岗位调剂（运营分析/商业分析）", 10)
line("电话：13812345678   邮箱：wangyikai@example.com", 10)
line("现居城市：上海   期望城市：上海 / 杭州   期望薪资：10-15K", 10)
y -= 3 * mm
line("教育背景", 12.5)
line("2022.09 - 2026.06   华东师范大学   统计学专业   本科", 10)
line("主修课程：概率论与数理统计、回归分析、多元统计、机器学习导论、数据库原理", 10)
line("GPA 3.6/4.0（专业前20%）  英语六级（CET-6 552分）", 10)
y -= 3 * mm
line("实习经历", 12.5)
line("2025.06 - 2025.09   字节跳动   数据分析实习生", 10)
line("- 负责抖音电商频道日常数据监控，搭建周报指标体系，覆盖GMV、转化率等12项核心指标", 10)
line("- 使用SQL+Python完成用户行为漏斗分析，定位转化率下降原因，推动改版后转化率提升8%", 10)
line("2024.06 - 2024.09   欧莱雅（中国）   市场部实习生", 10)
line("- 参与美妆新品上市campaign策划，负责竞品数据收集与社媒声量监测", 10)
y -= 3 * mm
line("项目经历", 12.5)
line("校园二手交易平台「青苗」   产品负责人   2023.09-2024.05", 10)
line("- 主导需求调研与PRD撰写，协调5人团队完成小程序开发，注册用户3000+", 10)
y -= 3 * mm
line("技能证书", 12.5)
line("技能：SQL、Python（pandas/sklearn）、Excel、Tableau、SPSS", 10)
line("证书：CET-6、证券从业资格证、计算机二级", 10)
y -= 3 * mm
line("自我评价", 12.5)
line("数据敏感度高，擅长将业务问题转化为分析框架；沟通协作能力强，有跨部门项目经验。", 10)

c.save()
print("PDF generated:", out, os.path.getsize(out), "bytes")
