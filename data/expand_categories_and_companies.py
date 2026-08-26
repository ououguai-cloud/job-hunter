#!/usr/bin/env python3
"""
职聘通 JobHunter - 岗位大类扩充 + A股公司扩充脚本 v2
功能：
1. 将现有"职能"大类下的岗位重新分类到新的12个大类
2. 真实A股上市公司数据（915家，来自 a_stock_data.py）
3. 程序化补足至2000家A股风格上市公司（合计）
4. 生成2000家上市公司旗下二三级子公司
5. 每家新公司生成多样化岗位（新大类+传统大类混合，按行业偏置）
6. 为现有公司补充新大类岗位
7. 输出更新后的 jobs.json

运行: python data/expand_categories_and_companies.py
"""
import json, random, os, re, sys, hashlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from a_stock_data import SECTIONS

ROOT = Path(__file__).parent.parent
JOBS_FILE = ROOT / "db" / "jobs.json"

random.seed(20260825)  # 可复现

# ===== 1. 重新分类规则（标题优先 + 旧细分兜底）=====
ROLE_RULES = [
    (r'财务分析|FP&A|财务经理|资金管理|成本核算|预算', '金融/财会', '财务分析'),
    (r'会计|出纳|记账', '金融/财会', '会计'),
    (r'审计|内审|外审', '金融/财会', '审计'),
    (r'税务', '金融/财会', '税务'),
    (r'风控|风险管理|信审|授信', '金融/财会', '风控管理'),
    (r'法务|法律顾问|合同审查', '法务/合规', '法务'),
    (r'合规|反洗钱|内控', '法务/合规', '合规'),
    (r'知识产权|专利|商标', '法务/合规', '知识产权'),
    (r'招聘|HRBP|组织发展|OD', '人力资源', '招聘/OD'),
    (r'薪酬|绩效|SSC', '人力资源', '薪酬绩效'),
    (r'培训|人才发展|TD|LD', '人力资源', '培训发展'),
    (r'员工关系|ER|企业文化', '人力资源', '员工关系'),
    (r'咨询|顾问|管理咨询', '咨询/企管', '管理咨询'),
    (r'企管|经营管理|流程|PMO', '咨询/企管', '企业管理'),
    (r'教师|主讲|授课', '教育/培训', '教学'),
    (r'教研|课程设计', '教育/培训', '教研'),
    (r'教育咨询|学习规划', '教育/培训', '教育咨询'),
    (r'医生|医师', '医疗/健康', '医师'),
    (r'护士|护理', '医疗/健康', '护理'),
    (r'药师', '医疗/健康', '药学'),
    (r'医学事务|MSL', '医疗/健康', '医学事务'),
    (r'医药研发|药物研发|药品研发|临床前|制剂研发', '医疗/健康', '医药研发'),
    (r'文案|编辑|撰稿', '内容/创意', '文案编辑'),
    (r'编导|导演', '内容/创意', '编导'),
    (r'创意|概念设计', '内容/创意', '创意'),
    (r'客服|售后|客户成功', '客户服务', '客户服务'),
    (r'质量管理|品控|QA|QC|ISO', '品质/安全', '质量管理'),
    (r'安全|环保|HSE|EHS|安全生产', '品质/安全', '安全环保'),
    (r'研究员|科研', '科研/学术', '科研'),
    (r'实验室', '科研/学术', '实验技术'),
    (r'投资经理|PE|VC', '战略/投资', '投资管理'),
    (r'战略|经营分析|商业分析', '战略/投资', '战略分析'),
    (r'并购|M&A|投行', '战略/投资', '并购'),
    (r'行政|文员|助理|秘书|前台', '行政/后勤', '行政'),
    (r'后勤|物业|车辆管理', '行政/后勤', '后勤'),
    (r'网络安全|信息安全|渗透|安全运营|安全工程师', '技术', '网络安全'),
    (r'人力|HR|人力资源', '人力资源', 'HR综合'),
    (r'投研|造价|合约|招采|工程管理|投资研究|投资拓展', '战略/投资', '投研/造价'),
    (r'管培生|管理培训生|储备干部|综合管理', '职能', '职能综合'),
]
COMPILED_RULES = [(re.compile(p, re.I), r, s) for p, r, s in ROLE_RULES]

# 旧细分兜底映射: 职能的旧subRole -> (新大类, 新细分)
SUBROLE_FALLBACK = {
    '财务/审计': ('金融/财会', '财务分析'),
    '法务/风控': ('法务/合规', '法务'),
    '投研/造价': ('战略/投资', '投研/造价'),
    '人力资源': ('人力资源', 'HR综合'),
    '医药研发': ('医疗/健康', '医药研发'),
    '网络安全': ('技术', '网络安全'),
    '行政': ('行政/后勤', '行政'),
    '职能综合': ('职能', '职能综合'),
}

def reclassify_job(job):
    """将旧'职能'大类岗位重新分类到新大类"""
    if job.get('role') != '职能':
        return job
    title = job.get('title', '')
    for pattern, new_role, sub_role in COMPILED_RULES:
        if pattern.search(title):
            job['role'] = new_role
            job['subRole'] = sub_role
            return job
    # 标题未命中 -> 按旧细分兜底
    old_sub = job.get('subRole', '')
    if old_sub in SUBROLE_FALLBACK:
        job['role'], job['subRole'] = SUBROLE_FALLBACK[old_sub]
    return job

