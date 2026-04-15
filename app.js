let allCards = {};
let myDeck = [];
let myDrafts = [];

const classIcons = {
    "ironclad": "战", "silent": "猎", "defect": "机",
    "necrobinder": "灵", "regent": "君", "colorless": "无",
    "curse": "诅", "status": "状"
};

// ================= 核心配置区 =================
const starterTemplates = {
    "ironclad": ["StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "StrikeIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "DefendIronclad", "Bash"],
    "silent": ["StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "StrikeSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "DefendSilent", "Survivor", "Neutralize"],
    "defect": ["StrikeDefect", "StrikeDefect", "StrikeDefect", "StrikeDefect", "DefendDefect", "DefendDefect", "DefendDefect", "DefendDefect", "Zap", "Dualcast"],
    "necrobinder": ["StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "StrikeNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder", "DefendNecrobinder"],
    "regent": ["StrikeRegent", "StrikeRegent", "StrikeRegent", "StrikeRegent", "DefendRegent", "DefendRegent", "DefendRegent", "DefendRegent"]
};

// ================= 🎯 超级属性提取引擎 (Middleware) =================
function parseCardStats(card, isUpgraded) {
    let dmg = card.BaseDamage || card.Damage || 0;
    let blk = card.BaseBlock || card.Block || 0;
    let cost = card.Cost !== undefined ? card.Cost : (card.BaseCost || 0);
    let magic = card.BaseMagicNumber || card.MagicNumber || 0;
    let desc = card.Description || "";

    // 🎯 新增：将过牌和回费变量拉入中间件统一管理
    let cardDraw = 0;
    let energyGain = 0;

    if (isUpgraded) {
        if (card.UpgradedDamage !== undefined) dmg = card.UpgradedDamage;
        else if (card.UpgradeDamageBy !== undefined) dmg += card.UpgradeDamageBy;
        else if (card.UpgradeDamageTo !== undefined) dmg = card.UpgradeDamageTo;

        if (card.UpgradedBlock !== undefined) blk = card.UpgradedBlock;
        else if (card.UpgradeBlockBy !== undefined) blk += card.UpgradeBlockBy;
        else if (card.UpgradeBlockTo !== undefined) blk = card.UpgradeBlockTo;

        if (card.UpgradedCost !== undefined) cost = card.UpgradedCost;
        else if (card.UpgradeCostTo !== undefined) cost = card.UpgradeCostTo;

        if (card.UpgradedMagicNumber !== undefined) magic = card.UpgradedMagicNumber;
        else if (card.UpgradeMagicNumberBy !== undefined) magic += card.UpgradeMagicNumberBy;
        else if (card.UpgradeMagicNumberTo !== undefined) magic = card.UpgradeMagicNumberTo;

        if (card.UpgradedDescription) desc = card.UpgradedDescription;
        else if (card.UpgradeDescription) desc = card.UpgradeDescription;
    }

    // 暴力替换魔法数字，让文本正则重见光明
    desc = desc.replace(/!M!/g, magic).replace(/!D!/g, dmg).replace(/!B!/g, blk);

    // ================= 替换 parseCardStats 里的 Middleware 部分 =================
    // -------------------------------------------------------------
    // 🎯 V1.3 升级：泛用特征检测 (Feature Detection)
    // -------------------------------------------------------------
    let lowerDesc = desc.toLowerCase();

    // 1. 小刀机制全系兼容 (不再硬编码卡牌ID！)
    let shivs = 0;
    // 特征检测：只要这牌后端有 BaseCards 变量，且文本里提到了"小刀/shiv"，它就是个小刀制造机！
    if (card.BaseCards !== undefined && (lowerDesc.includes("小刀") || lowerDesc.includes("shiv"))) {
        shivs = card.BaseCards;
        if (isUpgraded && card.UpgradeCardsBy !== undefined) shivs += card.UpgradeCardsBy;
    } else {
        // 正则兜底：应对可能没有 BaseCards 变量的情况
        let shivMatch = desc.match(/(?:添加|将|获得|产生)\s*(\d+)\s*张小刀/);
        if (shivMatch) shivs = parseInt(shivMatch[1]);
    }
    dmg += shivs * 4; // 将小刀数量乘以单发伤害，融入总 EV

    // 2. 负面状态等效格挡 (泛用兼容)
    let strLoss = 0;
    if (card.BaseStrengthLoss !== undefined) {
        strLoss = card.BaseStrengthLoss;
        if (isUpgraded && card.UpgradeStrengthLossBy !== undefined) strLoss += card.UpgradeStrengthLossBy;
    } else {
        let strDownMatch = desc.match(/(?:失去|降低)\s*(\d+)\s*(?:点|层)?\s*力量/);
        if (strDownMatch) strLoss = parseInt(strDownMatch[1]);
    }
    blk += strLoss * 1.5; // 多段攻击折算系数

    // -------------------------------------------------------------
    // 🎯 机制已适配: Backflip, BattleTrance, BigBang, BrightestFlame, CallOfTheVoid, CaptureSpirit, Coolheaded, Demesne, DrumOfBattle, Entropy
    // -------------------------------------------------------------

    // 解析衍生/抽牌变量
    if (card.BaseCards !== undefined) {
        let cardsVal = card.BaseCards;
        if (isUpgraded && card.UpgradeCardsBy !== undefined) cardsVal += card.UpgradeCardsBy;

        if (card.Type === "Power" || card.Type === "power") {
            // 能力牌的长线抽牌暂不计入即时爆发
        } else if (card.id === "CaptureSpirit" || (card.PowerType && card.PowerType.includes("Soul"))) {
            // 洗入状态牌，不作为即时抽牌
        } else if (card.PowerType === "NoDrawPower") {
            // 战斗专注等限制器，提供巨大过牌，但封锁后续
            cardDraw += cardsVal;
        } else {
            // 常规抽牌或小刀逻辑
            if (lowerDesc.includes("小刀") || lowerDesc.includes("shiv")) {
                dmg += cardsVal * 4;
            } else {
                cardDraw += cardsVal;
            }
        }
    }

    // 解析回费逻辑 (如 BigBang 大爆炸)
    if (card.BaseEnergy !== undefined) {
        let nrg = card.BaseEnergy;
        if (isUpgraded && card.UpgradeEnergyBy !== undefined) nrg += card.UpgradeEnergyBy;
        energyGain += nrg;

        // 回费等效于降低这张牌的成本 (允许出现负费用，代表回费)
        if (typeof cost === 'number') cost -= nrg;
    }

    return { dmg, blk, cost, desc, magic, cardDraw, energyGain };
    // ========================================================================
}

// ================= 数据初始化与组件渲染 =================
async function loadCards() {
    try {
        const response = await fetch('STS2_Card_Database_ZHS.json');
        allCards = await response.json();
        renderLibrary();
        filterCards();
    } catch (error) {
        console.error("【系统拦截到的真实报错】:", error);
        document.getElementById('card-list').innerHTML = "读取图纸失败！请确保开启了本地服务器，并且 JSON 文件名正确。";
    }
}

// ================= 🎯 替换：纯净版卡牌生成器 (修复 SyntaxError) =================
function createCardButton(cardName, cardData, modeOrIsDeck = false, index = -1) {
    let mode = "library";
    if (modeOrIsDeck === true || modeOrIsDeck === "deck") mode = "deck";
    if (modeOrIsDeck === "draft") mode = "draft";

    let btn = document.createElement('div');
    let cType = cardData.Type ? cardData.Type.toLowerCase() : "unknown";
    let cClass = cardData.Class ? cardData.Class.toLowerCase() : "unknown";
    let isUpgraded = cardData.isUpgraded === true;

    let stats = parseCardStats(cardData, isUpgraded);
    let cCost = stats.cost !== "Unplayable" && stats.cost !== -1 ? stats.cost : "X";

    let cName = cardData.Name_ZHS || cardName;
    if (isUpgraded) cName += "+";

    btn.className = `card-btn ${cType} ${cClass}`;
    if (mode === "library") btn.classList.add('lib-card');

    if ((mode === "deck" || mode === "draft") && isUpgraded) {
        btn.style.boxShadow = "0 0 5px #7acc00";
        btn.style.color = "#7acc00";
        btn.style.borderColor = "#7acc00";
    }

    btn.dataset.id = cardName.toLowerCase();
    btn.dataset.name = cName.toLowerCase();
    btn.dataset.cardClass = cClass;
    btn.dataset.type = cType;
    btn.dataset.cost = cCost;

    // 唯一声明 icon 变量的地方，绝不重复！
    let icon = "?";
    if (typeof classIcons !== 'undefined' && classIcons[cClass]) {
        icon = classIcons[cClass];
    } else {
        if (cType === "attack") icon = "🗡️";
        else if (cType === "skill") icon = "🛡️";
        else if (cType === "power") icon = "✨";
    }

    // 动态生成交互提示文本
    let overlayText = "";
    if (mode === "library") {
        overlayText = `<span class="overlay-left">👆左键: 加卡组</span><span class="overlay-right">🖱️右键: 算推演</span>`;
    } else if (mode === "deck") {
        overlayText = `<span class="overlay-left">👆左键: 删卡牌</span><span class="overlay-right">🖱️右键: 升/降级</span>`;
    } else if (mode === "draft") {
        overlayText = `<span class="overlay-left">👆左键: 删推演</span><span class="overlay-right">🖱️右键: 升/降级</span>`;
    }

    // 替换为干净的代码，并赋予卡牌“可被抓取(拖拽)”的物理属性：
    btn.innerHTML = `<span class="class-icon">[${icon}]</span> ${cName} [${cCost}]`;
    btn.draggable = true;
    btn.ondragstart = (e) => {
        e.dataTransfer.setData('cardId', cardName);
        e.dataTransfer.setData('isUpgraded', isUpgraded);
    };

    if (mode === "library") {
        // 左键：加入普通版
        btn.onclick = () => {
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardName; newCard.isUpgraded = false;
            myDeck.push(newCard); updateWorkshop();
        };
        // 右键：直接加入强化版 (不再是去推演了！)
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardName; newCard.isUpgraded = true;
            myDeck.push(newCard); updateWorkshop();
        };
    } else if (mode === "deck") {
        btn.onclick = () => { myDeck.splice(index, 1); updateWorkshop(); };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            myDeck[index].isUpgraded = !myDeck[index].isUpgraded; updateWorkshop();
        };
    } else if (mode === "draft") {
        btn.onclick = () => {
            if(typeof myDrafts !== 'undefined') myDrafts.splice(index, 1);
            updateDrafts();
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if(typeof myDrafts !== 'undefined') myDrafts[index].isUpgraded = !myDrafts[index].isUpgraded;
            updateDrafts();
        };
    }
    return btn;
}
// ==============================================================================

