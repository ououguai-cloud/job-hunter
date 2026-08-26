# -*- coding: utf-8 -*-
"""
细分唯一性修复：确保每个细分(subRole)唯一归属一个大类(role)
修复原则：
  - 模式A 细分重命名：岗位标题本质属于当前大类，只是subRole命名与其他大类撞车 → 改subRole
  - 模式B 移动大类：岗位标题本质属于其他大类 → 改role（保留subRole）
"""
import json, os, shutil

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = os.path.join(BASE, 'db', 'jobs.json')

# (旧role, 旧subRole, 新role, 新subRole, 说明)
FIXES = [
    ('技术', '产品经理', '技术', '研发/其他',      '产品研发工程师属研发岗，细分改为研发/其他'),
    ('市场', '大客户/KA', '销售', '大客户/KA',     '对公/零售客户经理本质是销售岗，移动到销售'),
    ('市场', '销售代表', '销售', '销售代表',        '版权商务属销售岗，移动到销售'),
    ('运营', '网络/通信', '运营', '运营综合',       '充电网络运营属运营岗，细分改为运营综合'),
    ('市场', '解决方案销售', '销售', '解决方案销售', '政企解决方案经理属销售岗，移动到销售'),
    ('市场', '网络安全', '客户服务', '客户服务',    '乘务员/安全员属服务岗，移动到客户服务'),
    ('运营', '数字营销', '运营', '运营综合',        '数字化运营属运营岗，细分改为运营综合'),
    ('供应链', '海外市场', '供应链', '物流/仓储',   '国际物流专员属物流岗，细分改为物流/仓储'),
    ('运营', '电气/自动化', '运营', '运营综合',     '电力交易运营属运营岗，细分改为运营综合'),
    ('运营', '物流/仓储', '运营', '运营综合',       '物流运营管培生属运营岗，细分改为运营综合'),
    ('销售', '医药研发', '销售', '医药代表',        '医药代表是医药销售，细分改为医药代表(新)'),
    ('技术', '医药研发', '医疗/健康', '医药研发',   '临床监查员/药物研发属医药岗，移动到医疗/健康'),
    ('产品', '游戏美术', '产品', '游戏策划',        '游戏策划与游戏美术分离，细分改为游戏策划(新)'),
]

def main():
    with open(DB, 'r', encoding='utf-8') as f:
        jobs = json.load(f)
    print(f'修复前岗位总数: {len(jobs)}')

    # 备份
    shutil.copy(DB, DB + '.bak2')

    moved, renamed = 0, 0
    for old_role, old_sub, new_role, new_sub, note in FIXES:
        cnt = 0
        for j in jobs:
            if j.get('role') == old_role and j.get('subRole') == old_sub:
                j['role'] = new_role
                j['subRole'] = new_sub
                cnt += 1
                if old_role != new_role:
                    moved += 1
                else:
                    renamed += 1
        kind = '移大类' if old_role != new_role else '改细分'
        print(f'  [{kind}] {old_role}/{old_sub} → {new_role}/{new_sub} ({cnt}条) — {note}')

    # 校验：每个细分唯一归属一个大类
    sub_roles = {}
    for j in jobs:
        if j.get('subRole'):
            sub_roles.setdefault(j['subRole'], set()).add(j.get('role'))
    dups = {s: rs for s, rs in sub_roles.items() if len(rs) > 1}
    if dups:
        print('!! 仍有跨大类重复:', dups)
        return
    print(f'\n校验通过：{len(sub_roles)}个细分全部唯一归属，无跨大类重复')

    # 统计各大类分布
    role_cnt = {}
    for j in jobs:
        role_cnt[j.get('role')] = role_cnt.get(j.get('role'), 0) + 1
    print('\n修复后大类分布:')
    for r, c in sorted(role_cnt.items(), key=lambda x: -x[1]):
        subs = sorted({j['subRole'] for j in jobs if j.get('role') == r and j.get('subRole')})
        print(f'  {r}: {c}条 ({len(subs)}细分) — {"/".join(subs)}')

    with open(DB, 'w', encoding='utf-8') as f:
        json.dump(jobs, f, ensure_ascii=False, separators=(',', ':'))
    size_mb = os.path.getsize(DB) / 1024 / 1024
    print(f'\n已写回 {DB} ({size_mb:.1f} MB)')
    print(f'共修复: 移动大类{moved}条 + 重命名细分{renamed}条')

if __name__ == '__main__':
    main()