# ===== 2. 构建真实A股公司列表 =====
def build_real_companies():
    companies = []
    for industry, ctype, cat, rows in SECTIONS:
        for name, code, city, prov, scale, tier in rows:
            companies.append({
                "name": name, "code": code, "industry": industry,
                "city": city, "prov": prov, "ctype": ctype, "ctypeCat": cat,
                "scale": scale, "tier": tier,
            })
    return companies

# ===== 3. 程序化生成补充上市公司（补足至2000家）=====
CITY_POOL = [
    ("北京","北京",10),("上海","上海",10),("深圳","广东",9),("广州","广东",7),
    ("杭州","浙江",7),("成都","四川",6),("苏州","江苏",6),("南京","江苏",6),
    ("武汉","湖北",5),("西安","陕西",5),("重庆","重庆",5),("天津","天津",4),
    ("长沙","湖南",4),("郑州","河南",4),("青岛","山东",4),("合肥","安徽",4),
    ("无锡","江苏",4),("宁波","浙江",4),("佛山","广东",3),("东莞","广东",3),
    ("厦门","福建",3),("福州","福建",3),("济南","山东",3),("沈阳","辽宁",2),
    ("大连","辽宁",2),("昆明","云南",2),("贵阳","贵州",2),("南昌","江西",2),
    ("哈尔滨","黑龙江",2),("长春","吉林",2),("石家庄","河北",2),("太原","山西",2),
    ("兰州","甘肃",1),("乌鲁木齐","新疆",1),("南宁","广西",2),("温州","浙江",2),
    ("常州","江苏",2),("绍兴","浙江",2),("嘉兴","浙江",2),("台州","浙江",2),
    ("金华","浙江",2),("泉州","福建",2),("烟台","山东",2),("潍坊","山东",2),
    ("保定","河北",1),("洛阳","河南",2),("芜湖","安徽",2),("株洲","湖南",2),
    ("柳州","广西",1),("唐山","河北",1),("徐州","江苏",2),("南通","江苏",2),
    ("惠州","广东",2),("中山","广东",1),("珠海","广东",1),("江门","广东",1),
    ("泰州","江苏",1),("扬州","江苏",1),("镇江","江苏",1),("盐城","江苏",1),
    ("淮安","江苏",1),("湖州","浙江",1),("湘潭","湖南",1),("宜昌","湖北",1),
    ("襄阳","湖北",1),("岳阳","湖南",1),("临沂","山东",2),("淄博","山东",1),
    ("济宁","山东",1),("包头","内蒙古",1),("银川","宁夏",1),("西宁","青海",1),
    ("海口","海南",1),("呼和浩特","内蒙古",1),("邯郸","河北",1),("沧州","河北",1),
]
NAME_PREFIX = [
    "华辰","瑞泰","康诺","中晟","恒锋","金桥","龙腾","宏远","联创","科瑞",
    "智远","汇金","凯诚","拓源","万邦","正阳","通宇","利康","安泰","博敏",
    "精工","创力","盛视","星辰","晨光","云途","海纳","山河","江源","湖光",
    "峰远","航锐","光启","电科","宇辰","晟元","昊远","泓润","朗科","诺德",
    "贝特","芯睿","帆顺","纬创","坤元","鼎盛","基业","源创","本真","尚德",
    "雅艺","优选","卓越","益康","和顺","合众","丰盛","隆达","裕丰","盈科",
    "聚能","广博","大恒","巨轮","伟星","盛邦","兴旺","发源","达运","腾跃",
    "驰远","迅捷","速联","风华","雷腾","雪龙","雨虹","岚图","岛林","湾流",
    "港基","城建","州府","禾望","穗丰","榕光","鹭江",
]
INDUSTRY_CORE = {
    "互联网/科技": ["信息","软件","数据","智能","网络","数字","云科","网科","智联"],
    "金融/银行":   ["金融","资本","投资","融租","金服","财富"],
    "半导体/电子": ["半导体","微电子","电子","光电","集成电路","微芯","晶科"],
    "医药/健康":   ["生物","医药","医疗","制药","健康","药业","医疗器"],
    "制造/工业":   ["智能装备","精密制造","机械","工业","重工","智造","精工"],
    "汽车/新能源": ["新能源","动力","传动","车部件","动力科"],
    "消费/快消":   ["商贸","实业","家居","服饰","日化","消费"],
    "餐饮/食品":   ["食品","餐饮","食品科","味业","乳品"],
    "农林牧渔":    ["农业","种业","牧业","渔业","农科","生态"],
    "交通/物流":   ["物流","供应链","运输","港务","仓储"],
    "能源/公用":   ["能源","电力","热电","环保","燃气","水务"],
    "通信/运营商": ["通信","通讯","信科","物联","网通"],
    "文娱/游戏":   ["文化","传媒","娱乐","文创","影业"],
    "教育/培训":   ["教育","学堂","文教","知识","学创"],
    "旅游/航空":   ["旅游","文旅","酒店","旅行","景区"],
    "航天/军工":   ["航空科技","航天配件","精密仪器","航空电"],
    "地产/建筑":   ["置业","建设","建工","城建","地产","基建"],
}
# 各行业补充数量（补足约1085家）
SYNTHETIC_QUOTA = {
    "互联网/科技": 80, "金融/银行": 60, "半导体/电子": 60, "医药/健康": 70,
    "制造/工业": 130, "汽车/新能源": 70, "消费/快消": 85, "餐饮/食品": 30,
    "农林牧渔": 45, "交通/物流": 55, "能源/公用": 65, "地产/建筑": 65,
    "通信/运营商": 50, "文娱/游戏": 55, "教育/培训": 40, "旅游/航空": 55,
    "航天/军工": 55,
}
# 代码段: (前缀范围, 板块)
CODE_RANGES = [
    (range(600000, 604000), "SH主板"),
    (range(605000, 606000), "SH主板"),
    (range(688001, 690000), "科创板"),
    (range(2, 2000), "SZ主板"),      # 000002-001999
    (range(2000, 4000), "SZ主板"),   # 002000-003999
    (range(300001, 302000), "创业板"),
    (range(830000, 840000), "北交所"),
    (range(870000, 880000), "北交所"),
]
CODE_WEIGHTS = [30, 8, 12, 18, 20, 15, 3, 4]

