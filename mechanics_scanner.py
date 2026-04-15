import os
import re

# ================= 路径配置区 =================
CARDS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.Cards"
# 🎯 新增：让雷达去监视你的 JS 核心引擎文件
APP_JS_PATH = "app.js"
# ===============================================

def get_completed_from_js():
    """
    核心黑科技：跨界源码扫描
    直接读取 app.js，将整个文件转为小写。
    后续只要卡牌的英文名（如 bladedance）出现在 app.js 里（哪怕只是注释），就自动视为已竣工！
    """
    if os.path.exists(APP_JS_PATH):
        with open(APP_JS_PATH, 'r', encoding='utf-8') as f:
            return f.read().lower()
    else:
        print(f"⚠️ 警告：找不到 {APP_JS_PATH}，自动检测功能失效。")
        return ""

def scan_mechanics():
    if not os.path.exists(CARDS_DIR):
        print(f"找不到文件夹：{CARDS_DIR}")
        return

    # 预加载 app.js 的全部内容
    js_content = get_completed_from_js()

    files = [f for f in os.listdir(CARDS_DIR) if f.endswith('.cs')]

    vanilla_cards = []
    special_cards = []
    completed_special_cards = []

    feature_patterns = {
        "条件判定 (If/Else)": re.compile(r'\bif\s*\('),
        "循环与多段 (For/Foreach)": re.compile(r'\b(for|foreach)\s*\('),
        "自定义动态变量 (Custom Var)": re.compile(r'DynamicVar\(\s*"[^"]+"\s*,'),
        "牌组操作 (Deck Manipulation)": re.compile(r'(DrawPile|DiscardPile|ExhaustPile|Hand)'),
        "特殊卡牌衍生 (Card Generation)": re.compile(r'CardsVar'),
        "跨回合机制 (Turn/Combat State)": re.compile(r'CombatState')
    }

    for filename in files:
        card_name = filename[:-3]
        filepath = os.path.join(CARDS_DIR, filename)

        with open(filepath, 'r', encoding='utf-8', errors='ignore') as file:
            content = file.read()
            found_features = [name for name, pattern in feature_patterns.items() if pattern.search(content)]

            if found_features:
                card_data = {"name": card_name, "features": found_features}

                # 🎯 全自动判定核心：使用正则寻找全字匹配 (防止把 A 认成 AB)
                # 只要 JS 代码或注释里提到了这个卡牌的名字，自动标记为完成！
                if re.search(r'\b' + card_name.lower() + r'\b', js_content):
                    completed_special_cards.append(card_data)
                else:
                    special_cards.append(card_data)
            else:
                vanilla_cards.append(card_name)

    # ================= 输出分析报告 =================
    total_special = len(special_cards) + len(completed_special_cards)
    progress_pct = (len(completed_special_cards) / total_special) * 100 if total_special > 0 else 100

    bar_length = 25
    filled_len = int(bar_length * progress_pct // 100)
    bar = '█' * filled_len + '░' * (bar_length - filled_len)

    print(f"\n📊 扫描完成！")
    print(f"✅ 标准模型卡牌：{len(vanilla_cards)} 张 (已底层适配)")
    print(f"⚠️ 机制怪总数：{total_special} 张")
    print(f"🚀 攻坚自动化进度：[{bar}] {len(completed_special_cards)}/{total_special} ({progress_pct:.1f}%)\n")

    print("-" * 60)
    print("【剩余待攻坚目标列表】")
    print("-" * 60)

    # 聚类打印，方便批量复制给 AI
    for card in special_cards:
        features_str = ", ".join(card["features"])
        print(f"👉 {card['name']}.cs  --- [命中特征: {features_str}]")

if __name__ == "__main__":
    scan_mechanics()