/**
 * 地下城管理模拟器 - 完整版
 * 包含全部游戏逻辑和注释
 */

// 新增配置文件路径
const LEVEL_CONFIG_URL = './data/levelRequirements.json';

// 确保gameState是全局变量，可以被events.js访问
window.gameState = {
    running: false,
    currentYear: 2164,
    intervalId: null,
    progressInterval: null,
    strategy: "均衡发展",
    birthRate: 10,

    // 游戏属性
    attributes: {
        peopleSupport: 50,
        security: 50,
        civilization: 90,
        resources: 20000000,
        population: 1000000,
        researchLevel: 1,
        constructionLevel: 1,
        talentLevel: 1,
        researchConsumedTotal: 0,
        constructionConsumedTotal: 0,
        totalResourcesAdded: 0
    },

    // 新增：记录等级上次升级的年份
    lastLevelUpgradeYear: {
        research: 2164,
        construction: 2164
    },
    
    // 新增：记录资源条件满足的年份
    researchResourceMetYear: null,
    constructionResourceMetYear: null,

    // 策略配置
    strategies: {
        "均衡发展": {},
        "高速发展": {
            populationCost: 1.3,
            constructionCost: 1.3,
            researchCost: 2,
            peopleSupport: -2,
            security: +2
        },
        "资源调控": {
            populationCost: 0.7,
            peopleSupport: -1
        },
        "民生安定": {
            populationCost: 1.3,
            peopleSupport: +1
        },
        "工程建设": {
            constructionCost: 1.3,
            security: +1
        },
        "科学研究": {
            researchCost: 2
        },
        "人才培养": {
            populationCost: 1.5
        },
        "文化发展": {
            civilization: +1,
            peopleSupport: +0.5
        }
    },

    lastValues: {}, // 用于记录属性变化
    levelConfig: null,
    
    // 随机事件相关
    events: [], // 事件列表
    populationHistory: [], // 人口历史记录，用于判断人口下跌趋势
    populationDeclineYears: 0, // 连续人口下跌年数
    lastTriggeredEvents: [] // 用于记录触发的事件
};

// 移动设备检测
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ================== 初始化部分 ==================
async function initGame() {
    // 强制显示开始界面
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('endScreen').style.display = 'none';

    // 添加策略折叠按钮和当前策略显示
    const container = document.getElementById('strategyButtons');
    const header = document.createElement('div');
    header.className = 'strategy-header';
    
    // 当前策略显示
    const currentStrategy = document.createElement('span');
    currentStrategy.id = 'currentStrategy';
    currentStrategy.textContent = `当前策略：${gameState.strategy}`;
    header.appendChild(currentStrategy);

    // 创建折叠按钮（始终创建，通过CSS控制显示）
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'toggleStrategy';
    toggleBtn.className = 'strategy-toggle';
    toggleBtn.innerHTML = '▼';
    header.appendChild(toggleBtn);
    
    container.parentNode.insertBefore(header, container);

    // 移动人口调控滑块到策略容器
    const birthControlSection = document.querySelector('.birth-control-section');
    if (birthControlSection) {
        container.parentNode.insertBefore(birthControlSection, container.nextSibling);
    }

    initStrategies();
    initEventListeners();
    initTooltips();
    
    // 并行加载配置
    await Promise.all([
        loadLevelConfig(),
        loadEventsConfig() // 加载事件配置
    ]);
    
    console.log("游戏初始化完成，等级配置和事件配置加载完成");
}

async function loadLevelConfig() {
    try {
        const response = await fetch(LEVEL_CONFIG_URL);
        gameState.levelConfig = await response.json();
        console.log("成功加载等级配置", gameState.levelConfig);
    } catch (error) {
        console.error("加载等级配置失败，使用默认配置", error);
        // 设置默认配置
        gameState.levelConfig = {
            research: Array.from({length: 100}, (_, i) => 5000000 + i * 12000000),
            construction: Array.from({length: 100}, (_, i) => 5000000 + i * 12000000),
            yearRequirements: {
                "1": 1,
                "11": 2,
                "21": 3,
                "31": 4,
                "41": 5,
                "51": 6,
                "61": 7,
                "71": 8,
                "81": 9,
                "91": 10,
                "101": 11
            }
        };
    }
}

