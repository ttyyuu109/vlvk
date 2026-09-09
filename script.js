document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 기본 데이터 및 UI 관리 ---
    const gameState = {
        bp: 10000,
        inventory: [
            { id: 1, name: "조현우", pos: "GK", ovr: 80 },
            { id: 2, name: "김민재", pos: "DF", ovr: 85 },
            { id: 3, name: "이강인", pos: "MF", ovr: 82 },
            { id: 4, name: "손흥민", pos: "FW", ovr: 88 }
        ]
    };

    const startMatchBtn = document.getElementById('start-match-btn');
    const buyPackBtn = document.getElementById('buy-pack-btn');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas ? canvas.getContext('2d') : null;

    function resizeCanvas() {
        if (!canvas) return;
        const container = canvas.parentElement;
        if (container) {
            canvas.width = container.clientWidth || 900;
            canvas.height = container.clientHeight || 550;
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // 탭 전환 기능
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            
            const targetEl = document.getElementById(targetTab);
            if (targetEl) targetEl.classList.add('active');
            e.currentTarget.classList.add('active');
            
            if (targetTab === 'squad-tab') renderSquadUI();
        });
    });

    function updateHeader() {
        const bpEl = document.getElementById('user-bp');
        const valEl = document.getElementById('club-value');
        if (bpEl) bpEl.innerText = gameState.bp.toLocaleString();
        if (valEl) {
            const clubVal = gameState.inventory.reduce((acc, cur) => acc + (cur.ovr * 100), 0);
            valEl.innerText = clubVal.toLocaleString();
        }
    }

    function renderSquadUI() {
        const listEl = document.getElementById('player-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        gameState.inventory.forEach((player) => {
            const card = document.createElement('div');
            card.className = `player-card ${player.ovr >= 80 ? 'gold' : 'silver'}`;
            card.style.cssText = "padding: 10px; margin: 5px; border: 1px solid #ccc; background: #222; color: #fff; border-radius: 5px;";
            card.innerHTML = `<div><strong>[${player.pos}] ${player.name}</strong></div><div>OVR: ${player.ovr}</div>`;
            listEl.appendChild(card);
        });

        updateHeader();
    }

    // --- 상점 (팩 구매) 기능 ---
    if (buyPackBtn) {
        buyPackBtn.addEventListener('click', () => {
            if (gameState.bp < 1000) {
                alert("BP가 부족합니다!");
                return;
            }
            gameState.bp -= 1000;
            const positions = ["FW", "MF", "DF"];
            const newPlayer = {
                id: Date.now(),
                name: `선수_${Math.floor(Math.random() * 899 + 100)}`,
                pos: positions[Math.floor(Math.random() * positions.length)],
                ovr: Math.floor(Math.random() * 20) + 70
            };
            gameState.inventory.push(newPlayer);
            alert(`🎉 [선수 영입] ${newPlayer.name} (${newPlayer.pos}, OVR: ${newPlayer.ovr})`);
            renderSquadUI();
        });
    }

    // --- 2. 경기 시스템 변수 ---
    let isMatchRunning = false;
    let matchState = 'KICKOFF';
    let scoreHome = 0;
    let scoreAway = 0;
    let controlledIndex = 3;

    let gameTime = 0; 
    let timerInterval = null;

    const PLAYER_SPEED = 3.2;
    const BALL_FRICTION = 0.95;
    const MARGIN = 20; // 경기장 경계 마진
    const GOAL_WIDTH = 15;
    const GOAL_HEIGHT = 120;

    let homeTeam = [];
    let awayTeam = [];
    
    const ball = { 
        x: 450, 
        y: 275, 
        radius: 7, 
        vx: 0, 
        vy: 0, 
        owner: null,
        cooldownTimer: 0 
    };

    const keys = { Up: false, Down: false, Left: false, Right: false };

    // --- 3. 패스 및 슈팅 실행 함수 ---
    function doPass() {
        if (!isMatchRunning) return;
        if (matchState === 'KICKOFF') matchState = 'PLAYING';

        const cp = homeTeam[controlledIndex];
        if (!cp) return;

        let targetPlayer = null;
        let minDist = Infinity;

        homeTeam.forEach((teammate, idx) => {
            if (idx === controlledIndex) return;
            const dist = Math.hypot(teammate.x - cp.x, teammate.y - cp.y);
            if (dist < minDist) {
                minDist = dist;
                targetPlayer = teammate;
            }
        });

        ball.owner = null;
        ball.cooldownTimer = 20;

        if (targetPlayer) {
            const angle = Math.atan2(targetPlayer.y - cp.y, targetPlayer.x - cp.x);
            ball.x = cp.x + Math.cos(angle) * 18;
            ball.y = cp.y + Math.sin(angle) * 18;
            ball.vx = Math.cos(angle) * 18.0;
            ball.vy = Math.sin(angle) * 18.0;

            homeTeam.forEach(p => p.isControlled = false);
            targetPlayer.isControlled = true;
            controlledIndex = homeTeam.indexOf(targetPlayer);
        } else {
            const angle = cp.facingAngle;
            ball.x = cp.x + Math.cos(angle) * 18;
            ball.y = cp.y + Math.sin(angle) * 18;
            ball.vx = Math.cos(angle) * 16.0;
            ball.vy = Math.sin(angle) * 16.0;
        }
    }

    function doShoot() {
        if (!isMatchRunning) return;
        if (matchState === 'KICKOFF') matchState = 'PLAYING';

        const cp = homeTeam[controlledIndex];
        if (!cp) return;

        ball.owner = null;
        ball.cooldownTimer = 25;

        const goalX = canvas.width - MARGIN;
        const goalY = canvas.height / 2 + (Math.random() * 40 - 20);
        
        const angle = Math.atan2(goalY - cp.y, goalX - cp.x);
        ball.x = cp.x + Math.cos(angle) * 18;
        ball.y = cp.y + Math.sin(angle) * 18;
        ball.vx = Math.cos(angle) * 24.0;
        ball.vy = Math.sin(angle) * 24.0;
    }

    // --- 4. 조작 입력 이벤트 ---
    window.addEventListener('keydown', e => {
        const key = e.key.toLowerCase();

        if (e.code === 'ArrowUp' || key === 'w' || key === 'ㅈ') keys.Up = true;
        if (e.code === 'ArrowDown' || key === 's' || key === 'ㄴ') keys.Down = true;
        if (e.code === 'ArrowLeft' || key === 'a' || key === 'ㅁ') keys.Left = true;
        if (e.code === 'ArrowRight' || key === 'd' || key === 'ㅇ') keys.Right = true;

        if (e.code === 'Tab' || key === 'q' || key === 'ㅂ') {
            e.preventDefault();
            switchControlledPlayer();
        }

        if (key === 's' || key === 'ㄴ') doPass();
        if (key === 'd' || key === 'ㅇ') doShoot();
    });

    window.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (e.code === 'ArrowUp' || key === 'w' || key === 'ㅈ') keys.Up = false;
        if (e.code === 'ArrowDown' || key === 's' || key === 'ㄴ') keys.Down = false;
        if (e.code === 'ArrowLeft' || key === 'a' || key === 'ㅁ') keys.Left = false;
        if (e.code === 'ArrowRight' || key === 'd' || key === 'ㅇ') keys.Right = false;
    });

    if (canvas) {
        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) doPass();
            else if (e.button === 2) doShoot();
        });
        canvas.addEventListener('contextmenu', e => e.preventDefault());
    }

    // --- 5. 경기 세팅 및 진행 ---
    const homeFormations = [
        { role: 'GK', baseX: 0.08, baseY: 0.50 },
        { role: 'DF', baseX: 0.22, baseY: 0.50 },
        { role: 'MF', baseX: 0.38, baseY: 0.28 },
        { role: 'FW', baseX: 0.46, baseY: 0.72 }
    ];

    const awayFormations = [
        { role: 'GK', baseX: 0.92, baseY: 0.50 },
        { role: 'DF', baseX: 0.78, baseY: 0.50 },
        { role: 'MF', baseX: 0.62, baseY: 0.72 },
        { role: 'FW', baseX: 0.54, baseY: 0.28 }
    ];

    const aiNames = ["알리송", "반다이크", "덕배", "홀란드"];

    function initTeams() {
        homeTeam = [];
        awayTeam = [];
        const w = canvas ? canvas.width : 900;
        const h = canvas ? canvas.height : 550;

        for (let i = 0; i < 4; i++) {
            const pData = gameState.inventory[i] || { name: `선수_${i+1}`, pos: 'MF' };
            
            homeTeam.push({
                x: w * homeFormations[i].baseX,
                y: h * homeFormations[i].baseY,
                baseX: homeFormations[i].baseX,
                baseY: homeFormations[i].baseY,
                role: homeFormations[i].role,
                name: pData.name,
                team: 'home',
                isControlled: i === 3,
                facingAngle: 0,
                speed: 1.8 + Math.random() * 0.4,
                aiSeed: Math.random() * 100
            });

            awayTeam.push({
                x: w * awayFormations[i].baseX,
                y: h * awayFormations[i].baseY,
                baseX: awayFormations[i].baseX,
                baseY: awayFormations[i].baseY,
                role: awayFormations[i].role,
                name: aiNames[i],
                team: 'away',
                isControlled: false,
                facingAngle: Math.PI,
                speed: 1.8 + Math.random() * 0.4,
                aiSeed: Math.random() * 100
            });
        }
        controlledIndex = 3;
    }

    function resetToKickoff() {
        resizeCanvas();
        initTeams();
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.vx = 0;
        ball.vy = 0;
        ball.owner = homeTeam[controlledIndex];
        ball.cooldownTimer = 0;
        matchState = 'KICKOFF';
    }

    function switchControlledPlayer() {
        homeTeam.forEach(p => p.isControlled = false);
        let closestIdx = 3;
        let minDist = Infinity;

        homeTeam.forEach((p, idx) => {
            if (p.role === 'GK') return; 
            const d = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (d < minDist) {
                minDist = d;
                closestIdx = idx;
            }
        });

        controlledIndex = closestIdx;
        homeTeam[controlledIndex].isControlled = true;
    }

    if (startMatchBtn) {
        startMatchBtn.addEventListener('click', () => {
            isMatchRunning = true;
            scoreHome = 0;
            scoreAway = 0;
            gameTime = 0;
            startMatchBtn.innerText = "경기 진행 중...";
            
            resetToKickoff();
            startTimer();
            gameLoop();
        });
    }

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (matchState === 'PLAYING') {
                gameTime++;
                let min = Math.floor(gameTime / 2);
                let sec = (gameTime % 2) * 30;
                const timerEl = document.getElementById('match-timer');
                if (timerEl) timerEl.innerText = `${min < 10 ? '0' + min : min}:${sec === 0 ? '00' : sec}`;

                if (gameTime >= 180) {
                    clearInterval(timerInterval);
                    matchState = 'ENDED';
                    alert(`경기 종료! 최종 스코어 ${scoreHome} : ${scoreAway}`);
                    if (startMatchBtn) startMatchBtn.innerText = "경기 시작";
                    isMatchRunning = false;
                }
            }
        }, 1000);
    }

    // 선수 경기장 이탈 방지 처리 함수
    function constrainPlayerToBounds(p) {
        const radius = 10;
        p.x = Math.max(MARGIN + radius, Math.min(canvas.width - MARGIN - radius, p.x));
        p.y = Math.max(MARGIN + radius, Math.min(canvas.height - MARGIN - radius, p.y));
    }

    function updateIndependentAI(team) {
        const now = Date.now() * 0.002;

        team.forEach((p) => {
            if (p.isControlled || p === ball.owner) {
                constrainPlayerToBounds(p);
                return;
            }

            let targetX = canvas.width * p.baseX;
            let targetY = canvas.height * p.baseY;

            if (p.role === 'GK') {
                targetY = canvas.height / 2 + (ball.y - canvas.height / 2) * 0.4;
                targetY = Math.max(canvas.height / 2 - 50, Math.min(canvas.height / 2 + 50, targetY));
            } else if (p.role === 'DF') {
                targetX = canvas.width * p.baseX + (ball.x - canvas.width / 2) * 0.2;
                targetY = canvas.height * p.baseY + Math.sin(now + p.aiSeed) * 30;
                if (Math.hypot(p.x - ball.x, p.y - ball.y) < 100) {
                    targetX = ball.x;
                    targetY = ball.y;
                }
            } else {
                const wanderX = Math.cos(now + p.aiSeed) * 40;
                const wanderY = Math.sin(now * 1.5 + p.aiSeed) * 50;

                if (!ball.owner) {
                    targetX = ball.x + wanderX;
                    targetY = ball.y + wanderY;
                } else {
                    targetX = canvas.width * p.baseX + (ball.x - canvas.width / 2) * 0.4 + wanderX;
                    targetY = canvas.height * p.baseY + wanderY;
                }
            }

            const dist = Math.hypot(targetX - p.x, targetY - p.y);
            if (dist > 5) {
                const angle = Math.atan2(targetY - p.y, targetX - p.x);
                p.x += Math.cos(angle) * p.speed;
                p.y += Math.sin(angle) * p.speed;
                p.facingAngle = angle;
            }

            constrainPlayerToBounds(p);
        });
    }

    function handleEnemyDecision() {
        if (ball.owner && ball.owner.team === 'away') {
            const enemy = ball.owner;

            if (enemy.x < canvas.width * 0.35) {
                ball.owner = null;
                ball.cooldownTimer = 25;
                const angle = Math.atan2(canvas.height / 2 - ball.y, MARGIN - ball.x);
                ball.vx = Math.cos(angle) * 16;
                ball.vy = Math.sin(angle) * 16;
            } else if (Math.random() < 0.012) {
                let teammate = awayTeam.find(p => p !== enemy && p.role !== 'GK');
                if (teammate) {
                    ball.owner = null;
                    ball.cooldownTimer = 25;
                    const angle = Math.atan2(teammate.y - ball.y, teammate.x - ball.x);
                    ball.vx = Math.cos(angle) * 13;
                    ball.vy = Math.sin(angle) * 13;
                }
            }
        }
    }

    function updateGameLogic() {
        if (matchState !== 'PLAYING' && matchState !== 'KICKOFF') return;

        if (ball.cooldownTimer > 0) {
            ball.cooldownTimer--;
        }

        const cp = homeTeam[controlledIndex];
        if (cp) {
            let dx = 0, dy = 0;
            if (keys.Up) dy -= 1;
            if (keys.Down) dy += 1;
            if (keys.Left) dx -= 1;
            if (keys.Right) dx += 1;

            if (dx !== 0 && dy !== 0) {
                dx *= 0.7071;
                dy *= 0.7071;
            }

            if (dx !== 0 || dy !== 0) {
                cp.x += dx * PLAYER_SPEED;
                cp.y += dy * PLAYER_SPEED;
                cp.facingAngle = Math.atan2(dy, dx);
            }
            constrainPlayerToBounds(cp);
        }

        if (ball.owner) {
            const offsetDist = 12;
            ball.x = ball.owner.x + Math.cos(ball.owner.facingAngle) * offsetDist;
            ball.y = ball.owner.y + Math.sin(ball.owner.facingAngle) * offsetDist;
            ball.vx = 0;
            ball.vy = 0;
        } else {
            ball.x += ball.vx;
            ball.y += ball.vy;
            ball.vx *= BALL_FRICTION;
            ball.vy *= BALL_FRICTION;

            if (ball.cooldownTimer <= 0) {
                [...homeTeam, ...awayTeam].forEach(p => {
                    const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
                    if (dist < 22) {
                        ball.owner = p;
                        if (p.team === 'home') {
                            homeTeam.forEach(hp => hp.isControlled = false);
                            p.isControlled = true;
                            controlledIndex = homeTeam.indexOf(p);
                        }
                    }
                });
            }
        }

        updateIndependentAI(homeTeam);
        updateIndependentAI(awayTeam);
        handleEnemyDecision();

        // 득점 판정 및 공 벽 충돌
        const goalTop = canvas.height / 2 - GOAL_HEIGHT / 2;
        const goalBottom = canvas.height / 2 + GOAL_HEIGHT / 2;

        if (ball.x >= canvas.width - MARGIN) {
            if (ball.y > goalTop && ball.y < goalBottom) {
                scoreHome++;
                resetToKickoff();
            } else {
                ball.x = canvas.width - MARGIN;
                ball.vx *= -0.7;
            }
        }
        if (ball.x <= MARGIN) {
            if (ball.y > goalTop && ball.y < goalBottom) {
                scoreAway++;
                resetToKickoff();
            } else {
                ball.x = MARGIN;
                ball.vx *= -0.7;
            }
        }

        if (ball.y <= MARGIN) {
            ball.y = MARGIN;
            ball.vy *= -0.7;
        }
        if (ball.y >= canvas.height - MARGIN) {
            ball.y = canvas.height - MARGIN;
            ball.vy *= -0.7;
        }

        const scoreEl = document.getElementById('score');
        if (scoreEl) scoreEl.innerText = `${scoreHome} : ${scoreAway}`;
    }

    function drawPlayer(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.facingAngle);

        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fillStyle = p.team === 'home' ? '#1e88e5' : '#e53935';
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x, p.y - 15);

        if (p.isControlled) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 25);
            ctx.lineTo(p.x - 6, p.y - 33);
            ctx.lineTo(p.x + 6, p.y - 33);
            ctx.fillStyle = "#00ff87";
            ctx.fill();
        }
    }

    function drawField() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 잔디 배경
        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 경기장 외곽선
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 3;
        ctx.strokeRect(MARGIN, MARGIN, canvas.width - (MARGIN * 2), canvas.height - (MARGIN * 2));

        // 센터 라인 및 센터 서클
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, MARGIN);
        ctx.lineTo(canvas.width / 2, canvas.height - MARGIN);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 55, 0, Math.PI * 2);
        ctx.stroke();

        // --- 골대 세팅 및 그리기 ---
        const goalTop = canvas.height / 2 - GOAL_HEIGHT / 2;

        // 왼쪽 골대 (원정팀 진영)
        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fillRect(MARGIN - GOAL_WIDTH, goalTop, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.strokeRect(MARGIN - GOAL_WIDTH, goalTop, GOAL_WIDTH, GOAL_HEIGHT);

        // 오른쪽 골대 (홈팀 진영)
        ctx.fillRect(canvas.width - MARGIN, goalTop, GOAL_WIDTH, GOAL_HEIGHT);
        ctx.strokeRect(canvas.width - MARGIN, goalTop, GOAL_WIDTH, GOAL_HEIGHT);

        // 선수 및 공 그리기
        homeTeam.forEach(p => drawPlayer(p));
        awayTeam.forEach(p => drawPlayer(p));

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (matchState === 'KICKOFF') {
            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 30, 400, 45);
            ctx.fillStyle = "#00ff87";
            ctx.font = "bold 15px Arial";
            ctx.textAlign = "center";
            ctx.fillText("S키 또는 마우스 클릭 시 즉시 시작 및 패스!", canvas.width / 2, canvas.height / 2 - 2);
        }
    }

    function gameLoop() {
        if (!isMatchRunning) return;
        updateGameLogic();
        drawField();
        requestAnimationFrame(gameLoop);
    }

    initTeams();
    renderSquadUI();
    drawField();
});
