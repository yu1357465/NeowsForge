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
// ==============================================

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

// ================= 完整修复版卡牌生成器 =================
function createCardButton(cardName, cardData, modeOrIsDeck = false, index = -1) {
    let mode = "library";
    if (modeOrIsDeck === true || modeOrIsDeck === "deck") mode = "deck";
    if (modeOrIsDeck === "draft") mode = "draft";

    let btn = document.createElement('div');
    let cType = cardData.Type ? cardData.Type.toLowerCase() : "unknown";
    let cClass = cardData.Class ? cardData.Class.toLowerCase() : "unknown";
    let isUpgraded = cardData.isUpgraded === true;

    let rawCost = cardData.Cost;
    if (isUpgraded && cardData.UpgradeCostTo !== undefined) rawCost = cardData.UpgradeCostTo;
    let cCost = rawCost !== "Unplayable" && rawCost !== -1 ? rawCost : "X";

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

    let icon = "?";
    if (typeof classIcons !== 'undefined' && classIcons[cClass]) {
        icon = classIcons[cClass];
    } else {
        if (cType === "attack") icon = "🗡️";
        else if (cType === "skill") icon = "🛡️";
        else if (cType === "power") icon = "✨";
    }

    btn.innerHTML = `<span class="class-icon">[${icon}]</span> ${cName} [${cCost}]`;

    if (mode === "library") {
        btn.onclick = () => {
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardName; newCard.isUpgraded = false;
            if (typeof myDeck !== 'undefined') {
                myDeck.push(newCard); updateWorkshop();
            }
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            let newCard = JSON.parse(JSON.stringify(cardData));
            newCard.id = cardName; newCard.isUpgraded = false;

            if (typeof myDrafts !== 'undefined') {
                myDrafts.push(newCard);
                if (typeof updateDrafts === 'function') updateDrafts();
            } else {
                alert("⚠️ 系统错误：未找到推演池！");
            }

            btn.style.transform = "scale(0.95)";
            setTimeout(() => btn.style.transform = "", 150);
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
            if(typeof updateDrafts === 'function') updateDrafts();
        };
        btn.oncontextmenu = (e) => {
            e.preventDefault();
            if(typeof myDrafts !== 'undefined') myDrafts[index].isUpgraded = !myDrafts[index].isUpgraded;
            if(typeof updateDrafts === 'function') updateDrafts();
        };
    }
    return btn;
}

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

// ================= 卡组清空与载入逻辑 =================
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

        let realKey = Object.keys(allCards).find(k => {
            let normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normalizedKey === normalizedTarget;
        });

        if (realKey) {
            myDeck.push({ id: realKey, ...allCards[realKey] });
        } else {
            missingCards.push(targetId);
        }
    });

    let baneKey = Object.keys(allCards).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === "ascendersbane");
    if (baneKey) {
        myDeck.push({ id: baneKey, ...allCards[baneKey] });
    }

    updateWorkshop();

    if (missingCards.length > 0) {
        alert(`⚠️ 严重脱节报警！\n\n以下初始牌在图纸库中查无此人：\n${missingCards.join(", ")}\n\n请按 F12 打开浏览器控制台，我已将所有可用 ID 打印在那里，看看它们到底改名叫什么了！`);
        console.log("👇 以下是当前图纸库里的所有可用卡牌 ID：");
        console.log(Object.keys(allCards));
    }
}

