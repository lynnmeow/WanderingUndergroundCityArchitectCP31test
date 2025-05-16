/**
 * 地下城管理模拟器 - 调试工具
 * 包含调试、控制台打印和诊断功能
 */

// ================== 随机事件调试工具 ==================

// 调试工具 - 手动触发随机事件
function debugTriggerRandomEvent() {
    if (!gameState.events || gameState.events.length === 0) {
        console.error("事件列表为空，无法触发随机事件");
        return null;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => {
        return checkEventCondition(event.condition);
    });
    
    if (availableEvents.length === 0) {
        console.error("没有符合当前条件的事件可触发");
        return null;
    }
    
    // 计算总概率和相对概率
    let totalProbability = 0;
    const eventsWithProbability = availableEvents.map(event => {
        const probability = Math.min(event.probability, 1);
        totalProbability += probability;
        return { ...event, adjustedProbability: probability };
    });
    
    // 确保总概率不超过1
    totalProbability = Math.min(totalProbability, 1);
    
    // 使用相对概率选择事件（轮盘赌选择法）
    let cumulativeProbability = 0;
    const selectedEventValue = Math.random() * totalProbability;
    let selectedEvent = null;
    
    for (const event of eventsWithProbability) {
        cumulativeProbability += event.adjustedProbability;
        
        if (selectedEventValue <= cumulativeProbability) {
            selectedEvent = event;
            break;
        }
    }
    
    // 如果没有选到事件（理论上不会发生），选择第一个
    if (!selectedEvent && eventsWithProbability.length > 0) {
        selectedEvent = eventsWithProbability[0];
    }
    
    console.log("调试：手动触发随机事件", selectedEvent);
    
    if (selectedEvent) {
        // 应用事件效果
        applyEventEffect(selectedEvent);
        
        // 将事件添加到本年度触发事件列表
        if (!gameState.lastTriggeredEvents) {
            gameState.lastTriggeredEvents = [];
        }
        gameState.lastTriggeredEvents.push(selectedEvent);
    }
    
    return selectedEvent;
}

// 检查随机事件系统的状态
function checkRandomEventSystem() {
    console.group("随机事件系统诊断");
    
    // 检查事件配置是否正确加载
    if (!gameState.events || gameState.events.length === 0) {
        console.error("错误：事件列表为空，可能是配置文件未正确加载");
        console.log("建议：检查events.json文件路径是否正确");
    } else {
        console.log(`✅ 事件列表已加载，共有${gameState.events.length}个事件`);
        
        // 检查事件格式
        let invalidEvents = [];
        gameState.events.forEach(event => {
            if (!event.name || !event.description || !event.effect || !event.probability) {
                invalidEvents.push(event);
            }
            
            // 检查事件效果格式
            if (event.effect) {
                const effectParts = event.effect.split(',');
                effectParts.forEach(part => {
                    // 使用匹配中文的正则表达式
                    const match = part.trim().match(/^([\u4e00-\u9fa5\w]+)([\+\-])(\d+)(%?)$/);
                    if (!match) {
                        console.warn(`警告：事件"${event.name}"的效果格式无效: ${part}`);
                    }
                });
            }
        });
        
        if (invalidEvents.length > 0) {
            console.warn(`警告：发现${invalidEvents.length}个格式可能不正确的事件`);
            console.table(invalidEvents);
        } else {
            console.log("✅ 所有事件格式检查通过");
        }
        
        // 检查符合当前条件的事件
        const availableEvents = gameState.events.filter(event => checkEventCondition(event.condition));
        console.log(`符合当前条件的事件: ${availableEvents.length}个`);
        
        if (availableEvents.length === 0) {
            console.warn("警告：当前没有符合条件的事件可触发");
        } else {
            console.log("✅ 有符合条件的事件可触发");
            
            // 计算总概率
            let totalProbability = 0;
            const eventsWithDetails = availableEvents.map(e => {
                const probability = Math.min(e.probability, 1);
                totalProbability += probability;
                return {
                    "事件名称": e.name,
                    "原始概率": e.probability,
                    "调整后概率": probability,
                    "事件效果": e.effect,
                    "条件": e.condition || "none"
                };
            });
            
            // 确保总概率不超过1
            totalProbability = Math.min(totalProbability, 1);
            console.log(`触发任意事件的总概率: ${totalProbability.toFixed(4)} (${(totalProbability * 100).toFixed(2)}%)`);
            console.log(`不触发任何事件的概率: ${(1-totalProbability).toFixed(4)} (${((1-totalProbability) * 100).toFixed(2)}%)`);
            
            // 显示每个事件的相对概率
            console.table(eventsWithDetails.map(e => ({
                ...e,
                "相对概率": `${((e.调整后概率 / totalProbability) * 100).toFixed(2)}%`
            })));
        }
    }
    
    // 检查最近触发的事件
    if (gameState.lastTriggeredEvents && gameState.lastTriggeredEvents.length > 0) {
        console.log(`✅ 本年度成功触发了${gameState.lastTriggeredEvents.length}个事件`);
    } else {
        console.log("本年度尚未触发任何事件");
    }
    
    console.groupEnd();
    
    return {
        eventsLoaded: gameState.events ? gameState.events.length : 0,
        availableEvents: gameState.events ? gameState.events.filter(event => checkEventCondition(event.condition)).length : 0,
        triggeredEvents: gameState.lastTriggeredEvents ? gameState.lastTriggeredEvents.length : 0,
        totalProbability: calculateTotalEventProbability()
    };
}

