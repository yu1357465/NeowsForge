import os
import re
import math

# ================= 配置区 =================
CARDS_DIR = r"D:\MyFiles_UK_updated\Tools_Software\MyProjects\NeowsForge\sts2\MegaCrit.Sts2.Core.Models.Cards"
OUTPUT_DIR = "AI_Context_Packs" # 打包后的存放处
TARGET_BATCH_SIZE = 10 # 期望的单包最大容量 (算法会根据此数值进行均分)

# 你的 scanner 识别出的特征字典 (与雷达保持一致)
FEATURE_PATTERNS = {
    "Deck_Manipulation": re.compile(r'(DrawPile|DiscardPile|ExhaustPile|Hand)'),
    "X_Cost_Loops": re.compile(r'\b(for|foreach)\s*\('),
    "Conditions": re.compile(r'\bif\s*\('),
    "Card_Generation": re.compile(r'CardsVar'),
    "Custom_Var": re.compile(r'DynamicVar\(\s*"[^"]+"\s*,'),
    "Turn_Combat_State": re.compile(r'CombatState')
}

def bundle_logic():
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)

    files = [f for f in os.listdir(CARDS_DIR) if f.endswith('.cs')]

    # 动态生成分类组
    groups = {feat: [] for feat in FEATURE_PATTERNS.keys()}
    groups["Others"] = []

    # 1. 自动预分类
    for f in files:
        path = os.path.join(CARDS_DIR, f)
        with open(path, 'r', encoding='utf-8', errors='ignore') as src:
            content = src.read()
            matched = False
            for feat, pat in FEATURE_PATTERNS.items():
                if pat.search(content):
                    groups[feat].append((f, content))
                    matched = True
                    break # 命中一个主要特征即归类，避免在多个包里重复生成
            if not matched:
                groups["Others"].append((f, content))

    # 2. 🎯 负载均衡分包算法
    for feat, card_list in groups.items():
        total_cards = len(card_list)
        if total_cards == 0:
            continue

        # 计算总包数，例如 84 / 10 = 8.4 -> 9 个包
        num_batches = math.ceil(total_cards / TARGET_BATCH_SIZE)

        # 计算基础数量和余数，例如 84 // 9 = 9（基础9张），84 % 9 = 3（前3个包多1张）
        base_size = total_cards // num_batches
        remainder = total_cards % num_batches

        current_index = 0
        for i in range(num_batches):
            # 将余数均摊给前面的包
            current_batch_size = base_size + 1 if i < remainder else base_size

            batch = card_list[current_index : current_index + current_batch_size]
            current_index += current_batch_size

            pack_name = f"{feat}_Batch_{i + 1}_of_{num_batches}.txt"
            pack_path = os.path.join(OUTPUT_DIR, pack_name)

            with open(pack_path, 'w', encoding='utf-8') as pack:
                pack.write(f"// 🎯 机制分类：【{feat}】\n")
                pack.write(f"// 📦 进度批次：第 {i + 1} 组 (共 {num_batches} 组)\n")
                pack.write(f"// 🗃️ 包含卡牌：{len(batch)} 张\n")
                pack.write("// 👨‍💻 任务指令：请分析以下卡牌的 C# 逻辑并输出对应的 JS 特征检测代码\n\n")

                for name, code in batch:
                    pack.write(f"// " + "="*40 + "\n")
                    pack.write(f"// 文件名: {name}\n")
                    pack.write(f"// " + "="*40 + "\n")
                    # 浓缩代码：只保留关键的变量定义和 Play/Upgrade 函数
                    play_block = re.search(r'CanonicalVars.*?OnPlay.*?\}', code, re.DOTALL)
                    if play_block:
                        pack.write(play_block.group(0) + "\n\n")
                    else:
                        # 兜底：如果没有找到标准块，就截取类名后面的前1200个字符
                        class_start = code.find("public sealed class")
                        if class_start != -1:
                            pack.write(code[class_start:class_start+1200] + "\n...(内容已截断)\n\n")
                        else:
                            pack.write(code[:1200] + "\n...(内容已截断)\n\n")

    print(f"✅ 负载均衡打包完成！所有代码包已生成至：{OUTPUT_DIR} 文件夹。")
    print("💡 文件名已标注批次 (例如：Deck_Manipulation_Batch_1_of_9.txt)，您可以开始按顺序分配任务了。")

if __name__ == "__main__":
    bundle_logic()