def weighted_city():
    total = sum(w for _, _, w in CITY_POOL)
    r = random.uniform(0, total)
    acc = 0
    for city, prov, w in CITY_POOL:
        acc += w
        if r <= acc:
            return city, prov
    return CITY_POOL[0][0], CITY_POOL[0][1]

def gen_code(existing_codes):
    while True:
        rng = random.choices([r for r, _ in CODE_RANGES], weights=CODE_WEIGHTS)[0]
        code = str(random.choice(list(rng))).zfill(6)
        if code not in existing_codes:
            existing_codes.add(code)
            return code

def generate_synthetic_companies(existing_names, existing_codes, target):
    """生成补充的A股风格上市公司，数量按目标动态分配"""
    synth = []
    base_total = sum(SYNTHETIC_QUOTA.values())
    scaled = {ind: max(3, round(q * target / base_total)) for ind, q in SYNTHETIC_QUOTA.items()}
    # 校正总数
    diff = target - sum(scaled.values())
    if diff > 0:
        scaled["制造/工业"] += diff
    elif diff < 0:
        scaled["制造/工业"] += diff
    for industry, quota in scaled.items():
        cores = INDUSTRY_CORE[industry]
        made = 0
        attempts = 0
        while made < quota and attempts < quota * 30:
            attempts += 1
            name = random.choice(NAME_PREFIX) + random.choice(cores)
            if name in existing_names:
                continue
            city, prov = weighted_city()
            code = gen_code(existing_codes)
            tier = random.choices(["大厂", "中厂", "小厂"], weights=[12, 55, 33])[0]
            scale = {"大厂": random.choice(["1万+", "5000+"]),
                    "中厂": random.choice(["2000+", "5000+"]),
                    "小厂": random.choice(["500+", "2000+"])}[tier]
            comp = {
                "name": name, "code": code, "industry": industry,
                "city": city, "prov": prov,
                "ctype": "上市公司", "ctypeCat": "上市公司",
                "scale": scale, "tier": tier,
            }
            synth.append(comp)
            existing_names.add(name)
            made += 1
    return synth

# ===== 4. 子公司生成 =====
SUB_SUFFIXES = [
    "科技", "信息技术", "软件", "数据科技", "智能科技", "新能源", "新材料",
    "投资", "供应链", "物流", "数字科技", "产业发展", "技术服务", "智能制造",
    "精密制造", "生物医药", "电子材料", "环保科技", "电力工程", "置业",
    "商贸", "国际贸易", "文化传媒", "教育科技", "酒店管理", "建设工程",
    "机械制造", "自动化", "光电科技", "汽车零部件", "食品科技", "农业科技",
]

def generate_subcompanies(parent_companies, count=2000):
    subs = []
    pool = list(parent_companies)
    random.shuffle(pool)
    for parent in pool:
        n = random.randint(2, 3)
        for i in range(n):
            suffix = random.choice(SUB_SUFFIXES)
            sub_name = f"{parent['name']}{suffix}"
            if sub_name in _all_names:
                continue
            _all_names.add(sub_name)
            tier = random.choices(["中厂", "小厂"], weights=[45, 55])[0]
            sub = {
                "name": sub_name,
                "code": parent["code"] + "-" + str(i + 1),
                "industry": parent["industry"],
                "city": parent["city"],
                "prov": parent["prov"],
                "ctype": "上市子公司",
                "ctypeCat": "上市公司",
                "scale": {"中厂": random.choice(["2000+", "5000+"]),
                          "小厂": random.choice(["500+", "2000+"])}[tier],
                "tier": tier,
                "parent": parent["name"],
            }
            subs.append(sub)
            if len(subs) >= count:
                return subs
    return subs

