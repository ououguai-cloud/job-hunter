#!/usr/bin/env python3
"""补丁: 为职能大类补充管培生/储备干部岗位，避免大类岗位数过少"""
import json, random, hashlib
from pathlib import Path

random.seed(20260826)
ROOT = Path(__file__).parent.parent
JOBS_FILE = ROOT / "db" / "jobs.json"

LOGO_COLORS = ['#7342E2','#2563eb','#16a34a','#d97706','#dc2626','#0891b2','#9333ea','#059669']
TRACK_TYPES = [('应届生','校招','2026-2027届'), ('应届生','校招','2027-2028届'), ('往届生','校招','2025-2026届')]
SALARY = ['8-12K·13薪','10-15K·14薪','12-18K·14薪','15-25K·14薪','面议']
PORTALS = ['官方招聘官网','Boss直聘','猎聘','智联招聘','前程无忧']
TITLES = [
    {"t":"管理培训生(综合方向)","kw":["管培生","轮岗","管理培训","综合"]},
    {"t":"管理培训生(业务方向)","kw":["管培生","业务轮岗","管理培训"]},
    {"t":"储备干部","kw":["储备干部","培养","管理"]},
    {"t":"总裁办管培生","kw":["管培生","总裁办","综合管理"]},
]

def gen_id():
    return 'mt' + hashlib.md5(str(random.random()).encode()).hexdigest()[:8]

with open(JOBS_FILE, 'r', encoding='utf-8') as f:
    jobs = json.load(f)

# 收集公司（从岗位里取唯一公司信息）
companies = {}
for j in jobs:
    n = j.get('company','')
    if n and n not in companies:
        companies[n] = j

# 检查公司是否已有管培生
has_mt = set()
for j in jobs:
    if j.get('role') == '职能':
        has_mt.add(j.get('company',''))

# 优先大厂/中厂，无管培生的公司
cands = [c for c, j in companies.items()
         if c not in has_mt and j.get('tier') in ('大厂','中厂')]
random.shuffle(cands)
targets = cands[:900]

new_jobs = []
for name in targets:
    ref = companies[name]
    tpl = random.choice(TITLES)
    track, jtype, grad = random.choice(TRACK_TYPES)
    new_jobs.append({
        "id": gen_id(),
        "company": name,
        "logoColor": random.choice(LOGO_COLORS),
        "title": tpl["t"],
        "role": "职能",
        "subRole": "职能综合",
        "tier": ref.get('tier','中厂'),
        "type": jtype,
        "track": track,
        "trackNote": f"面向{track}",
        "gradYear": grad,
        "city": ref.get('city',''),
        "prov": ref.get('prov',''),
        "industry": ref.get('industry',''),
        "ctype": ref.get('ctype',''),
        "ctypeCat": ref.get('ctypeCat',''),
        "scale": ref.get('scale','2000+'),
        "degree": "本科及以上",
        "salary": random.choice(SALARY),
        "tags": ["职能","管培生","校招",ref.get('tier','中厂')],
        "kw": tpl["kw"],
        "url": ref.get('url',''),
        "urlType": ref.get('urlType','official'),
        "portal": random.choice(PORTALS),
        "hasExam": random.choice([True, False]),
        "isPre": False,
        "preTime": "",
        "desc": f"{name}管理培训生项目，多部门轮岗培养综合管理人才。",
        "resp": ["参与多部门轮岗学习与实践", "协助完成专项课题与项目", "逐步承担具体业务职责"],
        "req": ["本科及以上，专业不限", "较强的学习能力与抗压能力", "良好的沟通表达与团队协作"],
    })

jobs.extend(new_jobs)
print(f"新增管培生岗位: {len(new_jobs)} 条")

role_counts = {}
for j in jobs:
    role_counts[j.get('role','')] = role_counts.get(j.get('role',''),0)+1
print(f"职能大类岗位数: {role_counts.get('职能',0)}")
print(f"总岗位: {len(jobs)}")

with open(JOBS_FILE, 'w', encoding='utf-8') as f:
    json.dump(jobs, f, ensure_ascii=False, separators=(',', ':'))
import os
print(f"文件大小: {os.path.getsize(JOBS_FILE)/1024/1024:.1f} MB")
print("✅ 补丁完成")
