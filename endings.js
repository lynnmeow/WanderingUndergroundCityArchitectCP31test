// ================== 结局系统 ==================
// 结局相关的函数定义为全局函数，便于其他文件调用
function checkEnding() {
    const attr = gameState.attributes;
    
    return (
        attr.population <= 500 || 
        attr.resources <= 0 || 
        attr.peopleSupport <= 0 || 
        attr.security <= 0 || 
        attr.civilization <= 0 || 
        gameState.currentYear >= 4665
    );
}

function determineEnding() {
    const attr = gameState.attributes;
    const currentYear = gameState.currentYear;
    
    const endings = [
        { condition: attr.population <= 500, info: getEnding(1) },
        { condition: attr.resources <= 0, info: getEnding(2) },
        { condition: attr.peopleSupport <= 0, info: getEnding(3) },
        { condition: attr.security <= 0, info: getEnding(4) },
        { condition: attr.civilization <= 0, info: getEnding(5) },
        { condition: currentYear >= 4665, info: getEnding(0) },
        { condition: attr.security > 90 && attr.peopleSupport > 90, info: getEnding(12) },
        { condition: attr.security > 50 && attr.security < 90 && 
                    attr.peopleSupport > 50 && attr.peopleSupport < 90, info: getEnding(21) },
        { condition: attr.security < 50 && attr.peopleSupport < 50, info: getEnding(22) },
        { condition: attr.security < 50 && attr.peopleSupport >= 50, info: getEnding(23) },
        { condition: attr.security >= 50 && attr.peopleSupport < 50, info: getEnding(24) },
        { condition: true, info: getEnding(-1) } // 默认结局
    ];

    return endings.find(e => e.condition).info;
}

function getEnding(id) {
    const endings = {
        0: { title: "抵达新家园", description: "经过2500年的漫长旅程，人类终于在新的星系建立了文明" },
        1: { title: "何为文明", description: "没有人的文明，毫无意义。" },
        2: { title: "快乐百年", description: "后代的事，与我何干？" },
        3: { title: "冰雕艺术家", description: "放逐，成为冰雕。" },
        4: { title: "我不活啦", description: "毫无防护的地下城，可能毁于任何意外。" },
        5: { title: "何为人？", description: "在流浪的尽头，人类要回答的不是'能否抵达'，而是'抵达后我们是否还配被称为人类'。" },
        12: { title: "未知希望", description: "在这里，真的可以看到蓝天、鲜花挂满枝头吗？" },
        21: { title: "沉默黑暗", description: "人类已经尽力了……" },
        22: { title: "微光熄灭", description: "勉强到达目标星系，却无力继续向前了……" },
        23: { title: "无尽寒冬", description: "虽然到达了目的地，但已无力防护自然灾害" },
        24: { title: "哗变反叛", description: "既然到达了目的地，这里不再需要管理者" },
        "-1": { title: "未知结局", description: "人类以未知的状态继续着他们的旅程……" }
    };
    return endings[id];
} 