function initStrategies() {
    const container = document.getElementById('strategyButtons');
    Object.keys(gameState.strategies).forEach(strategy => {
        const btn = document.createElement('button');
        btn.className = `strategy-btn ${strategy === '均衡发展' ? 'active' : ''}`;
        btn.textContent = strategy;
        btn.dataset.tip = getStrategyTip(strategy);
        
        // 添加点击事件监听器
        btn.addEventListener('click', () => setStrategy(strategy));
        
        // 直接为策略按钮添加tooltip相关的事件处理
        btn.addEventListener('mouseenter', showTooltip);
        btn.addEventListener('mouseleave', hideTooltip);
        
        // 添加长按显示tooltip的处理，确保不影响点击事件
        let touchTimeout;
        let isTouchMoved = false;
        
        btn.addEventListener('touchstart', (e) => {
            isTouchMoved = false;
            touchTimeout = setTimeout(() => {
                if (!isTouchMoved) {
                    showTooltip(e);
                    setTimeout(hideTooltip, 2000);
                }
            }, 500); // 500ms长按阈值
        });
        
        btn.addEventListener('touchmove', () => {
            isTouchMoved = true;
            clearTimeout(touchTimeout);
        });
        
        btn.addEventListener('touchend', () => {
            clearTimeout(touchTimeout);
        });
        
        container.appendChild(btn);
    });
}

function initEventListeners() {
    const birthRate = document.getElementById('birthRate');
    birthRate.addEventListener('input', function() {
        gameState.birthRate = Math.min(30, Math.max(0, parseInt(this.value) || 0));
        document.getElementById('birthRateValue').textContent = (this.value * 0.1).toFixed(1);
    });

    // 添加策略折叠按钮点击事件
    const toggleBtn = document.getElementById('toggleStrategy');
    const strategyButtons = document.getElementById('strategyButtons');
    const birthControlSection = document.querySelector('.birth-control-section');
    
    console.log('Toggle button:', toggleBtn);
    console.log('Strategy buttons:', strategyButtons);
    console.log('Birth control section:', birthControlSection);

    if (toggleBtn && strategyButtons && birthControlSection) {
        toggleBtn.addEventListener('click', () => {
            console.log('Toggle button clicked');
            strategyButtons.classList.toggle('expanded');
            birthControlSection.classList.toggle('expanded');
            
            toggleBtn.innerHTML = strategyButtons.classList.contains('expanded') 
                ? '▲' 
                : '▼';
        });
        
        // 初始状态设置
        if (isMobile) {
            strategyButtons.classList.remove('expanded');
            birthControlSection.classList.remove('expanded');
            toggleBtn.innerHTML = '▼';
        } else {
            strategyButtons.classList.add('expanded');
            birthControlSection.classList.add('expanded');
        }
    } else {
        console.error('Missing required elements for strategy toggle');
    }
}

// ================== 核心游戏逻辑 ==================
function startGame() {
    const cityName = document.getElementById('cityName').value.trim();
    if (!cityName) return alert("请输入地下城名称");

    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameScreen').style.display = 'block';
    document.getElementById('fullCityName').textContent = `${cityName}地下城`;

    gameState.running = true;
    gameState.lastValues = {...gameState.attributes};
    startYearCycle();
}

function startYearCycle() {
    processYear();
    gameState.intervalId = setInterval(() => {
        gameState.currentYear >= 4665 ? endGame() : processYear();
    }, 10000);
}