function updateWorkshop() {
    const deckDiv = document.getElementById('my-deck');
    document.getElementById('deck-count').innerText = myDeck.length;

    const baseEnergy = parseFloat(document.getElementById('base-energy').value) || 3;
    const baseDraw = parseFloat(document.getElementById('base-draw').value) || 5;

    let totalDeckEnergy = 0; let totalDeckDamage = 0; let totalDeckBlock = 0;
    let drawCardCount = 0; let exhaustCardCount = 0; let poisonCount = 0;
    let discardEnablerCount = 0; let finesseCount = 0;

    let totalStr = 0; let totalDex = 0;
    let vulnCardCount = 0; let weakCardCount = 0;
    let attackCardCount = 0; let blockCardCount = 0;

    deckDiv.innerHTML = '';

    if (myDeck.length === 0) {
        deckDiv.innerHTML = '<p style="color: #666; font-size: 0.9rem; text-align: center; margin-top: 20px;">👈 点击左侧卡牌加入卡组<br><br>💡 加入后：<b>左键</b>移除，<b>右键</b>强化/降级</p>';
        updateDashboard(0, 0, 0, baseEnergy, baseDraw, 0, 0, 0, 0, 0, 0, 0);
        return;
    }

    myDeck.sort((a, b) => {
        let costA = typeof a.Cost === 'number' ? a.Cost : 99;
        let costB = typeof b.Cost === 'number' ? b.Cost : 99;
        if (costA !== costB) return costA - costB;
        return (a.Name_ZHS || a.id).localeCompare(b.Name_ZHS || b.id);
    });

    myDeck.forEach((card, index) => {
        deckDiv.appendChild(createCardButton(card.id, card, true, index));

        if (card.Type === "Attack" || card.Type === "attack") attackCardCount += 1;

        let currentCost = card.Cost;
        if (card.isUpgraded && card.UpgradeCostTo !== undefined) currentCost = card.UpgradeCostTo;
        if (typeof currentCost === 'number') totalDeckEnergy += currentCost;

        let currentDamage = card.BaseDamage || 0;
        if (card.isUpgraded && card.UpgradeDamageBy !== undefined) currentDamage += card.UpgradeDamageBy;
        totalDeckDamage += currentDamage;

        let currentBlock = card.BaseBlock || 0;
        if (card.isUpgraded && card.UpgradeBlockBy !== undefined) currentBlock += card.UpgradeBlockBy;
        totalDeckBlock += currentBlock;
        if (currentBlock > 0) blockCardCount += 1;

        let desc = card.Description || "";
        let lowerDesc = desc.toLowerCase();

        if (card.IsDraw || (desc.includes("抽") && desc.includes("牌")) || lowerDesc.includes("draw")) drawCardCount += 1;
        if (card.IsExhaust || card.IsEthereal || desc.includes("消耗") || lowerDesc.includes("exhaust")) exhaustCardCount += 1;
        if (card.IsPoison || desc.includes("中毒") || lowerDesc.includes("poison")) poisonCount += card.isUpgraded ? 1.5 : 1;

        if (card.IsDiscardEnabler || ((desc.includes("丢弃") || desc.includes("弃置")) && !desc.includes("被丢弃"))) discardEnablerCount += 1;
        let isFakeFinesse = desc.includes("添加") && (desc.includes("奇巧") || desc.includes("sly"));
        if ((card.IsFinesse === true || desc.includes("奇巧") || lowerDesc.includes("sly")) && !isFakeFinesse) finesseCount += 1;

        let strMatch = desc.match(/(?:获得|增加)\s*(\d+)\s*(?:点)?\s*力量/);
        if (strMatch) totalStr += parseInt(strMatch[1]);

        let dexMatch = desc.match(/(?:获得|增加)\s*(\d+)\s*(?:点)?\s*敏捷/);
        if (dexMatch) totalDex += parseInt(dexMatch[1]);

        if (desc.includes("易伤") || lowerDesc.includes("vulnerable")) vulnCardCount += 1;
        if (desc.includes("虚弱") || lowerDesc.includes("weak")) weakCardCount += 1;
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

    let vulnProb = deckSize > 0 ? Math.min(1, (vulnCardCount / deckSize) * actualDraw) : 0;
    let weakProb = deckSize > 0 ? Math.min(1, (weakCardCount / deckSize) * actualDraw) : 0;

    let finalDamageEV = rawDamageEV * (1 + (0.5 * vulnProb));
    let finalBlockEV  = rawBlockEV;

    updateDashboard(
        baseEnergyEV, finalDamageEV, finalBlockEV, baseEnergy, actualDraw,
        drawCardCount, exhaustCardCount, deckSize,
        poisonCount, discardEnablerCount, finesseCount, weakProb
    );

    updateDrafts();
}

function updateDashboard(expEnergy, expDamage, expBlock, maxEnergy, actualDraw,
                         drawCount, exhaustCount, deckSize,
                         poisonCount, discardEnablerCount, finesseCount, weakProb) {

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

    weakProb = weakProb || 0;
    let blockTarget = baseBlockTarget * (1 - (0.25 * weakProb));

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
    let weakText = weakProb > 0.3 ? ` (已计入虚弱减免)` : "";
    document.getElementById('block-text').innerText = `${expBlock} / 极值:${blockTarget.toFixed(1)}${weakText} (当前及格: ${currentBlkReq.toFixed(1)})`;

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

// ================= 批量推演渲染引擎 =================
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

    let currentDmg = 0; let currentBlk = 0; let currentDrawCount = 0;
    myDeck.forEach(card => {
        let dmg = card.BaseDamage || 0;
        if (card.isUpgraded && card.UpgradeDamageBy) dmg += card.UpgradeDamageBy;
        currentDmg += dmg;

        let blk = card.BaseBlock || 0;
        if (card.isUpgraded && card.UpgradeBlockBy) blk += card.UpgradeBlockBy;
        currentBlk += blk;

        let desc = (card.Description || "").toLowerCase();
        if (card.IsDraw || desc.includes("抽") || desc.includes("draw")) currentDrawCount += 1;
    });

    let size = myDeck.length;
    const baseDraw = parseFloat(document.getElementById('base-draw').value) || 5;
    let expectedDraw = baseDraw + currentDrawCount;
    let baseDmgEV = size > 0 ? (currentDmg / size) * expectedDraw : 0;
    let baseBlkEV = size > 0 ? (currentBlk / size) * expectedDraw : 0;

    myDrafts.forEach((draftCard, index) => {
        let cardDmg = draftCard.BaseDamage || 0;
        if (draftCard.isUpgraded && draftCard.UpgradeDamageBy) cardDmg += draftCard.UpgradeDamageBy;

        let cardBlk = draftCard.BaseBlock || 0;
        if (draftCard.isUpgraded && draftCard.UpgradeBlockBy) cardBlk += draftCard.UpgradeBlockBy;

        let cardDraw = 0;
        let desc = (draftCard.Description || "").toLowerCase();
        if (draftCard.IsDraw || desc.includes("抽") || desc.includes("draw")) {
            let match = desc.match(/抽\s*(\d+)\s*张/);
            cardDraw = match ? parseInt(match[1]) : 1;
        }

        let newSize = size + 1;
        let newExpectedDraw = expectedDraw + cardDraw;
        let newDmgEV = ((currentDmg + cardDmg) / newSize) * newExpectedDraw;
        let newBlkEV = ((currentBlk + cardBlk) / newSize) * newExpectedDraw;

        let deltaDmg = size > 0 ? newDmgEV - baseDmgEV : newDmgEV;
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
        tdDmg.innerHTML = `${newDmgEV.toFixed(1)} <br>${formatDelta(deltaDmg)}`;
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

loadCards();