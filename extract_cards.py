import os
import re
import json

# ================= 路径配置区 =================
CARDS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.Cards"
POOLS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.CardPools"
OUTPUT_FILE = "STS2_Card_Database.json"
# ===============================================

# 🎯 新增：超级映射字典
# 负责把 C# 里的底层类名/变量名，翻译成前端 JS 引擎能认出的 JSON 键名
POWER_MAPPING = {
    "WeakPower": "Weak", "Weak": "Weak",
    "VulnerablePower": "Vuln", "Vulnerable": "Vuln", "Vuln": "Vuln",
    "StrengthPower": "Str", "Strength": "Str", "Str": "Str",
    "DexterityPower": "Dex", "Dexterity": "Dex", "Dex": "Dex",
    "PoisonPower": "Poison", "Poison": "Poison"
}

def build_class_dictionary():
    class_dict = {}
    if not os.path.exists(POOLS_DIR):
        print(f"【警告】找不到卡池文件夹：{POOLS_DIR}。将跳过职业分类。")
        return class_dict

    card_in_pool_pattern = re.compile(r'ModelDb\.Card<([a-zA-Z0-9_]+)>')

    for filename in os.listdir(POOLS_DIR):
        if not filename.endswith("CardPool.cs"):
            continue
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
    card_database = {}

    base_pattern = re.compile(r'base\(\s*([^\,]+)\s*,\s*CardType\.([a-zA-Z0-9_]+)\s*,\s*CardRarity\.([a-zA-Z0-9_]+)')

    # 基础数值刀片
    damage_pattern = re.compile(r'DamageVar[^\(]*\(\s*(\d+)')
    block_pattern = re.compile(r'BlockVar[^\(]*\(\s*(\d+)')
    keyword_pattern = re.compile(r'CardKeyword\.([a-zA-Z0-9_]+)')

    # 升级数值刀片
    upg_dmg_pattern = re.compile(r'Damage\.UpgradeValueBy\(\s*(-?\d+)')
    upg_blk_pattern = re.compile(r'Block\.UpgradeValueBy\(\s*(-?\d+)')
    upg_cost_pattern = re.compile(r'(?:UpgradeCostTo|UpgradeBaseCost|Cost\.UpgradeValueTo)\(\s*(-?\d+)')

    # 🎯 V1.2 新增：捕捉专属的二代动态变量
    # [原代码注释] cards_var_pattern = re.compile(r'CardsVar\s*\(\s*(?:\"[a-zA-Z0-9_]+\"\s*,\s*)?(\d+)')

    # 🎯 [采购单 1]：提取 new CardsVar(数字)`
    cards_var_pattern = re.compile(r'CardsVar\s*\(\s*(?:\"[a-zA-Z0-9_]+\"\s*,\s*)?(\d+)')

    # 🎯 [采购单 2]：提取 new EnergyVar(数字)
    energy_var_pattern = re.compile(r'new EnergyVar\((\d+)\)')

    str_loss_pattern = re.compile(r'DynamicVar\(\s*"StrengthLoss"\s*,\s*(\d+)m?')

    upg_cards_pattern = re.compile(r'Cards\.UpgradeValue(?:By|To)\(\s*(-?\d+)')
    upg_str_loss_pattern = re.compile(r'\["StrengthLoss"\]\.UpgradeValue(?:By|To)\(\s*(-?\d+)')

    # 🎯 新增：泛型 Power 提取刀片
    base_power_pattern = re.compile(r'PowerVar<([A-Za-z0-9_]+)>\(\s*(\d+)')
    upg_power_pattern = re.compile(r'DynamicVars\.([A-Za-z0-9_]+)\.UpgradeValue(?:By|To)\(\s*(-?\d+)')

    # 🎯 [采购单 3]：提取 PowerCmd.Apply<Power名称>
    power_cmd_pattern = re.compile(r'PowerCmd\.Apply<(\w+Power)>')

    # 兜底：保留二代可能存在的变种魔法数字
    magic_pattern = re.compile(r'MagicNumberVar[^\(]*\(\s*(\d+)')
    upg_magic_pattern = re.compile(r'MagicNumber\.UpgradeValueBy\(\s*(-?\d+)')

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

        if card_name not in class_dict:
            token_count += 1
            continue

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
                    "IsFinesse": False,
                    "IsExhaust": False,
                    "IsEthereal": False,
                    "Keywords": []
                }

                # --- 基础数值 ---
                damage_match = damage_pattern.search(content)
                if damage_match: card_data["BaseDamage"] = int(damage_match.group(1))

                block_match = block_pattern.search(content)
                if block_match: card_data["BaseBlock"] = int(block_match.group(1))

                magic_match = magic_pattern.search(content)
                if magic_match: card_data["BaseMagicNumber"] = int(magic_match.group(1))

                # --- 关键字雷达 ---
                keywords = keyword_pattern.findall(content)
                if keywords:
                    card_data["Keywords"] = keywords
                    if "Sly" in keywords: card_data["IsFinesse"] = True
                    if "Exhaust" in keywords: card_data["IsExhaust"] = True
                    if "Ethereal" in keywords: card_data["IsEthereal"] = True

                # --- 基础 Buff 提取 (核心突破) ---
                for p_match in base_power_pattern.finditer(content):
                    power_name = p_match.group(1)
                    power_val = int(p_match.group(2))
                    json_key = POWER_MAPPING.get(power_name)
                    if json_key:
                        card_data[f"Base{json_key}"] = power_val

                # --- 强化升级数值 ---
                upg_dmg_match = upg_dmg_pattern.search(content)
                if upg_dmg_match: card_data["UpgradeDamageBy"] = int(upg_dmg_match.group(1))

                upg_blk_match = upg_blk_pattern.search(content)
                if upg_blk_match: card_data["UpgradeBlockBy"] = int(upg_blk_match.group(1))

                upg_cost_match = upg_cost_pattern.search(content)
                if upg_cost_match: card_data["UpgradeCostTo"] = int(upg_cost_match.group(1))

                upg_magic_match = upg_magic_pattern.search(content)
                if upg_magic_match: card_data["UpgradeMagicNumberBy"] = int(upg_magic_match.group(1))

                # --- 专属动态变量提取 ---
                # 🎯 [采购单 1]：BaseCards 写入
                cards_match = cards_var_pattern.search(content)
                if cards_match: card_data["BaseCards"] = int(cards_match.group(1))

                # 🎯 [采购单 2]：BaseEnergy 写入
                energy_match = energy_var_pattern.search(content)
                if energy_match: card_data["BaseEnergy"] = int(energy_match.group(1))

                # 🎯 [采购单 3]：PowerType 写入
                power_cmd_match = power_cmd_pattern.search(content)
                if power_cmd_match: card_data["PowerType"] = power_cmd_match.group(1)

                str_loss_match = str_loss_pattern.search(content)
                if str_loss_match: card_data["BaseStrengthLoss"] = int(str_loss_match.group(1))

                upg_cards_match = upg_cards_pattern.search(content)
                if upg_cards_match: card_data["UpgradeCardsBy"] = int(upg_cards_match.group(1))

                upg_str_loss_match = upg_str_loss_pattern.search(content)
                if upg_str_loss_match: card_data["UpgradeStrengthLossBy"] = int(upg_str_loss_match.group(1))

                # --- 强化 Buff 提取 (核心突破) ---
                for upg_p_match in upg_power_pattern.finditer(content):
                    var_name = upg_p_match.group(1)
                    upg_val = int(upg_p_match.group(2))
                    json_key = POWER_MAPPING.get(var_name)
                    if json_key:
                        card_data[f"Upgrade{json_key}By"] = upg_val

                card_database[card_name] = card_data
                valid_count += 1

    print(f"🎯 提取流水线完工！")
    print(f"   - 完美解析有效卡牌：{valid_count} 张")
    print(f"   - 拦截并丢弃测试/衍生牌：{token_count} 张")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(card_database, f, indent=4, ensure_ascii=False)

    print(f"所有底层图纸已封存至：{OUTPUT_FILE}")

if __name__ == "__main__":
    dictionary = build_class_dictionary()
    extract_cards_with_classes(dictionary)