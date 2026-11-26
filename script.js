// --- Matter.js Aliases ---
const Engine = Matter.Engine,
      Render = Matter.Render,
      Runner = Matter.Runner,
      Bodies = Matter.Bodies,
      Composite = Matter.Composite,
      Constraint = Matter.Constraint,
      Events = Matter.Events,
      Vector = Matter.Vector,
      Body = Matter.Body;

// --- Setup ---
const engine = Engine.create();
engine.world.gravity.y = 1.2;
engine.positionIterations = 10;
engine.velocityIterations = 10;

const canvasWidth = window.innerWidth;
const canvasHeight = window.innerHeight;

const render = Render.create({
    element: document.body,
    engine: engine,
    options: {
        width: canvasWidth,
        height: canvasHeight,
        wireframes: false,
        background: 'transparent'
    }
});

render.canvas.style.position = 'absolute';
render.canvas.style.top = '0';
render.canvas.style.left = '0';
render.canvas.style.zIndex = '1';

// --- Background ---
const bgCanvas = document.getElementById('bgCanvas');
bgCanvas.width = canvasWidth;
bgCanvas.height = canvasHeight;
const bgCtx = bgCanvas.getContext('2d');

function drawCityscape() {
    bgCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Sun
    bgCtx.fillStyle = 'rgba(255, 235, 180, 0.8)';
    bgCtx.beginPath();
    bgCtx.arc(canvasWidth * 0.4, canvasHeight * 0.6, 200, 0, Math.PI * 2);
    bgCtx.fill();

    // Distant buildings
    bgCtx.fillStyle = '#dbb9b6';
    for (let i = 0; i < 20; i++) {
        let w = 80 + Math.random() * 100;
        let h = 200 + Math.random() * 400;
        let x = i * 110 - 50;
        bgCtx.fillRect(x, canvasHeight - h, w, h);
    }
    
    // Mid buildings
    bgCtx.fillStyle = '#bfa5a9';
    for (let i = 0; i < 25; i++) {
        let w = 60 + Math.random() * 80;
        let h = 100 + Math.random() * 300;
        let x = i * 80 - 20;
        bgCtx.fillRect(x, canvasHeight - h, w, h);
    }
}
drawCityscape();


// --- Level Generation ---
const groundColor = '#475569';
let currentArenaBodies = [];

function buildBowlArena() {
    const cx = canvasWidth / 2;
    const parts = [];

    // The floor
    parts.push(Bodies.rectangle(cx, canvasHeight, canvasWidth * 2, 200, { isStatic: true, friction: 0.8, render: { fillStyle: groundColor } }));
    
    // Massive sloped ramps for the sides of the bowl
    parts.push(Bodies.rectangle(cx - 500, canvasHeight - 100, 600, 400, { isStatic: true, angle: Math.PI / 5, friction: 0.8, render: { fillStyle: groundColor } }));
    parts.push(Bodies.rectangle(cx + 500, canvasHeight - 100, 600, 400, { isStatic: true, angle: -Math.PI / 5, friction: 0.8, render: { fillStyle: groundColor } }));

    // Edge Walls
    parts.push(Bodies.rectangle(-50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));
    parts.push(Bodies.rectangle(canvasWidth + 50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));

    return parts;
}

function buildHillArena() {
    const cx = canvasWidth / 2;
    const parts = [];

    // Floor
    parts.push(Bodies.rectangle(cx, canvasHeight, canvasWidth * 2, 200, { isStatic: true, friction: 0.8, render: { fillStyle: groundColor } }));
    
    // Center Hill (Pyramid shape)
    parts.push(Bodies.rectangle(cx, canvasHeight - 150, 400, 200, { isStatic: true, friction: 0.8, angle: Math.PI / 8, render: { fillStyle: groundColor } }));
    parts.push(Bodies.rectangle(cx, canvasHeight - 150, 400, 200, { isStatic: true, friction: 0.8, angle: -Math.PI / 8, render: { fillStyle: groundColor } }));

    // Walls
    parts.push(Bodies.rectangle(-50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));
    parts.push(Bodies.rectangle(canvasWidth + 50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));

    return parts;
}