// 将 endGame 函数移到这里，确保在使用前定义
function endGame() {
    // 清理定时器
    clearInterval(gameState.intervalId);
    clearInterval(gameState.progressInterval);
    
    // 停止游戏运行
    gameState.running = false;
    
    // 获取结局
    const ending = determineEnding();
    
    // 计算游戏总年数
    const totalYears = gameState.currentYear - 2164;
    
    // 显示结局界面
    document.getElementById('gameScreen').style.display = 'none';
    document.getElementById('endScreen').style.display = 'block';
    document.getElementById('endingTitle').textContent = ending.title;
    document.getElementById('endingDescription').textContent = ending.description;
    
    // 移除任何已存在的游戏总结
    const existingSummaries = document.querySelectorAll('.game-summary');
    existingSummaries.forEach(summary => summary.remove());
    
    // 生成游戏总结
    const summary = generateGameSummary(totalYears, gameState.attributes);
    
    // 添加游戏总结到结局界面
    const summaryElement = document.createElement('div');
    summaryElement.className = 'game-summary';
    summaryElement.innerHTML = summary;
    document.querySelector('.ending-content').insertBefore(
        summaryElement,
        document.querySelector('.restart-btn')
    );
    
    // 添加最终日志
    addLog(`游戏结束：${ending.title}`, true);
}