function renderLibrary() {
    const listDiv = document.getElementById('card-list');
    listDiv.innerHTML = '';
    for (let cardName in allCards) {
        listDiv.appendChild(createCardButton(cardName, allCards[cardName]));
    }
}

function filterCards() {
    let searchText = document.getElementById('search-input').value.toLowerCase();
    let classFilter = document.getElementById('filter-class').value;
    let typeFilter = document.getElementById('filter-type').value;
    let costFilter = document.getElementById('filter-cost').value;

    let cards = document.querySelectorAll('.lib-card');
    let visibleCount = 0;

    cards.forEach(card => {
        let matchName = card.dataset.name.includes(searchText) || card.dataset.id.includes(searchText);
        let matchClass = (classFilter === 'all') || (card.dataset.cardClass === classFilter);
        let matchType = (typeFilter === 'all') || (card.dataset.type === typeFilter);
        let matchCost = (costFilter === 'all') || (card.dataset.cost == costFilter);

        if (matchName && matchClass && matchType && matchCost) {
            card.style.display = 'inline-block';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    document.getElementById('card-count').innerText = visibleCount;
}

function clearDeck() {
    if (myDeck.length > 0 && confirm("确定要清空当前的全部卡牌吗？")) {
        myDeck = [];
        updateWorkshop();
    }
}

function loadStarterDeck() {
    if (myDeck.length > 0 && !confirm("一键载入将覆盖并清空你目前组建的卡组，确定继续吗？")) {
        return;
    }
    const selectedClass = document.getElementById('starter-class').value;
    const template = starterTemplates[selectedClass] || [];
    myDeck = [];

    let missingCards = [];
    template.forEach(targetId => {
        let normalizedTarget = targetId.toLowerCase().replace(/[^a-z0-9]/g, '');
        let realKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedTarget);
        if (realKey) myDeck.push({ id: realKey, ...allCards[realKey] });
        else missingCards.push(targetId);
    });

    let baneKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === "ascendersbane");
    if (baneKey) myDeck.push({ id: baneKey, ...allCards[baneKey] });

    updateWorkshop();
}

// ================= 主卡组与仪表盘引擎 =================
function updateWorkshop() {
    const deckDiv = document.getElementById('my-deck');
    document.getElementById('deck-count').innerText = myDeck.length;

    const baseEnergy = parseFloat(document.getElementById('base-energy').value) || 3;
    const baseDraw = parseFloat(document.getElementById('base-draw').value) || 5;

    let totalDeckEnergy = 0; let totalDeckDamage = 0; let totalDeckBlock = 0;
    let drawCardCount = 0; let exhaustCardCount = 0; let poisonCount = 0;
    let discardEnablerCount = 0; let finesseCount = 0;

    let totalStr = 0; let totalDex = 0;
    let totalVulnStacks = 0; let totalWeakStacks = 0;
    let attackCardCount = 0; let blockCardCount = 0;

    deckDiv.innerHTML = '';

    if (myDeck.length === 0) {
        deckDiv.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 20px;">👈 点击左侧卡牌加入卡组<br><br>💡 加入后：<b>左键</b>移除，<b>右键</b>强化/降级</p>';
        updateDashboard(0, 0, 0, baseEnergy, baseDraw, 0, 0, 0, 0, 0, 0, 0);
        return;
    }

    myDeck.sort((a, b) => {
        let cA = parseCardStats(a, a.isUpgraded).cost;
        let cB = parseCardStats(b, b.isUpgraded).cost;
        if (cA !== cB) return cA - cB;
        return (a.Name_ZHS || a.id).localeCompare(b.Name_ZHS || b.id);
    });

    myDeck.forEach((card, index) => {
        deckDiv.appendChild(createCardButton(card.id, card, true, index));

        let stats = parseCardStats(card, card.isUpgraded);

        if (card.Type === "Attack" || card.Type === "attack") attackCardCount += 1;
        if (typeof stats.cost === 'number') totalDeckEnergy += stats.cost;

        totalDeckDamage += stats.dmg;
        totalDeckBlock += stats.blk;
        if (stats.blk > 0) blockCardCount += 1;

        let lowerDesc = stats.desc.toLowerCase();

        if (card.IsDraw || lowerDesc.includes("抽") || lowerDesc.includes("draw")) drawCardCount += 1;
        if (card.IsExhaust || card.IsEthereal || lowerDesc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCardCount += 1;
        if (card.IsPoison || lowerDesc.includes("中毒") || lowerDesc.includes("poison")) poisonCount += card.isUpgraded ? 1.5 : 1;

        if (card.IsDiscardEnabler || (lowerDesc.includes("丢弃") && !lowerDesc.includes("被丢弃"))) discardEnablerCount += 1;
        let isFakeFinesse = lowerDesc.includes("添加") && lowerDesc.includes("奇巧");
        if ((card.IsFinesse === true || lowerDesc.includes("奇巧") || lowerDesc.includes("sly")) && !isFakeFinesse) finesseCount += 1;

        // 🎯 Buff/Debuff 雷达提取及强化补偿
        let baseStr = 0;
        let strMatch = stats.desc.match(/(?:获得|增加|给予)\s*(\d+)\s*(?:点|层)?\s*力量/);
        if (strMatch) baseStr = parseInt(strMatch[1]);
        if (card.isUpgraded) {
            if (card.UpgradeStrBy) baseStr += card.UpgradeStrBy;
            else if (card.UpgradeStrengthBy) baseStr += card.UpgradeStrengthBy;
        }
        totalStr += baseStr;

        let baseDex = 0;
        let dexMatch = stats.desc.match(/(?:获得|增加|给予)\s*(\d+)\s*(?:点|层)?\s*敏捷/);
        if (dexMatch) baseDex = parseInt(dexMatch[1]);
        if (card.isUpgraded) {
            if (card.UpgradeDexBy) baseDex += card.UpgradeDexBy;
            else if (card.UpgradeDexterityBy) baseDex += card.UpgradeDexterityBy;
        }
        totalDex += baseDex;

        let baseVuln = 0;
        let vulnMatch = stats.desc.match(/(?:给予|施加|获得|造成)\s*(\d+)\s*(?:层)?\s*易伤/);
        if (vulnMatch) baseVuln = parseInt(vulnMatch[1]);
        else if (lowerDesc.includes("易伤") || lowerDesc.includes("vulnerable")) baseVuln = 1;
        if (card.isUpgraded) {
            if (card.UpgradeVulnBy) baseVuln += card.UpgradeVulnBy;
            else if (card.UpgradeVulnerableBy) baseVuln += card.UpgradeVulnerableBy;
        }
        totalVulnStacks += baseVuln;

        let baseWeak = 0;
        let weakMatch = stats.desc.match(/(?:给予|施加|获得|造成)\s*(\d+)\s*(?:层)?\s*虚弱/);
        if (weakMatch) baseWeak = parseInt(weakMatch[1]);
        else if (lowerDesc.includes("虚弱") || lowerDesc.includes("weak")) baseWeak = 1;
        if (card.isUpgraded) {
            if (card.UpgradeWeakBy) baseWeak += card.UpgradeWeakBy;
            else if (card.id.toLowerCase().includes("neutralize")) baseWeak += 1; // 《中和》临时硬编码修补
        }
        totalWeakStacks += baseWeak;
    });

    let deckSize = myDeck.length;
    let actualDraw = Math.min(baseDraw, deckSize);

    let baseEnergyEV = deckSize > 0 ? (totalDeckEnergy / deckSize) * actualDraw : 0;
    let baseDamageEV = deckSize > 0 ? (totalDeckDamage / deckSize) * actualDraw : 0;
    let baseBlockEV  = deckSize > 0 ? (totalDeckBlock / deckSize) * actualDraw : 0;

    let avgStrTurn = deckSize > 0 ? (totalStr / deckSize) * actualDraw : 0;
    let avgDexTurn = deckSize > 0 ? (totalDex / deckSize) * actualDraw : 0;

    let expAttacksTurn = deckSize > 0 ? (attackCardCount / deckSize) * actualDraw : 0;
    let expBlocksTurn  = deckSize > 0 ? (blockCardCount / deckSize) * actualDraw : 0;

    let rawDamageEV = baseDamageEV + (avgStrTurn * expAttacksTurn);
    let rawBlockEV  = baseBlockEV + (avgDexTurn * expBlocksTurn);

    let vulnUptime = deckSize > 0 ? Math.min(1, (totalVulnStacks / deckSize) * actualDraw) : 0;
    let weakUptime = deckSize > 0 ? Math.min(1, (totalWeakStacks / deckSize) * actualDraw) : 0;

    let finalDamageEV = rawDamageEV * (1 + (0.5 * vulnUptime));
    let finalBlockEV  = rawBlockEV;

    updateDashboard(
        baseEnergyEV, finalDamageEV, finalBlockEV, baseEnergy, actualDraw,
        drawCardCount, exhaustCardCount, deckSize,
        poisonCount, discardEnablerCount, finesseCount, weakUptime
    );

    updateDrafts();
}

function updateDashboard(expEnergy, expDamage, expBlock, maxEnergy, actualDraw,
                         drawCount, exhaustCount, deckSize,
                         poisonCount, discardEnablerCount, finesseCount, weakUptime) {

    expEnergy = parseFloat(expEnergy).toFixed(1);
    expDamage = parseFloat(expDamage);
    expBlock = parseFloat(expBlock).toFixed(1);

    let energyFill = document.getElementById('energy-fill');
    let energyDesc = document.getElementById('energy-desc');
    let energyPercent = Math.min((expEnergy / maxEnergy) * 100, 100);

    energyFill.style.width = energyPercent + '%';
    document.getElementById('energy-text').innerText = `${expEnergy} / ${maxEnergy} 费`;

    if (expEnergy > maxEnergy) {
        energyFill.style.backgroundColor = '#e74c3c';
        energyDesc.innerText = "🚨 严重卡手：能量超载。";
        energyDesc.style.color = '#c0392b';
    } else if (expEnergy > maxEnergy * 0.8) {
        energyFill.style.backgroundColor = '#f39c12';
        energyDesc.innerText = "⚠️ 负载较高：能量刚好够用。";
        energyDesc.style.color = '#d35400';
    } else {
        energyFill.style.backgroundColor = '#16a085';
        energyDesc.innerText = "✅ 运转流畅：适合加高费牌。";
        energyDesc.style.color = '#666666';
    }

    const floorInput = document.getElementById('current-floor');
    if (floorInput) {
        if (Number(floorInput.value) > 48) floorInput.value = 48;
        if (Number(floorInput.value) < 0) floorInput.value = 0;
    }
    let currentFloor = floorInput ? Number(floorInput.value) : 0;

    const bossSelect = document.getElementById('target-enemy');
    const selectedOption = bossSelect.options[bossSelect.selectedIndex];

    let damageTarget = parseFloat(selectedOption.dataset.dmg) || 30;
    let baseBlockTarget = parseFloat(selectedOption.dataset.blk) || 20;
    let act = parseInt(selectedOption.dataset.act) || 1;

    weakUptime = weakUptime || 0;
    let mitigatedBlock = baseBlockTarget * (0.25 * weakUptime);
    let blockTarget = baseBlockTarget - mitigatedBlock;

    let targetFloor = 17;
    if (act === 2) targetFloor = 33;
    if (act === 3) targetFloor = 48;

    let pacingRatio = Math.min(currentFloor / targetFloor, 1);

    let currentDmgReq = damageTarget * pacingRatio;
    let currentBlkReq = blockTarget * pacingRatio;
    let markerPct = pacingRatio * 100;

    let dmgMarker = document.getElementById('dmg-marker');
    let blkMarker = document.getElementById('blk-marker');
    if(dmgMarker) dmgMarker.style.left = markerPct + '%';
    if(blkMarker) blkMarker.style.left = markerPct + '%';

    let poisonTotalDmgPerDraw = 15;
    let expectedPoisonDmgPerTurn = deckSize > 0 ? ((poisonCount / deckSize) * actualDraw * poisonTotalDmgPerDraw) / 7 : 0;

    let physPct = (expDamage / damageTarget) * 100;
    let poisonPct = (expectedPoisonDmgPerTurn / damageTarget) * 100;

    let displayPoisonDmg = Math.min(100, poisonPct);
    let displayPhysDmg = Math.min(physPct, 100 - displayPoisonDmg);

    let physFill = document.getElementById('damage-fill');
    let poisonFill = document.getElementById('poison-dmg-fill');

    if (physFill) physFill.style.width = displayPhysDmg + '%';
    if (poisonFill) poisonFill.style.width = displayPoisonDmg + '%';

    let totalDmg = expDamage + expectedPoisonDmgPerTurn;
    document.getElementById('damage-text').innerText = `${totalDmg.toFixed(1)} / 极值:${damageTarget} (当前及格: ${currentDmgReq.toFixed(1)})`;

    document.getElementById('block-fill').style.width = Math.min((expBlock / blockTarget) * 100, 100) + '%';

    let weakText = mitigatedBlock > 0.1 ? ` (<span style="color:#27ae60;font-weight:bold;">虚弱减伤: -${mitigatedBlock.toFixed(1)}</span>)` : "";
    document.getElementById('block-text').innerHTML = `${expBlock} / 极值:${blockTarget.toFixed(1)}${weakText} (当前及格: ${currentBlkReq.toFixed(1)})`;

    let drawRatio = deckSize > 0 ? (drawCount / deckSize) * 100 : 0;
    let exhaustRatio = deckSize > 0 ? (exhaustCount / deckSize) * 100 : 0;

    let displayDraw = Math.min(drawRatio, 100);
    let displayExhaust = Math.min(exhaustRatio, 100 - displayDraw);

    let drawFill = document.getElementById('draw-fill');
    let exhaustFill = document.getElementById('exhaust-fill');
    let engineText = document.getElementById('engine-text');

    if (drawFill && exhaustFill && engineText) {
        drawFill.style.width = displayDraw + '%';
        exhaustFill.style.width = displayExhaust + '%';
        engineText.innerText = `${drawRatio.toFixed(0)}% 过牌 | ${exhaustRatio.toFixed(0)}% 压缩`;
    }

    const tacticsRadar = document.getElementById('tactics-radar');
    if (tacticsRadar) {
        if (discardEnablerCount > 0 || finesseCount > 0) {
            tacticsRadar.style.display = 'block';
            let discardDesc = document.getElementById('discard-desc');
            let discardText = document.getElementById('discard-text');
            let enablerFill = document.getElementById('enabler-fill');
            let finesseFill = document.getElementById('finesse-fill');

            let totalDiscardCards = discardEnablerCount + finesseCount;
            let enablerPct = (discardEnablerCount / totalDiscardCards) * 100;
            let finessePct = (finesseCount / totalDiscardCards) * 100;

            if (enablerFill && finesseFill) {
                enablerFill.style.width = enablerPct + '%';
                finesseFill.style.width = finessePct + '%';

                enablerFill.innerText = enablerPct > 20 ? `${discardEnablerCount} 张丢弃源` : '';
                finesseFill.innerText = finessePct > 20 ? `${finesseCount} 张奇巧` : '';
            }

            if (finesseCount > 0 && discardEnablerCount === 0) {
                discardText.innerText = "❌ 严重卡死"; discardText.style.color = "#c0392b";
                discardDesc.innerText = `你有 ${finesseCount} 张奇巧牌，但没有主动丢弃手段！这些牌将严重拖累节奏。`;
            } else if (finesseCount > discardEnablerCount) {
                discardText.innerText = "⚠️ 供不应求"; discardText.style.color = "#d35400";
                discardDesc.innerText = `丢弃源不足！${discardEnablerCount} 张丢弃牌带不动 ${finesseCount} 张奇巧。`;
            } else if (discardEnablerCount > 0 && finesseCount > 0) {
                discardText.innerText = "✅ 完美咬合"; discardText.style.color = "#16a085";
                discardDesc.innerText = `供需平衡。奇巧牌可以完美白嫖触发，极大提高卡组上限！`;
            } else if (discardEnablerCount > 0 && finesseCount === 0) {
                discardText.innerText = "🔄 纯过牌调整"; discardText.style.color = "#666666";
                discardDesc.innerText = `有丢弃手段，但无奇巧牌。可用于过滤状态牌或诅咒。`;
            }
        } else {
            tacticsRadar.style.display = 'none';
        }
    }
}

// ================= 🎯 替换：完整修复毒伤计算的推演引擎 =================
function updateDrafts() {
    let tbody = document.getElementById('draft-tbody');
    let tip = document.getElementById('draft-empty-tip');
    if (!tbody) return;

    tbody.innerHTML = '';
    if (myDrafts.length === 0) {
        if(tip) tip.style.display = 'block';
        return;
    }
    if(tip) tip.style.display = 'none';

    // 1. 扫描当前卡组基础状态 (加入毒伤统计)
    let currentDmg = 0; let currentBlk = 0; let currentDrawCount = 0;
    let currentPoisonCount = 0; // 🎯 新增：原卡组毒伤池

    myDeck.forEach(card => {
        let stats = parseCardStats(card, card.isUpgraded);
        currentDmg += stats.dmg;
        currentBlk += stats.blk;
        let lowerDesc = stats.desc.toLowerCase();

        if (card.IsDraw || lowerDesc.includes("抽") || lowerDesc.includes("draw")) currentDrawCount += 1;
        // 🎯 捕获原卡组毒药
        if (card.IsPoison || lowerDesc.includes("中毒") || lowerDesc.includes("poison")) {
            currentPoisonCount += card.isUpgraded ? 1.5 : 1;
        }
    });

    let size = myDeck.length;
    const baseDraw = parseFloat(document.getElementById('base-draw').value) || 5;
    let expectedDraw = baseDraw + currentDrawCount;

    // 基础期望演算 (物理 + 毒伤)
    let basePhysDmgEV = size > 0 ? (currentDmg / size) * expectedDraw : 0;
    let poisonTotalDmgPerDraw = 15; // 毒伤转化率常数
    let basePoisonDmgEV = size > 0 ? ((currentPoisonCount / size) * expectedDraw * poisonTotalDmgPerDraw) / 7 : 0;

    let totalBaseDmgEV = basePhysDmgEV + basePoisonDmgEV; // 🎯 综合基础输出
    let baseBlkEV = size > 0 ? (currentBlk / size) * expectedDraw : 0;

    // 2. 遍历推演池
    myDrafts.forEach((draftCard, index) => {
        let stats = parseCardStats(draftCard, draftCard.isUpgraded);
        let cardDraw = 0;
        let draftPoison = 0; // 🎯 候选卡的毒伤
        let lowerDesc = stats.desc.toLowerCase();

        let currentDraw = stats.cardDraw;
        if (currentDraw === 0 && (lowerDesc.includes("抽") || lowerDesc.includes("draw"))) {
            let match = lowerDesc.match(/抽\s*(\d+)\s*张/);
            currentDraw = match ? parseInt(match[1]) : 1;
        }

        // 🎯 捕获候选卡毒药
        if (draftCard.IsPoison || lowerDesc.includes("中毒") || lowerDesc.includes("poison")) {
            draftPoison = draftCard.isUpgraded ? 1.5 : 1;
        }

        let isExhaust = draftCard.IsExhaust || lowerDesc.includes("消耗") || lowerDesc.includes("exhaust");
        let isEthereal = draftCard.IsEthereal || lowerDesc.includes("虚无") || lowerDesc.includes("ethereal");

        let bloatFactor = (isExhaust || isEthereal) ? 0.5 : 1.0;
        let newSize = size + bloatFactor;

        let newExpectedDraw = expectedDraw + cardDraw;

        // 🎯 计算加入新卡后的综合输出期望 (物理新期望 + 毒伤新期望)
        let newPhysDmgEV = ((currentDmg + stats.dmg) / newSize) * newExpectedDraw;
        let newPoisonDmgEV = ((currentPoisonCount + draftPoison) / newSize) * newExpectedDraw * poisonTotalDmgPerDraw / 7;
        let totalNewDmgEV = newPhysDmgEV + newPoisonDmgEV;

        let newBlkEV = ((currentBlk + stats.blk) / newSize) * newExpectedDraw;

        // 🎯 对比差值
        let deltaDmg = size > 0 ? totalNewDmgEV - totalBaseDmgEV : totalNewDmgEV;
        let deltaBlk = size > 0 ? newBlkEV - baseBlkEV : newBlkEV;

        let evalText = ""; let evalColor = "#666";
        if (deltaDmg < 0 && deltaBlk < 0) { evalText = "❌ 严重稀释"; evalColor = "#c0392b"; }
        else if (deltaDmg > 0 && deltaBlk > 0) { evalText = "✅ 全面拉升"; evalColor = "#16a085"; }
        else if (cardDraw > 0) { evalText = "🔄 平滑过渡"; evalColor = "#2980b9"; }
        else if (deltaDmg > 0) { evalText = "🗡️ 偏向输出"; evalColor = "#d35400"; }
        else if (deltaBlk > 0) { evalText = "🛡️ 偏向防守"; evalColor = "#27ae60"; }
        else { evalText = "⚖️ 收益平庸"; }

        let formatDelta = (val) => {
            if (val > 0.05) return `<span style="color: #16a085; font-weight: bold;">+${val.toFixed(1)}</span>`;
            if (val < -0.05) return `<span style="color: #e74c3c; font-weight: bold;">${val.toFixed(1)}</span>`;
            return `<span style="color: #7f8c8d;">0.0</span>`;
        };

        let tr = document.createElement('tr');
        tr.style.borderBottom = "1px dashed #e0e4d8";

        let tdCard = document.createElement('td');
        tdCard.style.padding = "4px 2px";
        tdCard.appendChild(createCardButton(draftCard.id, draftCard, "draft", index));
        tr.appendChild(tdCard);

        let tdDmg = document.createElement('td');
        tdDmg.style.padding = "6px 4px";
        tdDmg.innerHTML = `${totalNewDmgEV.toFixed(1)} <br>${formatDelta(deltaDmg)}`;
        tr.appendChild(tdDmg);

        let tdBlk = document.createElement('td');
        tdBlk.style.padding = "6px 4px";
        tdBlk.innerHTML = `${newBlkEV.toFixed(1)} <br>${formatDelta(deltaBlk)}`;
        tr.appendChild(tdBlk);

        let tdEval = document.createElement('td');
        tdEval.style.padding = "6px 4px";
        tdEval.style.color = evalColor;
        tdEval.style.fontWeight = "bold";
        tdEval.innerText = evalText;
        tr.appendChild(tdEval);

        tbody.appendChild(tr);
    });
}
// ========================================================================

// ================= 💾 本地存档引擎 (Local Storage) =================
function saveDeckToLocal() {
    if (myDeck.length === 0) {
        alert("⚠️ 当前卡组是空的，不需要保存！");
        return;
    }

    const slot = document.getElementById('save-slot').value;

    // 技巧：我们不保存庞大的完整卡牌数据，只保存“代号(id)”和“是否强化(isUpgraded)”，极大地节约性能
    const deckToSave = myDeck.map(card => ({
        id: card.id,
        isUpgraded: card.isUpgraded
    }));

    // 写入浏览器缓存
    localStorage.setItem(`SpirePort_${slot}`, JSON.stringify(deckToSave));

    // 顺手把你调好的面板设置也存下来
    localStorage.setItem(`SpirePort_${slot}_settings`, JSON.stringify({
        floor: document.getElementById('current-floor') ? document.getElementById('current-floor').value : 0,
        energy: document.getElementById('base-energy') ? document.getElementById('base-energy').value : 3,
        draw: document.getElementById('base-draw') ? document.getElementById('base-draw').value : 5
    }));

    alert(`✅ 战术方案已成功存入【${slot}】！\n现在即使刷新网页或关闭浏览器，你的卡组也不会丢失了。`);
}

function loadDeckFromLocal() {
    const slot = document.getElementById('save-slot').value;
    const savedData = localStorage.getItem(`SpirePort_${slot}`);

    if (!savedData) {
        alert(`⚠️ 空空如也！\n【${slot}】中没有找到任何存档记录。`);
        return;
    }

    try {
        const parsedDeck = JSON.parse(savedData);
        myDeck = [];
        let missingCount = 0;

        // 根据保存的 ID，去最新的图纸库里把真卡“捞”出来
        parsedDeck.forEach(savedCard => {
            if (allCards[savedCard.id]) {
                let newCard = JSON.parse(JSON.stringify(allCards[savedCard.id]));
                newCard.id = savedCard.id;
                newCard.isUpgraded = savedCard.isUpgraded;
                myDeck.push(newCard);
            } else {
                missingCount++; // 如果图纸库更新导致这牌没了，就记录下来
            }
        });

        // 恢复之前存的能量、抽牌、层数设置
        const savedSettings = localStorage.getItem(`SpirePort_${slot}_settings`);
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if(document.getElementById('current-floor')) document.getElementById('current-floor').value = settings.floor || 0;
            if(document.getElementById('base-energy')) document.getElementById('base-energy').value = settings.energy || 3;
            if(document.getElementById('base-draw')) document.getElementById('base-draw').value = settings.draw || 5;
        }

        // 驱动引擎全面重算
        updateWorkshop();

        if (missingCount > 0) {
            alert(`✅ 读取成功！\n\n但有 ${missingCount} 张卡牌在最新的数据库中找不到了（可能是你更新了 JSON 文件导致 ID 变动）。`);
        } else {
            console.log(`已成功读取 ${slot} 存档`);
        }

    } catch (e) {
        alert("❌ 存档数据读取失败，可能是数据损坏。");
        console.error(e);
    }
}
// ==================================================================

// ================= 新增：全局拖拽捕获引擎 =================
window.dropToDraft = function(e) {
    e.preventDefault();
    let cardId = e.dataTransfer.getData('cardId');
    let isUpg = e.dataTransfer.getData('isUpgraded') === 'true';

    if (cardId && allCards[cardId]) {
        let newCard = JSON.parse(JSON.stringify(allCards[cardId]));
        newCard.id = cardId;
        newCard.isUpgraded = isUpg;
        myDrafts.push(newCard);
        updateDrafts();
    }
};

loadCards();