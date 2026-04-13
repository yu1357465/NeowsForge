import json
import re
import os

# 配置文件路径
DATABASE_FILE = "STS2_Card_Database.json"  # 我们上一步生成的图纸
LOC_FILE = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\SlayTheSpire2pck\localization\zhs\cards.json"  # 你找到的字典文件
OUTPUT_FILE = "STS2_Card_Database_ZHS.json" # 最终输出的中文图纸

def camel_to_snake_upper(name):
    """
    底层逻辑变形器：将大驼峰 (AdaptiveStrike) 转换为大写蛇形 (ADAPTIVE_STRIKE)
    """
    # 在小写字母和大写字母之间插入下划线，然后全部大写
    s1 = re.sub('(.)([A-Z][a-z]+)', r'\1_\2', name)
    return re.sub('([a-z0-9])([A-Z])', r'\1_\2', s1).upper()

def merge_translation():
    print("开始缝合翻译字典...")

    # 1. 读取基础图纸
    if not os.path.exists(DATABASE_FILE):
        print(f"找不到基础图纸 {DATABASE_FILE}，请先运行上一个脚本。")
        return
    with open(DATABASE_FILE, 'r', encoding='utf-8') as f:
        card_db = json.load(f)

    # 2. 读取翻译字典
    if not os.path.exists(LOC_FILE):
        print(f"找不到字典文件 {LOC_FILE}，请检查路径。")
        return

    try:
        with open(LOC_FILE, 'r', encoding='utf-8', errors='ignore') as f:
            loc_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"字典文件 JSON 格式有误（通常是官方多写了逗号），请手动检查: {e}")
        return

    # 3. 开始对暗号缝合
    matched_count = 0
    for card_class_name, card_info in card_db.items():
        # 把 Acrobatics 变成 ACROBATICS，把 AdaptiveStrike 变成 ADAPTIVE_STRIKE
        snake_id = camel_to_snake_upper(card_class_name)

        title_key = f"{snake_id}.title"
        desc_key = f"{snake_id}.description"

        # 去字典里查
        if title_key in loc_data:
            card_info["Name_ZHS"] = loc_data[title_key]
            matched_count += 1
        else:
            # 如果没找到翻译，就拿英文名顶替一下，防止报错
            card_info["Name_ZHS"] = card_class_name

        if desc_key in loc_data:
            desc = loc_data[desc_key]
            card_info["Description"] = desc

    # 4. 输出最新的中文图纸
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(card_db, f, indent=4, ensure_ascii=False)

    print(f"缝合完毕！共成功匹配了 {matched_count} 张卡牌的中文名。")
    print(f"新图纸已保存为：{OUTPUT_FILE}")

if __name__ == "__main__":
    merge_translation()