function processYear() {
    // 先更新年份
    gameState.currentYear++;
    document.getElementById('currentYear').textContent = gameState.currentYear;
    
    // 先处理随机事件（立即生效）
    processRandomEvents();
    
    // 再计算年度变化
    calculateYearlyChanges();
    
    // 更新显示（不包含年度结算日志）
    updateDisplays(false);
    
    // 检查警告
    checkWarnings();
    
    // 确保清除之前的进度条
    if (gameState.progressInterval) {
        clearInterval(gameState.progressInterval);
        gameState.progressInterval = null;
    }

    // 保存当前年份状态
    const currentYear = gameState.currentYear;
    const currentPopulation = gameState.attributes.population;
    const currentResources = gameState.attributes.resources;
    const lastPopulation = gameState.lastValues.population;
    const lastResources = gameState.lastValues.resources;
    
    console.log(`准备年度结算: ${currentYear}年`, {
        currentPopulation,
        lastPopulation,
        currentResources,
        lastResources
    });

    // 启动进度条并传入完成回调
    startProgressBar(() => {
        console.log(`执行年度结算回调: ${currentYear}年`);
        
        // 计算变化值
        const changes = {
            population: currentPopulation - lastPopulation,
            resources: currentResources - lastResources
        };
        
        // 在进度条完成后添加年度结算日志
        addLog(`📅 ${currentYear}年结算：人口${changes.population >= 0 ? '增加' : '减少'}${formatNumber(Math.abs(changes.population))}，资源${changes.resources >= 0 ? '增加' : '减少'}${formatNumber(Math.abs(changes.resources))}`, false);
    });
    
    // 新增：更新年度语录
    const quotes = [
        "Tips：低于500人，人类将灭绝。",
        "在流浪的尽头，人类要回答的不是'能否抵达'，而是'抵达后我们是否还配被称为人类'。", 
        "没有人的文明，毫无意义。",
        "最初，没有人在意这场灾难……",
        "无论最终结果将人类历史导向何处，我们决定，选择希望！",
        "从历史上看，人类的命运取决于人类的选择。",
        "危难当前，唯有责任。",
        "希望是像钻石一样珍贵的东西！希望是我们唯一回家的方向。",
        "人类的勇气和坚毅，必将被镌刻在星空之下。",
        "我信，我的孩子会信，孩子的孩子会信。",
        "我相信人类的勇气可以跨越时间，当下，未来。",
        "我相信，可以再次看到蓝天，鲜花，挂满枝头。",
        "我们的人一定可以完成任务，不计虚实，不计存亡。"
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById('yearMessage').textContent = randomQuote;

    // 检查游戏结束条件
    if (checkEnding()) {
        endGame();
        return;
    }
    
    logDebugInfo();
}

// ================== 计算逻辑 ==================
function calculateYearlyChanges() {
    const attr = gameState.attributes;
    const strategy = gameState.strategies[gameState.strategy];
    gameState.lastValues = {...attr};

    // 人口变化
    const births = Math.floor(attr.population * 0.01 * gameState.birthRate * 0.1);
    const deaths = Math.max(1000, Math.ceil(attr.population * 0.01));
    attr.population += births - deaths;

    // 资源计算
    const researchCost = 500000 * attr.researchLevel * (strategy.researchCost || 1);
    const constructionCost = 1000000 * attr.constructionLevel * (strategy.constructionCost || 1);
    
    // 修改：人口消耗计算
    const populationCost = attr.population * 12;  // 基础人口消耗
    const adjustedPopulationCost = populationCost * (strategy.populationCost || 1);  // 考虑策略加成

    // 资源收入计算
    let resourceIncome = 15000000 * attr.researchLevel;
    if (attr.totalResourcesAdded >= 1e11) resourceIncome = 0;
    resourceIncome = Math.min(resourceIncome, 2e8);

    // 总资源变化
    attr.resources += resourceIncome - (researchCost + constructionCost + adjustedPopulationCost);
    attr.totalResourcesAdded += resourceIncome;
    attr.researchConsumedTotal += researchCost;
    attr.constructionConsumedTotal += constructionCost;

    // 属性变化
    attr.peopleSupport += (strategy.peopleSupport || 0) - 0.1;
    attr.security += (strategy.security || 0) - 0.1;
    attr.civilization += (strategy.civilization || 0) - 0.1;

    // 先升级科研
    updateLevel('research', attr.researchConsumedTotal);
    // 再升级建设
    updateLevel('construction', attr.constructionConsumedTotal);

    // 人才等级
    if (gameState.strategy === '人才培养') {
        attr.talentLevel = Math.min(attr.talentLevel + 1, 25);
    } else if (gameState.currentYear % 2 === 0) {
        attr.talentLevel = Math.max(attr.talentLevel - 1, 1);
    }

    clampAttributes();
    
    if (attr.peopleSupport <= 0 || attr.security <= 0 || attr.civilization <= 0) {
        return;
    }
}

function updateLevel(type, consumed) {
    const attr = gameState.attributes;
    const currentLevel = attr[`${type}Level`];
    const levelConfig = gameState.levelConfig[type];
    
    if (!levelConfig || currentLevel >= levelConfig.length) {
        console.error(`无效的等级配置：${type}`);
        return;
    }

    const required = levelConfig[currentLevel];
    
    // 检查是否满足资源条件
    if (consumed >= required) {
        // 检查是否已经记录资源满足的年份
        if (!gameState[`${type}ResourceMetYear`]) {
            // 第一次满足资源条件，记录当前年份
            gameState[`${type}ResourceMetYear`] = gameState.currentYear;
            // 向游戏日志添加信息
            const requiredYears = getRequiredYearsForLevel(currentLevel + 1, type);
            addLog(`⏳ ${type === 'research' ? '科研' : '建设'}等级${currentLevel}资源已满足，开始升级，需用${requiredYears}年`, true);
            return;
        }
        
        // 计算自资源满足后经过的年数
        const resourceMetYear = gameState[`${type}ResourceMetYear`];
        const requiredYears = getRequiredYearsForLevel(currentLevel + 1, type);
        const yearsPassed = gameState.currentYear - resourceMetYear;
        
        if (yearsPassed < requiredYears) {
            // 等待年数未满足
            const yearsRemaining = requiredYears - yearsPassed;
            // 向控制台输出详细信息
            console.log(`${type === 'research' ? '科研' : '建设'}等级${currentLevel}升级条件：资源已满足，开始升级，需用${yearsRemaining}年`);
            return;
        }
        
        // 新增建设等级限制检查
        if (type === 'construction' && attr.researchLevel <= currentLevel) {
            addLog("⚠️ 建设等级已达到上限，请先提升科研等级！", true);
            return;
        }
        
        // 更新等级，重置资源满足记录，并记录升级年份
        attr[`${type}Level`]++;
        gameState.lastLevelUpgradeYear[type] = gameState.currentYear;
        gameState[`${type}ResourceMetYear`] = null; // 重置资源满足记录
        
        // 日志提示
        const typeName = type === 'research' ? '科研' : '建设';
        const nextRequiredYears = getRequiredYearsForLevel(attr[`${type}Level`] + 1, type);
        
        addLog(`🎉 ${typeName}等级提升到 ${attr[`${type}Level`]}! (下一级升级需用${nextRequiredYears}年)`, true);
    } else {
        // 资源不足，清除资源满足记录
        gameState[`${type}ResourceMetYear`] = null;
    }
}

// 获取指定等级需要等待的年数
function getRequiredYearsForLevel(level, type = null) {
    let yearRequirements;
    if (type === 'research') {
        yearRequirements = gameState.levelConfig.researchYearRequirements;
    } else if (type === 'construction') {
        yearRequirements = gameState.levelConfig.constructionYearRequirements;
    } else {
        // 如果未指定类型，使用研究年数要求作为默认值
        yearRequirements = gameState.levelConfig.researchYearRequirements;
    }
    
    if (!yearRequirements) return 0;
    
    // 直接获取该等级的等待年数，如果不存在则返回0
    return yearRequirements[level.toString()] || 0;
}

function clampAttributes() {
    const attr = gameState.attributes;
    
    // 基础属性限制
    attr.peopleSupport = Math.max(0, Math.min(attr.peopleSupport, 100));
    attr.security = Math.max(0, Math.min(attr.security, 100));
    attr.civilization = Math.max(0, Math.min(attr.civilization, 100));
    attr.resources = Math.max(0, attr.resources);
    attr.population = Math.max(0, attr.population);
    
    // 新增：等级下限保护
    attr.researchLevel = Math.max(1, attr.researchLevel);
    attr.constructionLevel = Math.max(1, attr.constructionLevel);
    attr.talentLevel = Math.max(1, attr.talentLevel);
}

/**
 * 更新游戏界面显示
 * @param {boolean} [withLog=true] 是否包含日志更新
 */
function updateDisplays(withLog = true) {
    const attr = gameState.attributes;
    
    // 更新属性显示
    if (isMobile) {
        updateDisplay('peopleSupport', `${attr.peopleSupport.toFixed(0)}%`);
        updateDisplay('security', `${attr.security.toFixed(0)}%`);
        updateDisplay('civilization', `${attr.civilization.toFixed(0)}%`);
    } else {
        updateDisplay('peopleSupport', attr.peopleSupport.toFixed(2));
        updateDisplay('security', attr.security.toFixed(2));
        updateDisplay('civilization', attr.civilization.toFixed(2));
    }
    updateDisplay('resources', formatNumber(attr.resources));
    updateDisplay('population', formatNumber(attr.population));
    updateDisplay('researchLevel', `${attr.researchLevel}级`);
    updateDisplay('constructionLevel', `${attr.constructionLevel}级`);
    updateDisplay('talentLevel', `${attr.talentLevel}级`);

    // 更新百分比属性的进度条
    updateProgressBar('peopleSupport-progress', attr.peopleSupport);
    updateProgressBar('security-progress', attr.security);
    updateProgressBar('civilization-progress', attr.civilization);

    // 更新等级和等待年数信息
    updateLevelInfo('research', attr.researchConsumedTotal);
    updateLevelInfo('construction', attr.constructionConsumedTotal);

    // 更新倒计时
    updateCountdown();
}

/**
 * 更新进度条显示
 * @param {string} id 进度条元素ID
 * @param {number} value 当前值(0-100)
 */
function updateProgressBar(id, value) {
    const progressBar = document.getElementById(id);
    if (progressBar) {
        // 确保百分比范围在0-100之间
        const percent = Math.min(Math.max(value, 0), 100);
        progressBar.style.width = `${percent}%`;
        
        // 根据百分比设置不同颜色
        if (percent < 20) {
            progressBar.style.backgroundColor = 'var(--accent-red)';
        } else if (percent < 50) {
            progressBar.style.backgroundColor = 'var(--accent-orange)';
        } else {
            progressBar.style.backgroundColor = 'var(--accent-green)';
        }
    }
}

// 新增：更新等级信息和等待年数显示
function updateLevelInfo(type, consumed) {
    const attr = gameState.attributes;
    const currentLevel = attr[`${type}Level`];
    const levelConfig = gameState.levelConfig[type];
    
    if (!levelConfig || currentLevel >= levelConfig.length) {
        return;
    }

    const required = levelConfig[currentLevel];
    
    // 更新进度条
    const progressElement = document.getElementById(`${type}LevelProgress`);
    if (progressElement) {
        const progress = Math.min(consumed / required * 100, 100);
        progressElement.style.width = `${progress}%`;
        
        // 根据进度调整颜色
        if (progress >= 100) {
            progressElement.style.backgroundColor = '#4caf50'; // 绿色
        } else if (progress >= 70) {
            progressElement.style.backgroundColor = '#ffc107'; // 黄色
        } else {
            progressElement.style.backgroundColor = '#f44336'; // 红色
        }
    }
    
    // 更新等待年数信息
    const waitingInfoElement = document.getElementById(`${type}LevelWaiting`);
    if (waitingInfoElement) {
        // 先显示等待信息元素
        waitingInfoElement.style.display = 'inline';
        
        // 只有当资源满足时才检查等待年数
        if (consumed >= required) {
            const resourceMetYear = gameState[`${type}ResourceMetYear`];
            const requiredYears = getRequiredYearsForLevel(currentLevel + 1, type);
            
            // 如果已经记录了资源满足的年份
            if (resourceMetYear) {
                const yearsPassed = gameState.currentYear - resourceMetYear;
                
                if (yearsPassed < requiredYears) {
                    const yearsRemaining = requiredYears - yearsPassed;
                    waitingInfoElement.textContent = `(升级中，还需 ${yearsRemaining} 年)`;
                    waitingInfoElement.style.color = '#ff9800'; // 橙色
                } else {
                    // 建设等级检查
                    if (type === 'construction' && attr.researchLevel <= currentLevel) {
                        waitingInfoElement.textContent = '(需提升科研等级)';
                        waitingInfoElement.style.color = '#f44336'; // 红色
                    } else {
                        waitingInfoElement.textContent = '(可升级)';
                        waitingInfoElement.style.color = '#4caf50'; // 绿色
                    }
                }
            } else {
                // 资源刚满足，显示需等待的总年数
                waitingInfoElement.textContent = `(升级中，还需 ${requiredYears} 年)`;
                waitingInfoElement.style.color = '#ff9800'; // 橙色
            }
        } else {
            // 资源不足
            const percentComplete = (consumed / required * 100).toFixed(1);
            waitingInfoElement.textContent = `(资源进度: ${percentComplete}%)`;
            waitingInfoElement.style.color = '#607d8b'; // 蓝灰色
        }
    }
}

/**
 * 更新属性显示
 * @param {string} id 属性ID
 * @param {string|number} value 要显示的值
 */
function updateDisplay(id, value) {
    const element = document.querySelector(`[data-attribute="${id}"] .attr-value`);
    if (element) element.textContent = value;
}

/**
 * 启动年度进度条动画
 * @param {Function} onComplete 进度条完成时的回调函数
 */
function startProgressBar(onComplete) {
    // 清除之前的进度条计时器（如果存在）
    if (gameState.progressInterval) {
        clearInterval(gameState.progressInterval);
        gameState.progressInterval = null;
    }
    
    // 获取进度条元素
    const progressElement = document.getElementById('yearProgress');
    const progressContainer = document.querySelector('.time-progress-container');
    
    if (!progressElement || !progressContainer) {
        console.error('进度条元素未找到');
        return;
    }
    
    // 移除完成类（以防之前的动画未完成）
    progressContainer.classList.remove('year-progress-complete');
    
    // 显示年份消息
    const yearMessage = document.getElementById('yearMessage');
    if (yearMessage) {
        yearMessage.textContent = `处理第 ${gameState.currentYear} 年...`;
    }
    
    // 重置进度条宽度
    progressElement.style.width = '0%';
    
    // 修改后的进度条动画逻辑
    let width = 0;
    const totalDuration = 10000; // 与年度周期同步(10秒)
    const stepInterval = 100;   // 每100ms更新一次
    const stepIncrement = 100 / (totalDuration / stepInterval); // 每步增加1%

    // 立即执行回调函数测试
    console.log('立即执行回调函数测试');
    if (typeof onComplete === 'function') {
        onComplete();
    }

    // 保存回调函数到gameState
    gameState.progressCallback = onComplete;

    gameState.progressInterval = setInterval(() => {
        width += stepIncrement;
        progressElement.style.width = `${width}%`;
        
        if (width >= 100) {
            clearInterval(gameState.progressInterval);
            gameState.progressInterval = null;
            progressContainer.classList.add('year-progress-complete');
            
            // 执行保存的回调函数
            console.log('准备执行进度条完成回调');
            if (typeof gameState.progressCallback === 'function') {
                console.log('开始执行回调函数');
                gameState.progressCallback();
                gameState.progressCallback = null;
                console.log('回调函数执行完成');
            } else {
                console.log('回调函数无效');
            }
            
            setTimeout(() => {
                progressContainer.classList.remove('year-progress-complete');
            }, 1000);
        }
    }, stepInterval);
}

/**
 * 更新游戏倒计时显示
 */
function updateCountdown() {
    const remainingYears = 4665 - gameState.currentYear;
    const countdownNumber = document.querySelector('.countdown-number');
    const countdownNumberEn = document.querySelector('.countdown-number-en');
    
    if (countdownNumber && countdownNumberEn) {
        countdownNumber.textContent = remainingYears;
        countdownNumberEn.textContent = remainingYears;
    }
}

// ================== 辅助工具 ==================
/**
 * 格式化数字显示(添加千位分隔符)
 * @param {number} num 要格式化的数字
 * @returns {string} 格式化后的字符串
 */
function formatNumber(num) {
    return Math.round(num).toLocaleString('en-US');
}

/**
 * 添加游戏日志
 * @param {string} message 日志内容
 * @param {boolean} [isWarning=false] 是否为警告日志
 */
function addLog(message, isWarning = false) {
    const log = document.getElementById('gameLog');
    const entry = document.createElement('div');
    entry.className = `log-entry${isWarning ? ' warning' : ''}`;
    entry.innerHTML = `<span class="log-year">${gameState.currentYear}</span> ${message}`;
    log.prepend(entry);
}

/**
 * 检查并显示游戏警告信息
 */
function checkWarnings() {
    const attr = gameState.attributes;
    const warnings = [
        [attr.peopleSupport < 20, `⚠️ 民心过低！当前值：${attr.peopleSupport.toFixed(2)}`],
        [attr.security < 20, `⚠️ 安全指数过低！当前值：${attr.security.toFixed(2)}`],
        [attr.civilization < 20, `⚠️ 文明指数过低！当前值：${attr.civilization.toFixed(2)}`],
        [attr.resources < 200000, `⚠️ 资源即将耗尽！当前剩余：${formatNumber(attr.resources)}`],
        [attr.population < 100000, `⚠️ 人口危机！当前人口：${formatNumber(attr.population)}`]
    ];
    warnings.forEach(([condition, message]) => condition && addLog(message, true));
}

// ================== 调试工具 ==================
function logDebugInfo() {
    // ... existing code ...
}

// ================== 工具提示系统 ==================
function initTooltips() {
    const tooltip = document.getElementById('tooltip');
    document.querySelectorAll('[data-tip]').forEach(element => {
        element.addEventListener('mouseenter', showTooltip);
        element.addEventListener('mouseleave', hideTooltip);
        
        // 修改触摸事件处理，实现长按显示tooltip而不影响点击
        let touchTimeout;
        let isTouchMoved = false;
        
        element.addEventListener('touchstart', (e) => {
            isTouchMoved = false;
            touchTimeout = setTimeout(() => {
                if (!isTouchMoved) {
                    showTooltip(e);
                    setTimeout(hideTooltip, 2000);
                }
            }, 500); // 500ms长按阈值
        });
        
        element.addEventListener('touchmove', () => {
            isTouchMoved = true;
            clearTimeout(touchTimeout);
        });
        
        element.addEventListener('touchend', () => {
            clearTimeout(touchTimeout);
        });
    });
}

function showTooltip(e) {
    const tooltip = document.getElementById('tooltip');
    tooltip.textContent = e.target.dataset.tip;
    tooltip.style.left = `${e.target.getBoundingClientRect().left}px`;
    tooltip.style.top = `${e.target.getBoundingClientRect().bottom + 5}px`;
    tooltip.style.display = 'block';
}

function hideTooltip() {
    document.getElementById('tooltip').style.display = 'none';
}

// ================== 策略系统 ==================
/**
 * 设置游戏策略
 * @param {string} strategy 策略名称
 */
function setStrategy(strategy) {
    gameState.strategy = strategy;
    document.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === strategy);
    });
    document.getElementById('currentStrategy').textContent = `当前策略：${strategy}`;
    addLog(`策略变更为：${strategy}`);
}