# ===== 5. 岗位模板 =====
NEW_JOB_TEMPLATES = {
    "金融/财会": [
        {"title":"财务分析师(FA)","role":"金融/财会","subRole":"财务分析","degree":"本科及以上","kw":["财务分析","预算管理","成本核算","报表","ERP","SAP"],"desc":"负责业务财务分析与预算管理，输出经营洞察。"},
        {"title":"会计专员","role":"金融/财会","subRole":"会计","degree":"本科及以上","kw":["会计","记账","出纳","税务","用友","金蝶"],"desc":"负责日常会计核算与税务申报。"},
        {"title":"审计专员","role":"金融/财会","subRole":"审计","degree":"本科及以上","kw":["审计","内控","CPA","ACCA","风控"],"desc":"负责内部审计与风险检查。"},
        {"title":"风险管理岗","role":"金融/财会","subRole":"风控管理","degree":"本科及以上","kw":["风控","风险管理","信审","授信","模型"],"desc":"负责信用风险评估与管控。"},
        {"title":"资金管理专员","role":"金融/财会","subRole":"财务分析","degree":"本科及以上","kw":["资金管理","现金流","银行","融资"],"desc":"负责资金调度与现金流管理。"},
        {"title":"税务专员","role":"金融/财会","subRole":"税务","degree":"本科及以上","kw":["税务","税法","增值税","发票"],"desc":"负责企业税务筹划与申报。"},
    ],
    "法务/合规": [
        {"title":"法务专员","role":"法务/合规","subRole":"法务","degree":"本科及以上","kw":["法务","合同审查","法律","诉讼","劳动法"],"desc":"负责合同审查与法律事务处理。"},
        {"title":"合规专员","role":"法务/合规","subRole":"合规","degree":"本科及以上","kw":["合规","内控","监管","风险"],"desc":"负责企业合规体系建设与执行。"},
        {"title":"知识产权专员","role":"法务/合规","subRole":"知识产权","degree":"本科及以上","kw":["知识产权","专利","商标","版权"],"desc":"负责知识产权申请与管理。"},
    ],
    "人力资源": [
        {"title":"招聘专员","role":"人力资源","subRole":"招聘/OD","degree":"本科及以上","kw":["招聘","面试","人才盘点","HRBP"],"desc":"负责人才招聘与组织发展。"},
        {"title":"薪酬绩效专员","role":"人力资源","subRole":"薪酬绩效","degree":"本科及以上","kw":["薪酬","绩效","SSC","数据分析"],"desc":"负责薪酬体系与绩效管理。"},
        {"title":"培训发展专员","role":"人力资源","subRole":"培训发展","degree":"本科及以上","kw":["培训","人才发展","TD","课程设计"],"desc":"负责培训体系与人才发展。"},
        {"title":"员工关系专员","role":"人力资源","subRole":"员工关系","degree":"本科及以上","kw":["员工关系","企业文化","劳动法"],"desc":"负责员工关系与企业文化。"},
        {"title":"HRBP","role":"人力资源","subRole":"招聘/OD","degree":"本科及以上","kw":["HRBP","业务伙伴","组织发展","人才盘点"],"desc":"作为业务部门的人力资源合作伙伴。"},
    ],
    "咨询/企管": [
        {"title":"管理咨询顾问","role":"咨询/企管","subRole":"管理咨询","degree":"硕士及以上","kw":["咨询","战略","管理","分析","框架"],"desc":"为客户提供管理咨询与战略规划服务。"},
        {"title":"企业管理专员","role":"咨询/企管","subRole":"企业管理","degree":"本科及以上","kw":["经营管理","流程","PMO","项目管理"],"desc":"负责企业经营管理与流程优化。"},
    ],
    "教育/培训": [
        {"title":"主讲教师","role":"教育/培训","subRole":"教学","degree":"本科及以上","kw":["教学","授课","教研","学科"],"desc":"负责学科教学与课程交付。"},
        {"title":"教研专员","role":"教育/培训","subRole":"教研","degree":"本科及以上","kw":["教研","课程设计","教材","学科"],"desc":"负责课程体系与教学产品研发。"},
        {"title":"教育咨询师","role":"教育/培训","subRole":"教育咨询","degree":"本科及以上","kw":["咨询","规划","教育","客户服务"],"desc":"为客户提供教育规划与咨询服务。"},
    ],
    "医疗/健康": [
        {"title":"执业医师","role":"医疗/健康","subRole":"医师","degree":"本科及以上","kw":["医生","医师","执业","临床","诊断"],"desc":"负责临床诊断与治疗。"},
        {"title":"护理专员","role":"医疗/健康","subRole":"护理","degree":"大专及以上","kw":["护士","护理","临床","沟通"],"desc":"负责临床护理与患者服务。"},
        {"title":"药师","role":"医疗/健康","subRole":"药学","degree":"本科及以上","kw":["药师","药剂","处方","药品","GMP"],"desc":"负责药品调配与用药指导。"},
        {"title":"医学事务专员","role":"医疗/健康","subRole":"医学事务","degree":"硕士及以上","kw":["医学事务","MSL","学术","循证","文献"],"desc":"负责医学支持与学术推广。"},
        {"title":"医药研发工程师","role":"医疗/健康","subRole":"医药研发","degree":"硕士及以上","kw":["药物研发","制剂","临床前","实验","药理"],"desc":"负责药物研发与实验研究。"},
    ],
    "内容/创意": [
        {"title":"文案策划","role":"内容/创意","subRole":"文案编辑","degree":"本科及以上","kw":["文案","编辑","创意","内容","策划"],"desc":"负责品牌文案与内容策划。"},
        {"title":"内容编导","role":"内容/创意","subRole":"编导","degree":"本科及以上","kw":["编导","导演","短视频","策划"],"desc":"负责视频内容编导与制作。"},
        {"title":"创意设计师","role":"内容/创意","subRole":"创意","degree":"本科及以上","kw":["创意","设计","概念","品牌","视觉"],"desc":"负责创意概念设计与品牌视觉。"},
    ],
    "客户服务": [
        {"title":"客户成功经理","role":"客户服务","subRole":"客户服务","degree":"本科及以上","kw":["客户成功","客户服务","售后","SaaS"],"desc":"负责客户成功管理与续约。"},
        {"title":"售后服务专员","role":"客户服务","subRole":"客户服务","degree":"大专及以上","kw":["售后","客户服务","沟通","问题处理"],"desc":"负责售后服务与客户满意度。"},
    ],
    "品质/安全": [
        {"title":"质量管理工程师","role":"品质/安全","subRole":"质量管理","degree":"本科及以上","kw":["质量管理","品控","QA","QC","ISO","六西格玛"],"desc":"负责产品质量管理与体系认证。"},
        {"title":"安全环保工程师","role":"品质/安全","subRole":"安全环保","degree":"本科及以上","kw":["安全","环保","HSE","EHS","安全生产"],"desc":"负责安全生产与环保合规。"},
    ],
    "科研/学术": [
        {"title":"研究员","role":"科研/学术","subRole":"科研","degree":"硕士及以上","kw":["研究","科研","课题","论文","实验"],"desc":"负责前沿技术研究和课题攻关。"},
        {"title":"实验技术员","role":"科研/学术","subRole":"实验技术","degree":"本科及以上","kw":["实验室","实验","设备","检测"],"desc":"负责实验室设备操作与检测。"},
    ],
    "战略/投资": [
        {"title":"投资经理","role":"战略/投资","subRole":"投资管理","degree":"硕士及以上","kw":["投资","PE","VC","估值","尽调"],"desc":"负责投资项目筛选与尽调。"},
        {"title":"战略分析师","role":"战略/投资","subRole":"战略分析","degree":"硕士及以上","kw":["战略","经营分析","商业分析","行业研究"],"desc":"负责公司战略规划与经营分析。"},
        {"title":"投研分析师","role":"战略/投资","subRole":"投研/造价","degree":"硕士及以上","kw":["投研","行研","估值","分析"],"desc":"负责行业研究与投资分析。"},
    ],
    "行政/后勤": [
        {"title":"行政专员","role":"行政/后勤","subRole":"行政","degree":"大专及以上","kw":["行政","文员","助理","Office","档案"],"desc":"负责日常行政事务与文档管理。"},
        {"title":"后勤管理专员","role":"行政/后勤","subRole":"后勤","degree":"大专及以上","kw":["后勤","物业","车辆","采购"],"desc":"负责后勤保障与物业车辆管理。"},
    ],
    "职能": [
        {"title":"管理培训生","role":"职能","subRole":"职能综合","degree":"本科及以上","kw":["管培生","轮岗","管理","培养"],"desc":"管理培训生项目，轮岗培养综合管理人才。"},
    ],
}

