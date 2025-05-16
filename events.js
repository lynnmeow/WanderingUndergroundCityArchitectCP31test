/**
 * 地下城管理模拟器 - 随机事件系统
 * 包含所有随机事件相关的功能
 */

// 事件配置文件路径
const EVENTS_CONFIG_URL = './data/events.json';

// ================== 事件系统函数 ==================

// 加载事件配置
async function loadEventsConfig() {
    let timeoutId; // 提升变量声明到函数作用域
    
    try {
        // 验证文件路径
        if (!EVENTS_CONFIG_URL || typeof EVENTS_CONFIG_URL !== 'string') {
            throw new Error('无效的事件配置文件路径');
        }

        // 添加加载超时处理
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(EVENTS_CONFIG_URL, { 
            signal: controller.signal 
        });
        
        // 检查响应状态
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态码: ${response.status}`);
        }

        const data = await response.json();
        
        // 验证数据格式
        if (!data.events || !Array.isArray(data.events)) {
            throw new Error('无效的事件数据格式');
        }

        gameState.events = data.events;
        console.log(`成功加载${gameState.events.length}个随机事件`);
        return true;
    } catch (error) {
        console.error("加载事件配置失败:", error.message);
        // 不再提供默认事件数据
        gameState.events = [];
        return false;
    } finally {
        clearTimeout(timeoutId);
    }
}

// 处理随机事件
function processRandomEvents() {
    let triggeredEvents = []; // 用于记录触发的事件

    // 每年尝试触发两次随机事件
    for (let i = 0; i < 2; i++) {
        const triggeredEvent = checkForRandomEvent();
        if (triggeredEvent) {
            try {
                applyEventEffect(triggeredEvent);
                triggeredEvents.push(triggeredEvent); // 记录触发的事件
                console.log(`成功触发随机事件: ${triggeredEvent.name}`);
            } catch (error) {
                console.error(`处理随机事件时出错:`, error);
            }
        }
    }
    
    // 记录事件触发情况到gameState，用于调试日志
    gameState.lastTriggeredEvents = triggeredEvents;
    
    // 更新人口历史和下跌趋势
    updatePopulationTrend();
}

// 检查是否触发随机事件
function checkForRandomEvent() {
    if (!gameState.events || gameState.events.length === 0) {
        console.warn("事件列表为空，请检查事件配置是否正确加载");
        return null;
    }
    
    // 筛选符合当前条件的事件
    const availableEvents = gameState.events.filter(event => {
        return checkEventCondition(event.condition);
    });
    
    if (availableEvents.length === 0) {
        console.log("没有符合当前条件的事件可触发");
        return null;
    }
    
    // 计算所有可用事件的概率总和
    let totalProbability = 0;
    const eventsWithProbability = availableEvents.map(event => {
        // 确保概率不超过1
        const probability = Math.min(event.probability, 1);
        totalProbability += probability;
        return { ...event, adjustedProbability: probability };
    });
    
    // 确保总概率不超过1
    totalProbability = Math.min(totalProbability, 1);
    
    console.log(`所有可用事件的概率总和: ${totalProbability}`);
    
    // 决定是否触发任何事件
    const randomValue = Math.random();
    if (randomValue >= totalProbability) {
        console.log(`未触发任何事件，随机值: ${randomValue.toFixed(4)}，需要小于: ${totalProbability.toFixed(4)}`);
        return null;
    }
    
    // 已决定触发事件，选择具体哪个事件
    // 使用相对概率（轮盘赌选择法）
    let cumulativeProbability = 0;
    const selectedEventValue = Math.random() * totalProbability; // 在总概率范围内随机选择
    
    for (const event of eventsWithProbability) {
        cumulativeProbability += event.adjustedProbability;
        
        if (selectedEventValue <= cumulativeProbability) {
            console.log(`事件触发成功: ${event.name}，相对概率: ${(event.adjustedProbability / totalProbability).toFixed(4)}`);
            return event;
        }
    }
    
    // 理论上不应该到达这里，但为了安全起见
    console.log("未能选择事件，返回第一个可用事件");
    return eventsWithProbability[0];
}

// 检查事件条件是否满足
function checkEventCondition(condition) {
    if (!condition || condition === "none") {
        return true;
    }
    
    // 使用eval安全地评估条件
    try {
        // 创建包含游戏属性的上下文
        const attr = gameState.attributes;
        const currentYear = gameState.currentYear;
        const populationDeclineYears = gameState.populationDeclineYears;
        
        // 构建条件表达式
        const conditionExpression = condition
            .replace(/researchLevel/g, 'attr.researchLevel')
            .replace(/constructionLevel/g, 'attr.constructionLevel')
            .replace(/talentLevel/g, 'attr.talentLevel');
        
        // 评估条件
        return eval(conditionExpression);
    } catch (error) {
        console.error("事件条件评估错误:", error);
        return false;
    }
}

// 应用事件效果
function applyEventEffect(event) {
    if (!event || !event.effect) {
        console.error("无效的事件或事件效果", event);
        return;
    }
    
    console.log(`应用事件效果: ${event.name}`, event);
    
    // 创建事件效果描述
    let effectDescriptions = [];
    let isNegativeEvent = false;
    let isPositiveEvent = false;
    
    // 解析并应用效果
    const effectParts = event.effect.split(',');
    effectParts.forEach(part => {
        // 修改正则表达式，使用([\u4e00-\u9fa5\w]+)匹配中文和拉丁字符
        const match = part.trim().match(/^([\u4e00-\u9fa5\w]+)([\+\-])(\d+)(%?)$/);
        if (!match) {
            console.error(`无效的事件效果格式: ${part}`);
            return;
        }
        
        const [, attribute, operation, value, isPercent] = match;
        const numValue = parseInt(value);
        
        // 根据属性名映射到实际游戏属性
        const attrMap = {
            '民心': 'peopleSupport',
            '安全': 'security',
            '文明': 'civilization',
            '资源': 'resources',
            '人口': 'population',
            '科研等级': 'researchLevel',
            '建设等级': 'constructionLevel',
            '人才等级': 'talentLevel'
        };
        
        const gameAttr = attrMap[attribute] || attribute;
        
        // 记录效果类型（正面/负面）
        if (operation === '+') isPositiveEvent = true;
        if (operation === '-') isNegativeEvent = true;
        
        // 应用效果
        if (gameState.attributes[gameAttr] !== undefined) {
            const currentValue = gameState.attributes[gameAttr];
            let newValue = currentValue;
            
            if (isPercent) {
                // 百分比变化
                const changeAmount = currentValue * (numValue / 100);
                newValue = operation === '+'
                    ? currentValue + changeAmount
                    : currentValue - changeAmount;
                
                // 添加效果描述
                effectDescriptions.push(`${attribute}${operation}${numValue}%`);
            } else {
                // 固定值变化
                newValue = operation === '+'
                    ? currentValue + numValue
                    : currentValue - numValue;
                
                // 添加效果描述
                effectDescriptions.push(`${attribute}${operation}${numValue}`);
            }
            
            gameState.attributes[gameAttr] = newValue;
            console.log(`事件效果应用: ${attribute} ${operation} ${numValue}${isPercent ? '%' : ''}, 从 ${currentValue} 变为 ${newValue}`);
        } else {
            console.error(`未知的游戏属性: ${gameAttr}, 无法应用事件效果: ${part}`);
        }
    });
    
    // 事件应用后重新进行属性范围限制
    clampAttributes();
    
    // 立即更新显示
    updateDisplays(); 
    
    // 修改日志记录方式，添加事件描述
    addLog(
        `【${event.name}】${event.description} ${effectDescriptions.join('，')}`, 
        'event'
    );
    
    // 立即检查游戏结束条件
    if (checkEnding()) {
        endGame();
    }
    
    return true; // 返回成功标志
}

// 添加格式化的事件日志
function addEventLog(title, description, effectText, eventType = '') {
    const log = document.getElementById('gameLog');
    if (!log) {
        console.error("无法找到游戏日志元素");
        return;
    }
    
    const entry = document.createElement('div');
    entry.className = `log-entry event ${eventType}`;
    
    // 添加年份信息
    const currentYear = gameState.currentYear;
    
    entry.innerHTML = `
        <span class="log-year">${currentYear}年</span>
        <div class="event-title">${title}</div>
        <div class="event-description">${description}</div>
        <span class="event-effect ${eventType}">效果: ${effectText}</span>
    `;
    
    // 插入到日志顶部
    if (log.firstChild) {
        log.insertBefore(entry, log.firstChild);
    } else {
        log.appendChild(entry);
    }
    
    // 确保事件显示可见
    entry.style.display = 'block';
    
    // 播放提示音效（如果有）
    if (eventType === 'negative') {
        playSound('warning');
    } else if (eventType === 'positive') {
        playSound('positive');
    }
    
    console.log(`事件已添加到日志: ${title}`);
}

// 播放音效（如果实现了音效系统）
function playSound(type) {
    // 这个函数是为未来扩展预留的
    // 如果实现了音效系统，可以在这里添加代码
}

// 更新人口趋势
function updatePopulationTrend() {
    const currentPopulation = gameState.attributes.population;
    const populationHistory = gameState.populationHistory;
    
    // 添加当前人口到历史记录
    populationHistory.push(currentPopulation);
    
    // 保持历史记录最多12条（近一年）
    if (populationHistory.length > 12) {
        populationHistory.shift();
    }
    
    // 如果有足够的历史数据，检查是否连续下跌
    if (populationHistory.length >= 2) {
        const isDecline = populationHistory[populationHistory.length - 1] < 
                          populationHistory[populationHistory.length - 2];
        
        if (isDecline) {
            gameState.populationDeclineYears++;
        } else {
            gameState.populationDeclineYears = 0;
        }
    }
}

// 将函数添加到全局window对象
window.loadEventsConfig = loadEventsConfig;
window.processRandomEvents = processRandomEvents;
window.checkForRandomEvent = checkForRandomEvent;
window.checkEventCondition = checkEventCondition;
window.applyEventEffect = applyEventEffect;
window.addEventLog = addEventLog;
window.playSound = playSound;
window.updatePopulationTrend = updatePopulationTrend;