/**
 * 获取策略提示信息
 * @param {string} strategy 策略名称
 * @returns {string} 策略提示文本
 */
function getStrategyTip(strategy) {
    const tips = {
        "均衡发展": "平衡各项发展，无特殊加成",
        "高速发展": "⚡人口/工程消耗+30%，科研消耗+100%，安全+2/年，民心-2/年",
        "资源调控": "🔋人口消耗-30%，民心-1/年",
        "民生安定": "🏠人口消耗+30%，民心+1/年",
        "工程建设": "🏗️工程消耗+30%，安全+1/年",
        "科学研究": "🔬科研消耗+100%",
        "人才培养": "🎓人口消耗+50%，人才等级每年提升",
        "文化发展": "📚文明+1/年，民心+0.5/年，消耗文明值×10万资源"
    };
    return tips[strategy];
}

// ================== 新增游戏总结生成函数 ==================
/**
 * 生成游戏总结HTML
 * @param {number} totalYears 游戏总年数
 * @param {Object} attr 游戏属性对象
 * @returns {string} 游戏总结HTML
 */
function generateGameSummary(totalYears, attr) {
    const getStatusClass = (value, threshold) => value >= threshold ? 'positive' : 'negative';
    
    return `
        <div class="summary-section">
            <h3>📊 游戏总结</h3>
            <div class="summary-header">
                <p>🕒 结束年份：${gameState.currentYear}年</p>
                <p>⏱️ 存续时间：${totalYears}年</p>
            </div>
            <div class="final-stats">
                <p class="${getStatusClass(attr.population, 1000000)}">人口规模：${formatNumber(attr.population)}</p>
                <p class="${getStatusClass(attr.resources, 1000000)}">资源储备：${formatNumber(attr.resources)}</p>
                <p class="${getStatusClass(attr.researchLevel, 50)}">科研等级：${attr.researchLevel}</p>
                <p class="${getStatusClass(attr.constructionLevel, 50)}">建设等级：${attr.constructionLevel}</p>
                <p class="${getStatusClass(attr.talentLevel, 10)}">人才等级：${attr.talentLevel}</p>
                <p class="${getStatusClass(attr.peopleSupport, 50)}">民心指数：${attr.peopleSupport.toFixed(2)}</p>
                <p class="${getStatusClass(attr.security, 50)}">安全指数：${attr.security.toFixed(2)}</p>
                <p class="${getStatusClass(attr.civilization, 50)}">文明指数：${attr.civilization.toFixed(2)}</p>
            </div>
        </div>
    `;
}

// ================== 启动游戏 ==================
window.onload = initGame;