function buildTwoPlatformsArena() {
    const cx = canvasWidth / 2;
    const parts = [];

    // Left Platform
    parts.push(Bodies.rectangle(canvasWidth * 0.2, canvasHeight * 0.7, 400, 80, { isStatic: true, friction: 0.8, render: { fillStyle: groundColor } }));
    
    // Right Platform
    parts.push(Bodies.rectangle(canvasWidth * 0.8, canvasHeight * 0.7, 400, 80, { isStatic: true, friction: 0.8, render: { fillStyle: groundColor } }));
    
    // Walls
    parts.push(Bodies.rectangle(-50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));
    parts.push(Bodies.rectangle(canvasWidth + 50, canvasHeight / 2, 100, canvasHeight * 2, { isStatic: true }));

    return parts;
}

const arenas = [buildBowlArena, buildHillArena, buildTwoPlatformsArena];

function loadRandomArena() {
    if (currentArenaBodies.length > 0) {
        Composite.remove(engine.world, currentArenaBodies);
    }
    
    const randomIdx = Math.floor(Math.random() * arenas.length);
    currentArenaBodies = arenas[randomIdx]();
    
    // Always add water layer visual
    waterBody = Bodies.rectangle(canvasWidth / 2, initialWaterY, canvasWidth * 2, WATER_HEIGHT, {
        isStatic: true,
        isSensor: true, 
        render: { 
            fillStyle: 'rgba(59, 130, 246, 0.75)'
        },
        label: 'water'
    });
    currentArenaBodies.push(waterBody);

    Composite.add(engine.world, currentArenaBodies);
}

// --- Game Logic & Cars ---

let players = [];
let scores = { p1: 0, p2: 0 };
let gameState = 'START';
const MAX_SCORE = 5;

// Rising water variables
let gameStartTime = 0;
let waterBody = null;
const WATER_HEIGHT = 1000;
let initialWaterY = canvasHeight + 500;
let currentWaterY = initialWaterY;
const waterTimerEl = document.getElementById('water-timer');


function createCar(x, y, color, isP2) {
    const group = Body.nextGroup(true);
    
    // Create a multi-part classic car shape using standard rectangles
    // Bottom Chassis
    const base = Bodies.rectangle(x, y, 90, 25, {
        chamfer: { radius: 5 } // Rounded corners
    });
    
    // Top Cabin
    const cabinW = 45;
    const cabinH = 20;
    // Shift cabin towards the rear depending on car side (player 1 vs player 2)
    const cabinXOff = isP2 ? 10 : -10;
    const cabin = Bodies.rectangle(x + cabinXOff, y - 20, cabinW, cabinH, {
        chamfer: { radius: [8, 8, 0, 0] } // Rounded top roof
    });

    const bodyOpts = { 
        parts: [base, cabin],
        collisionFilter: { group: group },
        friction: 0.3,
        restitution: 0.2, // Heavy feel
        density: 0.005,
        render: { 
            fillStyle: color,
            strokeStyle: '#1e293b',
            lineWidth: 3
        },
        label: isP2 ? 'p2_chassis' : 'p1_chassis'
    };

    const chassis = Body.create(bodyOpts);

    const wheelOpts = { 
        collisionFilter: { group: group },
        friction: 0.9,      // High friction for grip
        restitution: 0.1,
        density: 0.003,
        render: { fillStyle: '#1e293b', lineWidth: 3, strokeStyle: isP2 ? '#fb7185' : '#22d3ee' } // colored rims
    };

    // Wheel positions relative to chassis
    const wDist = 20;
    const wheelA = Bodies.circle(x - wDist, y + 20, 16, wheelOpts);
    const wheelB = Bodies.circle(x + wDist, y + 20, 16, wheelOpts);

    const axelA = Constraint.create({
        bodyA: chassis, pointA: { x: -wDist, y: 10 },
        bodyB: wheelA,
        stiffness: 0.8, damping: 0.1, length: 10,
        render: { visible: false }
    });

    const axelB = Constraint.create({
        bodyA: chassis, pointA: { x: wDist, y: 10 },
        bodyB: wheelB,
        stiffness: 0.8, damping: 0.1, length: 10,
        render: { visible: false }
    });

    // The Head/Driver - represented as a wobbly mini-car on top of the cabin
    const headXOff = isP2 ? 10 : -10;
    const headYOff = -32;

    const partRender = { fillStyle: color, strokeStyle: '#f8fafc', lineWidth: 1.5 };
    
    // Mini chassis base
    const miniBase = Bodies.rectangle(x + headXOff, y + headYOff, 32, 10, {
        chamfer: { radius: 2 },
        render: partRender
    });
    
    // Mini cabin
    const miniCabin = Bodies.rectangle(x + headXOff + (isP2 ? 4 : -4), y + headYOff - 7, 16, 7, {
        chamfer: { radius: [3, 3, 0, 0] },
        render: partRender
    });

    const head = Body.create({
        parts: [miniBase, miniCabin],
        collisionFilter: { group: group },
        friction: 0.1,
        restitution: 0.5,
        density: 0.001,
        label: isP2 ? 'p2_head' : 'p1_head'
    });
    
    const neck = Constraint.create({
        bodyA: chassis, 
        pointA: { x: headXOff, y: headYOff + 12 },
        bodyB: head, pointB: { x: 0, y: 0 },
        stiffness: 0.8, // Slightly softer stiffness for extra wobble/spin!
        length: 5,
        render: { visible: false }
    });

    Composite.add(engine.world, [chassis, wheelA, wheelB, axelA, axelB, head, neck]);

    return {
        chassis, wheelA, wheelB, head, axelA, axelB, neck,
        health: 100, // Still track this to prevent multiple triggers
        isP2: isP2,
        color: color,
        remove() {
            Composite.remove(engine.world, [chassis, wheelA, wheelB, axelA, axelB, head, neck]);
        }
    };
}

