document.addEventListener('DOMContentLoaded', () => {

    // --- 获取所有需要的 DOM 元素 ---
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const messageBox = document.getElementById('message-box');
    const messageTitle = document.getElementById('message-title');
    const messageText = document.getElementById('message-text');
    const restartButton = document.getElementById('restart-button');
    const levelDisplay = document.getElementById('level-display');
    const resetButtonIngame = document.getElementById('reset-button-ingame');
    const levelSelectButton = document.getElementById('level-select-button');
    const levelSelectOverlay = document.getElementById('level-select-overlay');
    const levelGrid = document.getElementById('level-grid');
    const closeLevelSelectButton = document.getElementById('close-level-select');
    const toastMessage = document.getElementById('toast-message');
    const dPadUp = document.getElementById('d-pad-up');
    const dPadDown = document.getElementById('d-pad-down');
    const dPadLeft = document.getElementById('d-pad-left');
    const dPadRight = document.getElementById('d-pad-right');
    // **关键修改：移除了对 portalImage 的获取**

    const GRID_SIZE = 30;
    const COLS = canvas.width / GRID_SIZE;
    const ROWS = canvas.height / GRID_SIZE;

    // 加载苹果图片
    const appleImage = new Image();
    appleImage.src = 'apple-icon.png';
    let appleImageLoaded = false;
    appleImage.onload = () => {
        appleImageLoaded = true;
    };

    // --- 游戏状态变量 ---
    let snake, apple, portal, walls, wallSet;
    let nextDirection;
    let gameOver;
    let gameLoopInterval;
    let currentLevel = 1;
    let snakeRenderOffset = { x: 0, y: 0 };
    let isBouncing = false;
    let isAnimatingPortal = false;
    // **核心修改：重新引入这些动画变量**
    let portalAnimationCounter = 0;
    let portalScale = 1.0;
    let portalRotation = 0;

    // --- 关卡数据 (5关) ---
    const allLevels = [
        ["               ","               ","               ","               ","               ","               ","               ","               ","               ","       A       ","  S           P","WWWWWW   WWWWWW","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               "],
        ["               ","               ","               ","               ","               ","               ","               ","           P   ","        WWWW   ","        W      "," A   WWWW      ","     W         ","  S  W         ","  WWWW         ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               "],
        ["               ","               ","               ","               ","               ","               ","               ","               ","               ","             P ","       WW WWWW ","       WA W    ","    S     W    ","  WWWWWWW W    ","        WWW    ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               "],
        ["               ","               ","               ","               ","               ","               ","               ","               ","               ","    S          ","    WW WW W    ","    W   W P    ","    W A W      ","    WWWWW      ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               "],
        ["               ","               ","               ","               ","               ","               ","               ","            P  ","               ","    S          ","  WWW WWW W    ","    W  A  W    ","    W WWW W    ","    WWW W W    ","        WWW    ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               ","               "]
    ];

    // --- 进度管理 ---
    function getHighestUnlockedLevel() { const saved = localStorage.getItem('snakeGameProgress'); return saved ? parseInt(saved, 10) : 1; }
    function saveProgress(level) { localStorage.setItem('snakeGameProgress', level); }

    // --- 游戏核心逻辑 ---
    function init() {
        snake = []; walls = []; wallSet = new Set();
        nextDirection = { x: 0, y: 0 }; gameOver = false;
        apple = null; portal = null;
        snakeRenderOffset = { x: 0, y: 0 }; isBouncing = false;
        isAnimatingPortal = false;
        portalAnimationCounter = 0; portalScale = 1.0; portalRotation = 0;

        messageBox.classList.add('hidden');
        levelDisplay.textContent = `关卡 ${currentLevel}`;
        const levelLayout = allLevels[currentLevel - 1];
        if (!levelLayout) { endGame("全部通关!", "你太棒了！请期待更新。"); return; }
        levelLayout.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const char = row[x]; if (char === 'S') { snake.push({ x: x, y: y }, { x: x - 1, y: y }, { x: x - 2, y: y }); } else if (char === 'W') { wallSet.add(`${x},${y}`); walls.push({ x, y }); } else if (char === 'A') { apple = { x: x, y: y }; } else if (char === 'P') { portal = { x: x, y: y }; } } });
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, 50);
    }

    function gameLoop() {
        if (gameOver) { clearInterval(gameLoopInterval); return; }
        portalRotation += 0.05;
        if (portalRotation > Math.PI * 2) { portalRotation -= Math.PI * 2; }
        if (!isAnimatingPortal) { update(); } else { portalAnimationCounter++; }
        draw();
    }

    function update() { let ateApple = false; if (nextDirection.x !== 0 || nextDirection.y !== 0) { const head = { x: snake[0].x + nextDirection.x, y: snake[0].y + nextDirection.y }; if (!isMoveInvalid(head)) { snake.unshift(head); if (portal && head.x === portal.x && head.y === portal.y) { startPortalAnimation(); return; } if (apple && head.x === apple.x && head.y === apple.y) { apple = null; ateApple = true; } if (!ateApple) { snake.pop(); } } nextDirection = { x: 0, y: 0 }; } applySingleStepGravity(); checkLoseCondition(); }
    function isMoveInvalid(head) { if (wallSet.has(`${head.x},${head.y}`)) return true; if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return true; for (const segment of snake) { if (head.x === segment.x && head.y === segment.y) return true; } return false; }
    function applySingleStepGravity() { let isStable = false; for (const segment of snake) { const supportCoord = { x: segment.x, y: segment.y + 1 }; const hasWallSupport = wallSet.has(`${supportCoord.x},${supportCoord.y}`); const hasAppleSupport = apple && apple.x === supportCoord.x && apple.y === supportCoord.y; if (hasWallSupport || hasAppleSupport) { isStable = true; break; } } if (!isStable) { for (const segment of snake) { segment.y++; } } }
    function checkLoseCondition() { for (const segment of snake) { if (segment.y >= ROWS) { endGame("游戏失败", "蛇从平台上掉下去了！"); return; } } }
    function startPortalAnimation() { if (isAnimatingPortal) return; isAnimatingPortal = true; portalScale = 1.5; const animationInterval = setInterval(() => { if (snake.length > 0) { snake.pop(); } else { clearInterval(animationInterval); setTimeout(() => { const nextLevel = currentLevel + 1; if (nextLevel > getHighestUnlockedLevel()) { saveProgress(nextLevel); } currentLevel = nextLevel; init(); }, 150); } }, 100); }

    // --- UI 和事件处理 ---
    function openLevelSelect() { levelSelectOverlay.classList.remove('hidden'); generateLevelButtons(); }
    function closeLevelSelect() { levelSelectOverlay.classList.add('hidden'); }
    function generateLevelButtons() { levelGrid.innerHTML = ''; const highestUnlocked = getHighestUnlockedLevel(); for (let i = 1; i <= allLevels.length; i++) { const btn = document.createElement('button'); btn.classList.add('level-btn'); btn.dataset.level = i; if (i < highestUnlocked) { btn.classList.add('completed'); btn.textContent = String(i).padStart(2, '0'); } else if (i === highestUnlocked) { btn.classList.add('unlocked'); btn.textContent = String(i).padStart(2, '0'); } else { btn.classList.add('locked'); btn.textContent = '🔒'; } levelGrid.appendChild(btn); } }
    function handleLevelSelect(e) { if (!e.target.classList.contains('level-btn')) return; const btn = e.target; if (btn.classList.contains('locked')) { showToast("关卡未解锁"); return; } const level = parseInt(btn.dataset.level, 10); currentLevel = level; closeLevelSelect(); init(); }
    function showToast(message) { toastMessage.textContent = message; toastMessage.classList.remove('hidden'); setTimeout(() => { toastMessage.classList.add('hidden'); }, 2000); }

    // --- 绘制函数 ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // drawNightSky();
        walls.forEach(wall => drawRect(wall.x, wall.y, '#8B4513'));
        if (apple) drawApple(apple.x, apple.y);
        if (portal) drawPortal(portal.x, portal.y);
        snake.forEach((segment, index) => { if (index === 0 && !isAnimatingPortal) { drawSnakeHead(segment.x, segment.y); } else { drawAnimatedRect(segment.x, segment.y, '#2E8B57'); } });
    }

    function drawRect(gridX, gridY, color) { ctx.fillStyle = color; ctx.fillRect(gridX * GRID_SIZE, gridY * GRID_SIZE, GRID_SIZE, GRID_SIZE); ctx.strokeStyle = '#3a2e0a'; ctx.strokeRect(gridX * GRID_SIZE, gridY * GRID_SIZE, GRID_SIZE, GRID_SIZE); }
    function drawAnimatedRect(gridX, gridY, color) { const renderX = gridX * GRID_SIZE + snakeRenderOffset.x; const renderY = gridY * GRID_SIZE + snakeRenderOffset.y; ctx.fillStyle = color; ctx.fillRect(renderX, renderY, GRID_SIZE, GRID_SIZE); ctx.strokeStyle = '#3a2e0a'; ctx.strokeRect(renderX, renderY, GRID_SIZE, GRID_SIZE); }
    function drawSnakeHead(gridX, gridY) { drawAnimatedRect(gridX, gridY, '#3CB371'); const eyeBaseX = gridX * GRID_SIZE + snakeRenderOffset.x; const eyeBaseY = gridY * GRID_SIZE + snakeRenderOffset.y; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(eyeBaseX + GRID_SIZE / 3, eyeBaseY + GRID_SIZE / 3, GRID_SIZE / 8, 0, 2 * Math.PI); ctx.arc(eyeBaseX + (GRID_SIZE * 2) / 3, eyeBaseY + GRID_SIZE / 3, GRID_SIZE / 8, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(eyeBaseX + GRID_SIZE / 3, eyeBaseY + GRID_SIZE / 3, GRID_SIZE / 16, 0, 2 * Math.PI); ctx.arc(eyeBaseX + (GRID_SIZE * 2) / 3, eyeBaseY + GRID_SIZE / 3, GRID_SIZE / 16, 0, 2 * Math.PI); ctx.fill(); }
    function drawApple(gridX, gridY) {
        const x = gridX * GRID_SIZE;
        const y = gridY * GRID_SIZE;
        if (appleImageLoaded) {
            ctx.drawImage(appleImage, x, y, GRID_SIZE, GRID_SIZE);
        } else {
            const centerX = x + GRID_SIZE / 2;
            const centerY = y + GRID_SIZE / 2;
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(centerX, centerY, GRID_SIZE / 2.5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    function drawPortal(gridX, gridY) {
        const centerX = gridX * GRID_SIZE + GRID_SIZE / 2;
        const centerY = gridY * GRID_SIZE + GRID_SIZE / 2;
        let baseRadius = GRID_SIZE / 2.2;
        if (isAnimatingPortal) {
            baseRadius = (baseRadius * portalScale) + (Math.sin(portalAnimationCounter * 0.2) * 2);
        }
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(portalRotation);
        ctx.strokeStyle = '#483D8B';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(0, 0, (baseRadius * 0.8) * (i / 5), i, i + 4);
            ctx.stroke();
        }
        ctx.restore();
    }
    function drawNightSky() { for (let i = 0; i < 100; i++) { const x = Math.random() * canvas.width; const y = Math.random() * canvas.height; const radius = Math.random() * 1.5; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(x, y, radius, 0, 2 * Math.PI); ctx.fill(); } }
    function endGame(title, text) { if (gameOver) return; gameOver = true; setTimeout(() => { messageTitle.textContent = title; messageText.textContent = text; messageBox.classList.remove('hidden'); }, 200); }
    function triggerBounceAnimation() { if (isBouncing) return; isBouncing = true; const bounceHeight = -GRID_SIZE / 3; snakeRenderOffset.y = bounceHeight; setTimeout(() => { snakeRenderOffset.y = 0; isBouncing = false; }, 100); }

    function canAcceptInput() { return !gameOver && (nextDirection.x === 0 && nextDirection.y === 0) && !isBouncing && !isAnimatingPortal; }
    function handleUpInput() { if (!canAcceptInput()) return; const head = snake[0]; let isVertical = true; for (let i = 1; i < snake.length; i++) { if (snake[i].x !== head.x) { isVertical = false; break; } } if (isVertical) { triggerBounceAnimation(); return; } const targetPos = { x: head.x, y: head.y - 1 }; if (isMoveInvalid(targetPos)) { triggerBounceAnimation(); } else { nextDirection = { x: 0, y: -1 }; } }
    function handleDownInput() { if (!canAcceptInput()) return; nextDirection = { x: 0, y: 1 }; }
    function handleLeftInput() { if (!canAcceptInput()) return; nextDirection = { x: -1, y: 0 }; }
    function handleRightInput() { if (!canAcceptInput()) return; nextDirection = { x: 1, y: 0 }; }

    document.addEventListener('keydown', e => { switch (e.key) { case 'ArrowUp': handleUpInput(); break; case 'ArrowDown': handleDownInput(); break; case 'ArrowLeft': handleLeftInput(); break; case 'ArrowRight': handleRightInput(); break; } });
    dPadUp.addEventListener('click', handleUpInput);
    dPadDown.addEventListener('click', handleDownInput);
    dPadLeft.addEventListener('click', handleLeftInput);
    dPadRight.addEventListener('click', handleRightInput);
    restartButton.addEventListener('click', init);
    resetButtonIngame.addEventListener('click', init);
    levelSelectButton.addEventListener('click', openLevelSelect);
    closeLevelSelectButton.addEventListener('click', closeLevelSelect);
    levelGrid.addEventListener('click', handleLevelSelect);

    currentLevel = getHighestUnlockedLevel();
    init();

});