# 传统大类岗位模板（细分与现有体系一致）
TRADITIONAL_TEMPLATES = [
    {"title":"软件开发工程师","role":"技术","subRole":"后端开发","degree":"本科及以上","kw":["Java","Python","开发","数据库","后端"],"desc":"负责后端系统设计与开发。"},
    {"title":"前端开发工程师","role":"技术","subRole":"前端开发","degree":"本科及以上","kw":["前端","JavaScript","Vue","React","Web"],"desc":"负责Web前端开发与交互实现。"},
    {"title":"算法工程师","role":"技术","subRole":"算法/AI","degree":"硕士及以上","kw":["算法","机器学习","深度学习","AI","模型"],"desc":"负责算法模型研发与优化。"},
    {"title":"数据工程师","role":"技术","subRole":"数据/大数据","degree":"本科及以上","kw":["大数据","数据仓库","Spark","Hive","ETL"],"desc":"负责数据平台与数据仓库建设。"},
    {"title":"测试工程师","role":"技术","subRole":"测试/质量","degree":"本科及以上","kw":["测试","自动化","QA","用例","Selenium"],"desc":"负责产品质量保障与自动化测试。"},
    {"title":"运维工程师","role":"技术","subRole":"运维/云计算","degree":"本科及以上","kw":["运维","云计算","K8s","Docker","Linux"],"desc":"负责系统运维与云平台管理。"},
    {"title":"嵌入式软件工程师","role":"技术","subRole":"嵌入式/硬件","degree":"本科及以上","kw":["嵌入式","C语言","单片机","硬件","固件"],"desc":"负责嵌入式软件与硬件开发。"},
    {"title":"机械工程师","role":"技术","subRole":"机械/工艺","degree":"本科及以上","kw":["机械","SolidWorks","工艺","制图","CAD"],"desc":"负责机械设计与工艺开发。"},
    {"title":"电气工程师","role":"技术","subRole":"电气/自动化","degree":"本科及以上","kw":["电气","PLC","自动化","控制","图纸"],"desc":"负责电气系统与自动化控制设计。"},
    {"title":"产品经理","role":"产品","subRole":"产品经理","degree":"本科及以上","kw":["产品","需求分析","用户研究","数据分析"],"desc":"负责产品规划与迭代管理。"},
    {"title":"数据分析师","role":"产品","subRole":"数据分析","degree":"本科及以上","kw":["数据分析","SQL","BI","报表","Excel"],"desc":"负责业务数据分析与洞察输出。"},
    {"title":"用户研究员","role":"产品","subRole":"用户研究","degree":"本科及以上","kw":["用户研究","调研","访谈","可用性测试"],"desc":"负责用户研究与体验洞察。"},
    {"title":"UI设计师","role":"设计","subRole":"UI/UX","degree":"本科及以上","kw":["UI","UX","Figma","交互","设计"],"desc":"负责产品界面与交互设计。"},
    {"title":"视觉设计师","role":"设计","subRole":"视觉/平面","degree":"本科及以上","kw":["视觉","平面","品牌","海报","设计"],"desc":"负责品牌视觉与平面设计。"},
    {"title":"工业设计师","role":"设计","subRole":"工业设计","degree":"本科及以上","kw":["工业设计","外观","建模","CMF"],"desc":"负责产品外观与工业设计。"},
    {"title":"运营专员","role":"运营","subRole":"运营综合","degree":"本科及以上","kw":["运营","数据分析","用户","活动"],"desc":"负责日常运营与活动管理。"},
    {"title":"新媒体运营","role":"运营","subRole":"内容/新媒体","degree":"本科及以上","kw":["新媒体","内容","抖音","小红书","公众号"],"desc":"负责新媒体内容运营与增长。"},
    {"title":"电商运营","role":"运营","subRole":"电商运营","degree":"本科及以上","kw":["电商","淘宝","京东","直播","店铺"],"desc":"负责电商平台运营与推广。"},
    {"title":"市场专员","role":"市场","subRole":"市场综合","degree":"本科及以上","kw":["市场","营销","策划","活动"],"desc":"负责市场推广与活动策划。"},
    {"title":"品牌专员","role":"市场","subRole":"品牌/公关","degree":"本科及以上","kw":["品牌","公关","传播","媒体"],"desc":"负责品牌建设与公关传播。"},
    {"title":"销售代表","role":"销售","subRole":"销售代表","degree":"大专及以上","kw":["销售","客户","商务","谈判"],"desc":"负责销售业务拓展与客户维护。"},
    {"title":"大客户经理","role":"销售","subRole":"大客户/KA","degree":"本科及以上","kw":["大客户","KA","解决方案","商务"],"desc":"负责大客户开发与关系管理。"},
    {"title":"渠道经理","role":"销售","subRole":"渠道/经销","degree":"本科及以上","kw":["渠道","经销","分销","代理商"],"desc":"负责渠道体系建设与管理。"},
    {"title":"采购专员","role":"供应链","subRole":"采购","degree":"本科及以上","kw":["采购","供应商","招投标","成本"],"desc":"负责采购执行与供应商管理。"},
    {"title":"供应链专员","role":"供应链","subRole":"供应链综合","degree":"本科及以上","kw":["供应链","计划","协调","ERP"],"desc":"负责供应链计划与协同。"},
    {"title":"物流专员","role":"供应链","subRole":"物流/仓储","degree":"大专及以上","kw":["物流","仓储","运输","配送"],"desc":"负责物流仓储运营管理。"},
]