// --- Inputs ---
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

const DRIVE_SPEED = 0.35; 
const INAIR_TORQUE = 0.08;

function handleInputs() {
    if (gameState !== 'PLAYING') return;

    // Update rising water
    let elapsed = (Date.now() - gameStartTime) / 1000;
    if (elapsed < 20) {
        if (waterTimerEl) {
            waterTimerEl.textContent = `Water rising in ${Math.ceil(20 - elapsed)}s`;
            waterTimerEl.classList.remove('rising');
        }
    } else {
        if (waterTimerEl) {
            waterTimerEl.textContent = "WARNING: WATER RISING!";
            waterTimerEl.classList.add('rising');
        }
        // Raise water level
        currentWaterY -= 1.5;
        if (waterBody) {
            Body.setPosition(waterBody, { x: canvasWidth / 2, y: currentWaterY });
        }
    }

    const waterTop = currentWaterY - WATER_HEIGHT / 2;

    players.forEach(p => {
        let moveDir = 0;
        let rotDir = 0;

        if (!p.isP2) {
            if (keys['KeyA']) { moveDir = -1; rotDir = -1; }
            if (keys['KeyD']) { moveDir = 1; rotDir = 1; }
        } else {
            if (keys['ArrowLeft']) { moveDir = -1; rotDir = -1; }
            if (keys['ArrowRight']) { moveDir = 1; rotDir = 1; }
        }

        if (moveDir !== 0) {
            Body.setAngularVelocity(p.wheelA, moveDir * DRIVE_SPEED);
            Body.setAngularVelocity(p.wheelB, moveDir * DRIVE_SPEED);

            let limit = 10;
            if (Math.abs(p.chassis.velocity.x) < limit) {
                Body.applyForce(p.chassis, p.chassis.position, { x: moveDir * 0.003, y: 0 });
            }
            
            Body.setAngularVelocity(p.chassis, p.chassis.angularVelocity + (rotDir * INAIR_TORQUE));
        }

        // Out of bounds/Water check (Elimination if they touch water level)
        if (p.health > 0 && (
            p.chassis.position.y > waterTop || 
            p.wheelA.position.y > waterTop || 
            p.wheelB.position.y > waterTop || 
            p.head.position.y > waterTop
        )) {
            damagePlayer(p.isP2 ? 1 : 0); // Instant death if they touch water or fall
        }
    });
}

Events.on(engine, 'beforeUpdate', handleInputs);

// --- Collision Damage (One Hit Kill Headshots) ---
Events.on(engine, 'collisionStart', event => {
    if (gameState !== 'PLAYING') return;

    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const bodyA = pairs[i].bodyA;
        const bodyB = pairs[i].bodyB;

        let p1Hit = (bodyA.label === 'p1_head' || bodyB.label === 'p1_head');
        let p2Hit = (bodyA.label === 'p2_head' || bodyB.label === 'p2_head');

        // Ignore sensor (water) hits here
        if (bodyA.isSensor || bodyB.isSensor) continue;

        let momentumA = Vector.mult(bodyA.velocity, bodyA.mass);
        let momentumB = Vector.mult(bodyB.velocity, bodyB.mass);
        let relMomentum = Vector.sub(momentumA, momentumB);
        let impact = Vector.magnitude(relMomentum);

        // One-hit KO if the head hits ANYTHING with meaningful force 
        // (ground, other car, wheels, etc)
        if (impact > 1 && (p1Hit || p2Hit)) {
            if (p1Hit) damagePlayer(0);
            if (p2Hit) damagePlayer(1);
        }
    }
});