// 辅助函数：计算事件总概率
function calculateTotalEventProbability() {
    if (!gameState.events || gameState.events.length === 0) {
        return 0;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => checkEventCondition(event.condition));
    
    // 计算总概率
    let totalProbability = 0;
    availableEvents.forEach(event => {
        totalProbability += Math.min(event.probability, 1);
    });
    
    return Math.min(totalProbability, 1);
}

// ================== 游戏状态调试工具 ==================

// 计算等级信息
function calculateLevelInfo(type) {
    const attr = gameState.attributes;
    const currentLevel = attr[`${type}Level`];
    const consumedTotal = attr[`${type}ConsumedTotal`];
    const nextLevelRequirement = gameState.levelConfig?.[type]?.[currentLevel] || 0;
    
    return {
        currentLevel,
        consumedTotal,
        nextLevelRequirement,
        progress: consumedTotal / nextLevelRequirement
    };
}

// 记录调试信息到控制台
function logDebugInfo() {
    console.group("游戏状态调试信息");
    
    // 记录当前游戏状态
    console.log("当前年份:", gameState.currentYear);
    console.log("当前策略:", gameState.strategy);
    console.log("出生率系数:", gameState.birthRate * 0.1);
    
    // 记录游戏属性
    console.log("游戏属性:", gameState.attributes);
    
    // 记录等级情况
    const researchLevelInfo = calculateLevelInfo("research");
    const constructionLevelInfo = calculateLevelInfo("construction");
    
    console.log("研究等级信息:", researchLevelInfo);
    console.log("建设等级信息:", constructionLevelInfo);
    
    // 记录事件系统情况
    const eventSystemInfo = checkRandomEventSystem();
    console.log("事件系统状态:", eventSystemInfo);
    
    console.groupEnd();
}

// 启用调试模式，添加调试按钮
function enableDebugMode() {
    document.getElementById('debugTools').style.display = 'block';
    console.log('调试模式已启用');
    
    // 绑定调试按钮事件
    document.getElementById('triggerEventBtn').addEventListener('click', function() {
        const event = debugTriggerRandomEvent();
        console.log('手动触发事件:', event);
    });
    
    // 添加更多调试按钮
    const debugContainer = document.getElementById('debugTools');
    
    // 添加状态检查按钮
    const checkStateBtn = document.createElement('button');
    checkStateBtn.className = 'button-blue';
    checkStateBtn.style.fontSize = '12px';
    checkStateBtn.style.padding = '5px 10px';
    checkStateBtn.style.marginLeft = '5px';
    checkStateBtn.textContent = '检查游戏状态';
    checkStateBtn.addEventListener('click', logDebugInfo);
    debugContainer.appendChild(checkStateBtn);
    
    // 添加事件系统诊断按钮
    const checkEventsBtn = document.createElement('button');
    checkEventsBtn.className = 'button-blue';
    checkEventsBtn.style.fontSize = '12px';
    checkEventsBtn.style.padding = '5px 10px';
    checkEventsBtn.style.marginLeft = '5px';
    checkEventsBtn.textContent = '诊断事件系统';
    checkEventsBtn.addEventListener('click', checkRandomEventSystem);
    debugContainer.appendChild(checkEventsBtn);
}

// 将调试工具暴露给window对象
window.debugTriggerRandomEvent = debugTriggerRandomEvent;
window.checkRandomEventSystem = checkRandomEventSystem;
window.calculateTotalEventProbability = calculateTotalEventProbability;
window.logDebugInfo = logDebugInfo;
window.enableDebugMode = enableDebugMode; 