# 行业偏置: 行业 -> (新大类权重, 传统模板关键词权重)
INDUSTRY_BIAS = {
    "互联网/科技":  {"new": {"人力资源":3,"法务/合规":2,"金融/财会":2,"客户服务":2}, "trad_kw": ["开发","算法","数据","测试","运维","产品","运营","设计"]},
    "金融/银行":    {"new": {"金融/财会":8,"法务/合规":3,"人力资源":2,"战略/投资":2}, "trad_kw": ["数据","产品","运营"]},
    "半导体/电子":  {"new": {"品质/安全":4,"科研/学术":3,"人力资源":2}, "trad_kw": ["开发","硬件","测试","工艺","电气","数据"]},
    "医药/健康":    {"new": {"医疗/健康":8,"科研/学术":3,"品质/安全":3,"法务/合规":2}, "trad_kw": ["销售","数据","市场"]},
    "制造/工业":    {"new": {"品质/安全":5,"咨询/企管":2,"人力资源":2,"金融/财会":2}, "trad_kw": ["机械","电气","工艺","采购","供应链","销售"]},
    "汽车/新能源":  {"new": {"品质/安全":5,"科研/学术":2,"战略/投资":2}, "trad_kw": ["机械","电气","硬件","采购","供应链","测试"]},
    "消费/快消":    {"new": {"品质/安全":3,"市场":0,"人力资源":2,"金融/财会":2}, "trad_kw": ["市场","销售","品牌","电商","运营","供应链"]},
    "餐饮/食品":    {"new": {"品质/安全":6,"人力资源":2}, "trad_kw": ["供应链","采购","销售","运营"]},
    "农林牧渔":     {"new": {"品质/安全":4,"科研/学术":4}, "trad_kw": ["销售","供应链","采购"]},
    "交通/物流":    {"new": {"品质/安全":3,"客户服务":3,"人力资源":2}, "trad_kw": ["物流","供应链","数据","运营"]},
    "能源/公用":    {"new": {"品质/安全":6,"法务/合规":2,"金融/财会":2}, "trad_kw": ["电气","工艺","数据","采购"]},
    "通信/运营商":  {"new": {"客户服务":4,"品质/安全":2,"人力资源":2}, "trad_kw": ["开发","运维","数据","网络"]},
    "文娱/游戏":    {"new": {"内容/创意":8,"教育/培训":2}, "trad_kw": ["设计","运营","产品","开发"]},
    "教育/培训":    {"new": {"教育/培训":8,"内容/创意":3,"客户服务":2}, "trad_kw": ["市场","销售","运营","设计"]},
    "旅游/航空":    {"new": {"客户服务":5,"内容/创意":2,"人力资源":2}, "trad_kw": ["市场","运营","销售"]},
    "航天/军工":    {"new": {"科研/学术":5,"品质/安全":4,"法务/合规":2}, "trad_kw": ["机械","电气","硬件","工艺","测试"]},
    "地产/建筑":    {"new": {"品质/安全":4,"战略/投资":3,"法务/合规":2,"咨询/企管":2}, "trad_kw": ["造价","采购","供应链","销售","设计"]},
}

