import os
import re
import json

# ================= 路径配置区 =================
# 【核心】请确保这两个路径指向你电脑上真实解包的 C# 文件夹
CARDS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.Cards"
POOLS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.CardPools"
OUTPUT_FILE = "STS2_Card_Database.json"
# ===============================================

def build_class_dictionary():
    """
    第一步：扫描 CardPools，建立【卡牌名 -> 职业】的字典库
    """
    class_dict = {}

    if not os.path.exists(POOLS_DIR):
        print(f"【警告】找不到卡池文件夹：{POOLS_DIR}。将跳过职业分类。")
        return class_dict

    # 匹配 ModelDb.Card<CardName>() 语法的正则
    card_in_pool_pattern = re.compile(r'ModelDb\.Card<([a-zA-Z0-9_]+)>')

    for filename in os.listdir(POOLS_DIR):
        if not filename.endswith("CardPool.cs"):
            continue

        # 从文件名提取职业名字 (如 IroncladCardPool.cs -> Ironclad)
        class_name = filename.replace("CardPool.cs", "")
        filepath = os.path.join(POOLS_DIR, filename)

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            matches = card_in_pool_pattern.finditer(content)
            for match in matches:
                card_id = match.group(1)
                class_dict[card_id] = class_name

    print(f"✅ 成功建立职业名录，共收录 {len(class_dict)} 张正规卡池注册牌。")
    return class_dict

def extract_cards_with_classes(class_dict):
    """
    第二步：扫描 Cards 文件夹提取详细属性，并贴上职业标签
    """
    card_database = {}

    base_pattern = re.compile(r'base\(\s*([^\,]+)\s*,\s*CardType\.([a-zA-Z0-9_]+)\s*,\s*CardRarity\.([a-zA-Z0-9_]+)')
    # 新刀片：专门捕捉 new DamageVar(6m) 或 new CalculatedDamageVar(8m) 里面的数字
    damage_pattern = re.compile(r'DamageVar[^\(]*\(\s*(\d+)')
    # 新刀片：专门捕捉 new BlockVar(5m) 里面的数字
    block_pattern = re.compile(r'BlockVar[^\(]*\(\s*(\d+)')
    keyword_pattern = re.compile(r'CardKeyword\.([a-zA-Z0-9_]+)')

    # ================= 替换为二代专属：动态变量升级提取刀片 =================
    # 专门捕捉 Damage.UpgradeValueBy(3m) 或 Damage.UpgradeValueBy(-1m)
    upg_dmg_pattern = re.compile(r'Damage\.UpgradeValueBy\(\s*(-?\d+)')

    # 专门捕捉 Block.UpgradeValueBy(2m)
    upg_blk_pattern = re.compile(r'Block\.UpgradeValueBy\(\s*(-?\d+)')

    # 费用的升级通常是直接变成某个固定值 (如 UpgradeCostTo(0))，或者 Cost.UpgradeValueTo(0)
    # 这里加一个兼容性刀片，两种写法都能抓
    upg_cost_pattern = re.compile(r'(?:UpgradeCostTo|UpgradeBaseCost|Cost\.UpgradeValueTo)\(\s*(-?\d+)')
    # ======================================================================

    if not os.path.exists(CARDS_DIR):
        print(f"【严重错误】：找不到卡牌源码文件夹，请检查：\n{CARDS_DIR}")
        return

    files = [f for f in os.listdir(CARDS_DIR) if f.endswith('.cs')]
    print(f"🔄 正在流水线扫描 {len(files)} 份卡牌图纸...")

    valid_count = 0
    token_count = 0

    for filename in files:
        card_name = filename[:-3]
        filepath = os.path.join(CARDS_DIR, filename)

        # 核心过滤：白名单检测。如果这张卡不在任何正规卡池里（不在花名册上），直接当衍生牌/废案扔掉！
        if card_name not in class_dict:
            token_count += 1
            continue

        # 如果在白名单内，获取它所属的职业
        card_class = class_dict[card_name]

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()

            base_match = base_pattern.search(content)
            if base_match:
                raw_cost = base_match.group(1).strip()
                card_type = base_match.group(2)
                rarity = base_match.group(3)

                try:
                    cost = int(raw_cost)
                except ValueError:
                    cost = raw_cost

                card_data = {
                    "Cost": cost,
                    "Type": card_type,
                    "Rarity": rarity,
                    "Class": card_class,
                    "IsFinesse": False, # 强制初始化，拒绝幽灵！
                    "IsExhaust": False,
                    "IsEthereal": False,
                    "Keywords": []
                }

                damage_match = damage_pattern.search(content)
                if damage_match:
                    card_data["BaseDamage"] = int(damage_match.group(1))

                block_match = block_pattern.search(content)
                if block_match:
                    card_data["BaseBlock"] = int(block_match.group(1))

                keywords = keyword_pattern.findall(content)
                if keywords:
                    # 把所有提取到的英文关键字存成一个列表，方便以后扩展
                    card_data["Keywords"] = keywords

                    # 精准打击：只要列表里有 Sly，这张牌就是奇巧火花塞！
                    if "Sly" in keywords:
                        card_data["IsFinesse"] = True
                    # 顺手把消耗和虚无也从底层抓出来，防止翻译文案作妖
                    if "Exhaust" in keywords:
                        card_data["IsExhaust"] = True
                    if "Ethereal" in keywords:
                        card_data["IsEthereal"] = True

                # 提取篝火强化属性
                upg_dmg_match = upg_dmg_pattern.search(content)
                if upg_dmg_match: card_data["UpgradeDamageBy"] = int(upg_dmg_match.group(1))

                upg_blk_match = upg_blk_pattern.search(content)
                if upg_blk_match: card_data["UpgradeBlockBy"] = int(upg_blk_match.group(1))

                upg_cost_match = upg_cost_pattern.search(content)
                if upg_cost_match: card_data["UpgradeCostTo"] = int(upg_cost_match.group(1))
                # ==========================================================

                card_database[card_name] = card_data
                valid_count += 1

    print(f"🎯 提取流水线完工！")
    print(f"   - 完美解析有效卡牌：{valid_count} 张")
    print(f"   - 拦截并丢弃测试/衍生牌：{token_count} 张")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(card_database, f, indent=4, ensure_ascii=False)

    print(f"所有底层图纸已封存至：{OUTPUT_FILE}")

if __name__ == "__main__":
    # 执行流水线
    dictionary = build_class_dictionary()
    extract_cards_with_classes(dictionary)