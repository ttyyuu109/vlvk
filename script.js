document.addEventListener('DOMContentLoaded', () => {
    // --- 1. 기본 스쿼드 데이터 ---
    const gameState = {
        bp: 10000,
        inventory: [
            { id: 1, name: "조현우", pos: "GK", ovr: 80 },
            { id: 2, name: "설영우", pos: "LB", ovr: 77 },
            { id: 3, name: "김민재", pos: "CB", ovr: 85 },
            { id: 4, name: "영권", pos: "CB", ovr: 79 },
            { id: 5, name: "김진수", pos: "RB", ovr: 76 },
            { id: 6, name: "황인범", pos: "DM", ovr: 81 },
            { id: 7, name: "이강인", pos: "CM", ovr: 82 },
            { id: 8, name: "박지성", pos: "CM", ovr: 86 },
            { id: 9, name: "손흥민", pos: "LW", ovr: 88 },
            { id: 10, name: "조규성", pos: "ST", ovr: 78 },
            { id: 11, name: "황희찬", pos: "RW", ovr: 80 }
        ]
    };

    const startMatchBtn = document.getElementById('start-match-btn');
    const buyPackBtn = document.getElementById('buy-pack-btn');
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        const container = canvas.parentElement;
        if (container) {
            canvas.width = container.clientWidth || 900;
            canvas.height = container.clientHeight || 550;
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
            e.currentTarget.classList.add('active');
            if (targetTab === 'squad-tab') renderSquadUI();
        });
    });

    function updateHeader() {
        document.getElementById('user-bp').innerText = gameState.bp.toLocaleString();
        const clubVal = gameState.inventory.reduce((acc, cur) => acc + (cur.ovr * 100), 0);
        document.getElementById('club-value').innerText = clubVal.toLocaleString();
    }

    function renderSquadUI() {
        const listEl = document.getElementById('player-list');
        if (!listEl) return;
        listEl.innerHTML = '';

        gameState.inventory.forEach((player) => {
            const card = document.createElement('div');
            card.className = `player-card ${player.ovr >= 80 ? 'gold' : 'silver'}`;
            card.innerHTML = `<div><strong>[${player.pos}] ${player.name}</strong></div><div><strong>OVR ${player.ovr}</strong></div>`;
            listEl.appendChild(card);
        });

        updateHeader();
    }

    buyPackBtn.addEventListener('click', () => {
        if (gameState.bp < 1000) return alert("BP가 부족합니다!");
        gameState.bp -= 1000;
        const randomOvr = Math.floor(Math.random() * 20) + 70;
        const newPlayer = {
            id: Date.now(),
            name: `선수_${Math.floor(Math.random() * 1000)}`,
            pos: ["FW", "MF", "DF"][Math.floor(Math.random() * 3)],
            ovr: randomOvr
        };

        gameState.inventory.push(newPlayer);
        alert(`[영입 완료] ${newPlayer.name} (OVR: ${newPlayer.ovr})`);
        renderSquadUI();
    });

    // --- 2. 게임 상태 및 조작 ---
    let isMatchRunning = false;
    let matchState = 'KICKOFF';
    let scoreHome = 0;
    let scoreAway = 0;
    let controlledIndex = 9;

    let gameTime = 0; 
    let currentHalf = 1;
    let timerInterval = null;

    const PLAYER_SPEED = 2.4;
    const BALL_FRICTION = 0.95;

    let homeTeam = [];
    let awayTeam = [];
    const ball = { x: canvas.width / 2, y: canvas.height / 2, radius: 7, vx: 0, vy: 0, owner: null };

    const keys = { Up: false, Down: false, Left: false, Right: false };

    // 키보드 입력 처리
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

        // S키 : 킥오프 또는 패스
        if (key === 's' || key === 'ㄴ') {
            if (isMatchRunning) {
                if (matchState === 'KICKOFF') {
                    matchState = 'PLAYING';
                    ball.owner = homeTeam[controlledIndex];
                } else {
                    executePass();
                }
            }
        }

        // D키 : 슈팅
        if (key === 'd' || key === 'ㅇ') {
            if (isMatchRunning && matchState === 'PLAYING') {
                executeShoot();
            }
        }
    });

    window.addEventListener('keyup', e => {
        const key = e.key.toLowerCase();
        if (e.code === 'ArrowUp' || key === 'w' || key === 'ㅈ') keys.Up = false;
        if (e.code === 'ArrowDown' || key === 's' || key === 'ㄴ') keys.Down = false;
        if (e.code === 'ArrowLeft' || key === 'a' || key === 'ㅁ') keys.Left = false;
        if (e.code === 'ArrowRight' || key === 'd' || key === 'ㅇ') keys.Right = false;
    });

    // 마우스 클릭 조작 지원 (좌클릭 패스 / 우클릭 슛)
    canvas.addEventListener('click', (e) => {
        if (!isMatchRunning) return;
        if (matchState === 'KICKOFF') {
            matchState = 'PLAYING';
            ball.owner = homeTeam[controlledIndex];
            return;
        }
        executePass();
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (isMatchRunning && matchState === 'PLAYING') {
            executeShoot();
        }
    });

    const homeFormations = [
        { role: 'GK', x: 0.05, y: 0.50 },
        { role: 'DF', x: 0.18, y: 0.15 }, { role: 'DF', x: 0.15, y: 0.38 },
        { role: 'DF', x: 0.15, y: 0.62 }, { role: 'DF', x: 0.18, y: 0.85 },
        { role: 'MF', x: 0.30, y: 0.50 }, { role: 'MF', x: 0.38, y: 0.30 }, { role: 'MF', x: 0.38, y: 0.70 },
        { role: 'FW', x: 0.46, y: 0.20 }, { role: 'FW', x: 0.48, y: 0.50 }, { role: 'FW', x: 0.46, y: 0.80 }
    ];

    const awayFormations = [
        { role: 'GK', x: 0.95, y: 0.50 },
        { role: 'DF', x: 0.82, y: 0.15 }, { role: 'DF', x: 0.85, y: 0.38 },
        { role: 'DF', x: 0.85, y: 0.62 }, { role: 'DF', x: 0.82, y: 0.85 },
        { role: 'MF', x: 0.70, y: 0.50 }, { role: 'MF', x: 0.62, y: 0.30 }, { role: 'MF', x: 0.62, y: 0.70 },
        { role: 'FW', x: 0.54, y: 0.20 }, { role: 'FW', x: 0.52, y: 0.50 }, { role: 'FW', x: 0.54, y: 0.80 }
    ];

    const aiNames = ["알리송", "쇼", "반다이크", "뤼디거", "워커", "로드리", "덕배", "벨링엄", "살라", "홀란드", "음바페"];

    // --- 3. 팀 초기화 ---
    function initTeams() {
        homeTeam = [];
        awayTeam = [];

        for (let i = 0; i < 11; i++) {
            const pData = gameState.inventory[i] || { name: `선수_${i+1}`, pos: 'MF' };
            
            homeTeam.push({
                x: canvas.width * homeFormations[i].x,
                y: canvas.height * homeFormations[i].y,
                baseX: homeFormations[i].x,
                baseY: homeFormations[i].y,
                role: homeFormations[i].role,
                name: pData.name,
                team: 'home',
                isControlled: i === 9,
                facingAngle: 0,
                speed: 0.8 + Math.random() * 0.5,
                aiOffsetX: (Math.random() - 0.5) * 50,
                aiOffsetY: (Math.random() - 0.5) * 50
            });

            awayTeam.push({
                x: canvas.width * awayFormations[i].x,
                y: canvas.height * awayFormations[i].y,
                baseX: awayFormations[i].x,
                baseY: awayFormations[i].y,
                role: awayFormations[i].role,
                name: aiNames[i],
                team: 'away',
                isControlled: false,
                facingAngle: Math.PI,
                speed: 0.8 + Math.random() * 0.5,
                aiOffsetX: (Math.random() - 0.5) * 50,
                aiOffsetY: (Math.random() - 0.5) * 50
            });
        }
        controlledIndex = 9;
    }

    function resetToKickoff() {
        resizeCanvas();
        initTeams();
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.vx = 0;
        ball.vy = 0;
        ball.owner = homeTeam[controlledIndex];
        matchState = 'KICKOFF';
    }

    function switchControlledPlayer() {
        homeTeam.forEach(p => p.isControlled = false);
        let closestIdx = 0;
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

    startMatchBtn.addEventListener('click', () => {
        isMatchRunning = true;
        scoreHome = 0;
        scoreAway = 0;
        gameTime = 0;
        currentHalf = 1;
        startMatchBtn.innerText = "경기 진행 중...";
        
        resetToKickoff();
        startTimer();
        gameLoop();
    });

    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (matchState === 'PLAYING') {
                gameTime++;
                let min = Math.floor(gameTime / 2);
                let sec = (gameTime % 2) * 30;
                document.getElementById('match-timer').innerText = `${min < 10 ? '0' + min : min}:${sec === 0 ? '00' : sec}`;

                if (gameTime === 90 && currentHalf === 1) {
                    currentHalf = 2;
                    document.getElementById('match-half').innerText = "후반전";
                    alert("전반전 종료! 후반전 킥오프를 진행합니다.");
                    resetToKickoff();
                } else if (gameTime >= 180) {
                    clearInterval(timerInterval);
                    matchState = 'ENDED';
                    alert(`경기 종료! 최종 스코어 ${scoreHome} : ${scoreAway}`);
                    startMatchBtn.innerText = "경기 시작";
                    isMatchRunning = false;
                }
            }
        }, 1000);
    }

    // --- 4. 패스 / 슛 강제 실행 ---
    function executePass() {
        const cp = homeTeam[controlledIndex];
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

        if (targetPlayer) {
            ball.x = cp.x;
            ball.y = cp.y;
            ball.owner = null;

            const angle = Math.atan2(targetPlayer.y - cp.y, targetPlayer.x - cp.x);
            ball.vx = Math.cos(angle) * 18.0;
            ball.vy = Math.sin(angle) * 18.0;

            homeTeam.forEach(p => p.isControlled = false);
            targetPlayer.isControlled = true;
            controlledIndex = homeTeam.indexOf(targetPlayer);
        }
    }

    function executeShoot() {
        const cp = homeTeam[controlledIndex];
        
        ball.x = cp.x;
        ball.y = cp.y;
        ball.owner = null;

        const goalX = canvas.width - 10;
        const goalY = canvas.height / 2 + (Math.random() * 80 - 40);
        
        const angle = Math.atan2(goalY - cp.y, goalX - cp.x);
        ball.vx = Math.cos(angle) * 22.0;
        ball.vy = Math.sin(angle) * 22.0;
    }

    function updateGameLogic() {
        if (matchState !== 'PLAYING') return;

        // 조종 선수 이동
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
        }

        // 공 소유 처리
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

            [...homeTeam, ...awayTeam].forEach(p => {
                const dist = Math.hypot(p.x - ball.x, p.y - ball.y);
                if (dist < 35) {
                    ball.owner = p;
                    if (p.team === 'home') {
                        homeTeam.forEach(hp => hp.isControlled = false);
                        p.isControlled = true;
                        controlledIndex = homeTeam.indexOf(p);
                    }
                }
            });
        }

        // AI 독립 이동
        updateTeamAI(homeTeam, 'home');
        updateTeamAI(awayTeam, 'away');
        handleEnemyDecision();

        // 골 판정
        if (ball.x >= canvas.width - 12) {
            if (ball.y > canvas.height / 2 - 90 && ball.y < canvas.height / 2 + 90) {
                scoreHome++;
                resetToKickoff();
            } else {
                ball.vx *= -0.7;
            }
        }
        if (ball.x <= 12) {
            if (ball.y > canvas.height / 2 - 90 && ball.y < canvas.height / 2 + 90) {
                scoreAway++;
                resetToKickoff();
            } else {
                ball.vx *= -0.7;
            }
        }

        if (ball.y <= 10 || ball.y >= canvas.height - 10) {
            ball.vy *= -0.7;
        }

        document.getElementById('score').innerText = `${scoreHome} : ${scoreAway}`;
    }

    function updateTeamAI(team, teamType) {
        team.forEach((p) => {
            if (p.isControlled || p === ball.owner) return;

            let targetX = canvas.width * p.baseX + (ball.x - canvas.width / 2) * 0.35 + p.aiOffsetX;
            let targetY = canvas.height * p.baseY + (ball.y - canvas.height / 2) * 0.25 + p.aiOffsetY;

            const distToBall = Math.hypot(p.x - ball.x, p.y - ball.y);
            if (distToBall < 140 && !ball.owner) {
                targetX = ball.x;
                targetY = ball.y;
            }

            const distToTarget = Math.hypot(targetX - p.x, targetY - p.y);
            if (distToTarget > 8) {
                const angle = Math.atan2(targetY - p.y, targetX - p.x);
                p.x += Math.cos(angle) * p.speed;
                p.y += Math.sin(angle) * p.speed;
                p.facingAngle = angle;
            }
        });
    }

    function handleEnemyDecision() {
        if (ball.owner && ball.owner.team === 'away') {
            const enemy = ball.owner;
            if (enemy.x < canvas.width * 0.35) {
                ball.owner = null;
                const angle = Math.atan2(canvas.height / 2 - ball.y, 10 - ball.x);
                ball.vx = Math.cos(angle) * 14;
                ball.vy = Math.sin(angle) * 14;
            } else if (Math.random() < 0.02) {
                let bestTarget = awayTeam.find(p => p !== enemy && p.role !== 'GK');
                if (bestTarget) {
                    ball.owner = null;
                    const angle = Math.atan2(bestTarget.y - ball.y, bestTarget.x - ball.x);
                    ball.vx = Math.cos(angle) * 9;
                    ball.vy = Math.sin(angle) * 9;
                }
            }
        }
    }

    // --- 5. 캔버스 그리기 ---
    function drawHumanPlayer(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.facingAngle);

        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fillStyle = p.team === 'home' ? '#1e88e5' : '#e53935';
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 11px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x, p.y - 14);

        if (p.isControlled) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y - 24);
            ctx.lineTo(p.x - 6, p.y - 32);
            ctx.lineTo(p.x + 6, p.y - 32);
            ctx.fillStyle = "#00ff87";
            ctx.fill();
        }
    }

    function drawField() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#2e7d32";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 10);
        ctx.lineTo(canvas.width / 2, canvas.height - 10);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 70, 0, Math.PI * 2);
        ctx.stroke();

        homeTeam.forEach(p => drawHumanPlayer(p));
        awayTeam.forEach(p => drawHumanPlayer(p));

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.stroke();

        if (matchState === 'KICKOFF') {
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(canvas.width / 2 - 200, canvas.height / 2 - 40, 400, 50);
            ctx.fillStyle = "#00ff87";
            ctx.font = "bold 16px Arial";
            ctx.textAlign = "center";
            ctx.fillText("S키 또는 화면을 클릭하여 킥오프하세요!", canvas.width / 2, canvas.height / 2 - 10);
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