LOGO_COLORS = ['#7342E2','#2563eb','#16a34a','#d97706','#dc2626','#0891b2','#9333ea','#059669','#4f46e5','#db2777','#ea580c','#0d9488','#7c3aed','#c026d3','#2563eb','#16a34a']
TRACK_TYPES = [('应届生','校招','2026-2027届'), ('往届生','校招','2025-2026届'), ('社招','社招','经验不限'), ('实习生','实习','2027-2028届')]
SALARY_RANGES = ['6-10K·13薪','8-12K·13薪','10-15K·14薪','12-18K·14薪','15-25K·14薪','15-30K·15薪','20-35K·15薪','25-40K·16薪','30-50K·16薪','面议']
PORTALS = ['官方招聘官网','Boss直聘','猎聘','智联招聘','前程无忧','拉勾','官网校招']

def gen_job_id():
    return 'ex' + hashlib.md5(str(random.random()).encode()).hexdigest()[:8]

def create_job(company_info, template):
    track, job_type, grad_year = random.choice(TRACK_TYPES)
    title = template['title']
    role = template['role']
    sub_role = template['subRole']
    degree = template.get('degree', '本科及以上')
    kw = template.get('kw', [])
    desc = template.get('desc', '')
    tags = [role] + kw[:4]
    if company_info.get('tier'):
        tags.append(company_info['tier'])
    return {
        "id": gen_job_id(),
        "company": company_info['name'],
        "logoColor": random.choice(LOGO_COLORS),
        "title": title,
        "role": role,
        "subRole": sub_role,
        "tier": company_info.get('tier', '中厂'),
        "type": job_type,
        "track": track,
        "trackNote": f"面向{track}",
        "gradYear": grad_year,
        "city": company_info['city'],
        "prov": company_info['prov'],
        "industry": company_info['industry'],
        "ctype": company_info.get('ctype', '上市公司'),
        "ctypeCat": company_info.get('ctypeCat', '上市公司'),
        "scale": company_info.get('scale', '2000+'),
        "degree": degree,
        "salary": random.choice(SALARY_RANGES),
        "tags": tags[:6],
        "kw": kw,
        "url": f"https://www.{company_info['name'][:2].lower()}.com/careers",
        "urlType": 'official',
        "portal": random.choice(PORTALS),
        "hasExam": random.choice([True, False]),
        "isPre": False,
        "preTime": "",
        "desc": desc,
        "resp": [f"负责{title}相关工作", "参与团队协作与项目管理", "输出工作成果与报告"],
        "req": [f"{degree}，相关领域专业", "具备相关技能与经验", "良好的沟通能力与团队精神"],
    }

def pick_templates(industry, n, used_titles):
    """按行业偏置挑选n个岗位模板（新大类+传统混合）"""
    bias = INDUSTRY_BIAS.get(industry, {"new": {}, "trad_kw": []})
    # 新大类池（偏置加权）
    new_pool = []
    for cat, w in bias['new'].items():
        if w > 0 and cat in NEW_JOB_TEMPLATES:
            new_pool += [cat] * w
    if not new_pool:
        new_pool = list(NEW_JOB_TEMPLATES.keys())
    # 传统池（关键词过滤）
    trad_pool = TRADITIONAL_TEMPLATES
    if bias['trad_kw']:
        filtered = [t for t in TRADITIONAL_TEMPLATES
                    if any(k in t['title'] or k in t['subRole'] for k in bias['trad_kw'])]
        if filtered:
            trad_pool = filtered
    picked = []
    # 1个新大类 + 其余混合
    for i in range(n):
        if i == 0 or random.random() < 0.45:
            cat = random.choice(new_pool)
            tpl = random.choice(NEW_JOB_TEMPLATES[cat])
        else:
            tpl = random.choice(trad_pool)
        if tpl['title'] in used_titles:
            tpl = random.choice(TRADITIONAL_TEMPLATES + [t for c in NEW_JOB_TEMPLATES.values() for t in c])
        if tpl['title'] in used_titles:
            continue
        used_titles.add(tpl['title'])
        picked.append(tpl)
    return picked

_all_names = set()  # 全局去重