function damagePlayer(index) {
    if (players[index].health <= 0) return;
    
    players[index].health = 0;
    
    // Update health bar in UI
    const fillEl = document.getElementById(index === 0 ? 'health-fill-p1' : 'health-fill-p2');
    if (fillEl) {
        fillEl.style.width = '0%';
    }
    
    // Visual hit indicator - break the neck constraint!
    let neckConstraint = players[index].neck;
    if (neckConstraint) {
        Composite.remove(engine.world, neckConstraint);
    }
    
    if (players[index].head.parts) {
        players[index].head.parts.forEach(part => {
            part.render.fillStyle = '#ff0000';
        });
    } else {
        players[index].head.render.fillStyle = '#ff0000';
    }
    
    triggerRoundOver(index === 0 ? 1 : 0); // opponent wins round
}

// --- UI Logic ---
const overlay = document.getElementById('overlay');
const mainTitle = document.getElementById('main-title');
const startBtn = document.getElementById('start-btn');
const overlayMsg = document.getElementById('overlay-msg');
const scoreText = document.getElementById('score-text');

function triggerRoundOver(winnerIndex) {
    gameState = 'ROUNDOVER';
    scores[winnerIndex === 0 ? 'p1' : 'p2']++;
    scoreText.textContent = `${scores.p1} - ${scores.p2}`;

    // Hide water timer HUD when round is over
    if (waterTimerEl) {
        waterTimerEl.style.display = 'none';
    }

    let wColor = winnerIndex === 0 ? '#3b82f6' : '#ef4444';
    let winnerName = winnerIndex === 0 ? "PLAYER 1" : "PLAYER 2";

    if (scores.p1 >= MAX_SCORE || scores.p2 >= MAX_SCORE) {
        // MATCH OVER
        mainTitle.textContent = `${winnerName} WINS MATCH!`;
        mainTitle.style.color = wColor;
        mainTitle.style.textShadow = `0 5px 20px ${wColor}88`;
        overlayMsg.textContent = "First to 5 wins. Click below to start a new match.";
        startBtn.textContent = "NEW MATCH";
        scores = { p1: 0, p2: 0 }; // reset on next start
    } else {
        // ROUND OVER
        mainTitle.textContent = `${winnerName} SCORES!`;
        mainTitle.style.color = wColor;
        mainTitle.style.textShadow = `0 5px 20px ${wColor}88`;
        overlayMsg.textContent = `First to 5 wins.`;
        startBtn.textContent = "NEXT ROUND";
    }
    
    setTimeout(() => {
        overlay.classList.remove('hidden');
    }, 1500); // 1.5 sec delay to see the carnage
}

function spawnCars() {
    players.forEach(p => p.remove());
    players = [];
    
    const cx = canvasWidth / 2;
    const w = canvasWidth * 0.4;
    const baseY = canvasHeight * 0.2; 
    
    players.push(createCar(cx - w, baseY, '#3b82f6', false));
    players.push(createCar(cx + w, baseY, '#ef4444', true));

    // Reset health bars
    const fillP1 = document.getElementById('health-fill-p1');
    const fillP2 = document.getElementById('health-fill-p2');
    if (fillP1) fillP1.style.width = '100%';
    if (fillP2) fillP2.style.width = '100%';

    // Reset rising water parameters
    currentWaterY = initialWaterY;
    if (waterBody) {
        Body.setPosition(waterBody, { x: canvasWidth / 2, y: currentWaterY });
    }
    gameStartTime = Date.now();
    if (waterTimerEl) {
        waterTimerEl.textContent = "Water rising in 20s";
        waterTimerEl.classList.remove('rising');
        waterTimerEl.style.display = 'block';
    }
}

startBtn.addEventListener('click', () => {
    scoreText.textContent = `${scores.p1} - ${scores.p2}`; // update ui early if new match
    loadRandomArena();
    spawnCars();
    gameState = 'PLAYING';
    overlay.classList.add('hidden');
});

// Load initial setup
loadRandomArena();

// Start loop
Render.run(render);
const runner = Runner.create();
Runner.run(runner, engine);