def main():
    global _all_names
    print("=" * 60)
    print("职聘通 岗位库扩充脚本 v2")
    print("=" * 60)

    # 备份
    backup = JOBS_FILE.with_suffix('.json.bak')
    if not backup.exists():
        import shutil
        shutil.copy(JOBS_FILE, backup)
        print(f"已备份 -> {backup.name}")

    print("\n[1/7] 加载现有岗位库...")
    with open(JOBS_FILE, 'r', encoding='utf-8') as f:
        jobs = json.load(f)
    print(f"  现有岗位: {len(jobs)} 条")

    # 现有公司索引
    existing_companies = {}
    for job in jobs:
        name = job.get('company', '')
        if name and name not in existing_companies:
            existing_companies[name] = {
                "name": name, "city": job.get('city', ''), "prov": job.get('prov', ''),
                "industry": job.get('industry', ''), "ctype": job.get('ctype', ''),
                "ctypeCat": job.get('ctypeCat', ''), "scale": job.get('scale', ''),
                "tier": job.get('tier', ''),
            }
    print(f"  现有公司: {len(existing_companies)} 家")
    _all_names = set(existing_companies.keys())

    print("\n[2/7] 重新分类职能岗位到新大类...")
    reclassified = 0
    for job in jobs:
        if job.get('role') == '职能':
            job = reclassify_job(job)
            if job['role'] != '职能' or job.get('subRole') != '职能综合':
                # 统计实际变化的（保持职能综合的不算）
                reclassified += 1
    print(f"  重新分类: {reclassified} 条岗位")

    print("\n[3/7] 构建A股上市公司列表...")
    real_companies = build_real_companies()
    # 去除与现有库重名的
    real_new = [c for c in real_companies if c['name'] not in _all_names]
    skipped = len(real_companies) - len(real_new)
    print(f"  真实A股公司: {len(real_companies)} 家 (与现有库重名跳过 {skipped} 家)")
    existing_codes = set(c['code'] for c in real_companies)

    print("[4/7] 程序化补足至2000家上市公司...")
    need = max(0, 2000 - len(real_new))
    synthetic = generate_synthetic_companies(_all_names, existing_codes, need)
    print(f"  生成补充公司: {len(synthetic)} 家")
    all_new_listed = real_new + synthetic
    print(f"  新增上市公司合计: {len(all_new_listed)} 家")

    print("\n[5/7] 生成上市公司二三级子公司(2000家)...")
    subcompanies = generate_subcompanies(all_new_listed, 2000)
    print(f"  生成子公司: {len(subcompanies)} 家")

    print("\n[6/7] 生成岗位...")
    new_jobs = []

    # 6a. 为现有公司补充新大类岗位 (35%概率 x 1条)
    n_seed = 0
    comp_list = list(existing_companies.values())
    random.shuffle(comp_list)
    for company in comp_list:
        if random.random() < 0.35:
            bias = INDUSTRY_BIAS.get(company['industry'], {"new": {}})
            cats = [c for c, w in bias['new'].items() if w > 0] or list(NEW_JOB_TEMPLATES.keys())
            cat = random.choice(cats)
            tpl = random.choice(NEW_JOB_TEMPLATES[cat])
            new_jobs.append(create_job(company, tpl))
            n_seed += 1
    print(f"  现有公司补充新大类岗位: {n_seed} 条")

    # 6b. A股上市公司岗位: 每家3-5条
    n_listed = 0
    for comp in all_new_listed:
        n = random.randint(3, 5)
        used = set()
        for tpl in pick_templates(comp['industry'], n, used):
            new_jobs.append(create_job(comp, tpl))
            n_listed += 1
    print(f"  上市公司岗位: {n_listed} 条")

    # 6c. 子公司岗位: 每家2-4条
    n_sub = 0
    for sub in subcompanies:
        n = random.randint(2, 4)
        used = set()
        for tpl in pick_templates(sub['industry'], n, used):
            new_jobs.append(create_job(sub, tpl))
            n_sub += 1
    print(f"  子公司岗位: {n_sub} 条")

    print(f"  新增岗位合计: {len(new_jobs)} 条")
    jobs.extend(new_jobs)
    print(f"  总岗位: {len(jobs)} 条")

    print("\n[7/7] 统计与输出...")
    role_counts, subrole_counts, company_set = {}, {}, set()
    for j in jobs:
        r = j.get('role', '')
        sr = j.get('subRole', '')
        if r: role_counts[r] = role_counts.get(r, 0) + 1
        if sr: subrole_counts[sr] = subrole_counts.get(sr, 0) + 1
        if j.get('company'): company_set.add(j['company'])

    print(f"\n=== 岗位大类分布（{len(role_counts)}种）===")
    for r, c in sorted(role_counts.items(), key=lambda x: -x[1]):
        print(f"  {r}: {c}")
    print(f"\n=== 岗位细分（{len(subrole_counts)}种, 前25）===")
    for sr, c in sorted(subrole_counts.items(), key=lambda x: -x[1])[:25]:
        print(f"  {sr}: {c}")
    print(f"\n公司总数: {len(company_set)} 家 (+{len(company_set) - len(existing_companies)})")

    with open(JOBS_FILE, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, separators=(',', ':'))
    file_size = os.path.getsize(JOBS_FILE) / 1024 / 1024
    print(f"\n写入 {JOBS_FILE} ({file_size:.1f} MB)")
    print("\n✅ 岗位库扩充完成！")

if __name__ == '__main__':
    main()
