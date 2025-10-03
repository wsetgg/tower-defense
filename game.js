// Tiny Tower Defense - single-file game logic
const canvas = document.getElementById('map');
const ctx = canvas.getContext('2d');

const moneyEl = document.getElementById('money');
const livesEl = document.getElementById('lives');
const waveEl = document.getElementById('wave');
const startWaveBtn = document.getElementById('startWave');
const towerButtons = document.querySelectorAll('.tower-btn');
const sellLastBtn = document.getElementById('sellLast');
const resetBtn = document.getElementById('reset');

const TILE = 32;
const COLS = Math.floor(canvas.width / TILE);
const ROWS = Math.floor(canvas.height / TILE);

let money = 100;
let lives = 10;
let wave = 0;

moneyEl.textContent = money;
livesEl.textContent = lives;
waveEl.textContent = wave;

const grid = {cols: COLS, rows: ROWS, tile: TILE};

// simple path: a sequence of tile coords enemies will follow
const path = [
  {x:0,y:5},{x:1,y:5},{x:2,y:5},{x:3,y:5},{x:4,y:5},{x:5,y:5},
  {x:5,y:4},{x:5,y:3},{x:6,y:3},{x:7,y:3},{x:8,y:3},{x:9,y:3},
  {x:9,y:4},{x:9,y:5},{x:9,y:6},{x:10,y:6},{x:11,y:6},{x:12,y:6},
  {x:13,y:6},{x:14,y:6},{x:14,y:5},{x:14,y:4},{x:15,y:4},{x:16,y:4},
  {x:17,y:4},{x:18,y:4},{x:19,y:4}
];
const pathSet = new Set(path.map(p=>`${p.x},${p.y}`));

let enemies = [];
let towers = [];
let bullets = [];
let spawnTimer = 0;
let spawning = false;
let enemiesToSpawn = 0;
let lastPlacedTower = null;

const TOWER_TYPES = {
  basic: {cost:50, range: 80, fireRate: 0.8, dmg:1},
  sniper:{cost:80, range:160, fireRate: 1.6, dmg:3}
};

function createEnemy(hp, speed){
  return {
    hp, maxHp:hp, speed, pathIndex:0,
    x: path[0].x * TILE + TILE/2,
    y: path[0].y * TILE + TILE/2,
    alive: true
  };
}

function startWave(){
  if (spawning || enemies.length) return;
  wave += 1;
  waveEl.textContent = wave;
  enemiesToSpawn = 5 + wave * 2;
  spawnTimer = 0;
  spawning = true;
  startWaveBtn.disabled = true;
}

let selectedType = null;
towerButtons.forEach(b=>{
  b.addEventListener('click', ()=>{
    selectedType = b.dataset.type;
    towerButtons.forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  });
});

canvas.addEventListener('click', (e)=>{
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const tx = Math.floor(mx / TILE);
  const ty = Math.floor(my / TILE);
  if (!selectedType) return;
  if (pathSet.has(`${tx},${ty}`)) return;
  if (towers.some(t=>t.tx===tx && t.ty===ty)) return;
  const spec = TOWER_TYPES[selectedType];
  if (money < spec.cost) return;
  money -= spec.cost;
  moneyEl.textContent = money;
  const tower = {
    type: selectedType,
    tx, ty,
    x: tx * TILE + TILE/2,
    y: ty * TILE + TILE/2,
    spec,
    cooldown: 0
  };
  towers.push(tower);
  lastPlacedTower = tower;
});

function refundLast(){
  if (!lastPlacedTower) return;
  const refund = Math.floor(TOWER_TYPES[lastPlacedTower.type].cost * 0.6);
  money += refund;
  moneyEl.textContent = money;
  towers = towers.filter(t=>t!==lastPlacedTower);
  lastPlacedTower = null;
}
sellLastBtn.addEventListener('click', refundLast);
window.addEventListener('keydown', (e)=>{ if (e.key.toLowerCase()==='r') refundLast(); });

resetBtn.addEventListener('click', ()=>{
  money = 100; lives = 10; wave = 0;
  enemies = []; towers = []; bullets = []; spawning=false; enemiesToSpawn=0;
  moneyEl.textContent = money; livesEl.textContent = lives; waveEl.textContent = wave;
  startWaveBtn.disabled = false;
});

let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  update(dt);
  draw();
  last = now;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function update(dt){
  if (spawning && enemiesToSpawn > 0){
    spawnTimer -= dt;
    if (spawnTimer <= 0){
      const hp = 3 + Math.floor(wave * 0.6);
      const speed = 30 + wave * 2;
      enemies.push(createEnemy(hp, speed));
      enemiesToSpawn -= 1;
      spawnTimer = 0.8;
    }
  } else if (spawning && enemiesToSpawn === 0 && enemies.length === 0){
    spawning = false;
    startWaveBtn.disabled = false;
  }

  enemies.forEach(e=>{
    if (!e.alive) return;
    const idx = e.pathIndex;
    if (idx >= path.length-1){
      e.alive = false;
      lives -= 1;
      livesEl.textContent = lives;
      if (lives <= 0) { alert('Game Over! Press Reset.'); }
      return;
    }
    const target = {x: path[idx+1].x * TILE + TILE/2, y: path[idx+1].y * TILE + TILE/2};
    const dx = target.x - e.x;
    const dy = target.y - e.y;
    const dist = Math.hypot(dx,dy);
    const step = e.speed * dt;
    if (dist <= step){
      e.x = target.x; e.y = target.y;
      e.pathIndex += 1;
    } else {
      e.x += dx / dist * step;
      e.y += dy / dist * step;
    }
  });
  enemies = enemies.filter(e=>e.alive && e.hp>0);

  towers.forEach(t=>{
    t.cooldown -= dt;
    if (t.cooldown <= 0){
      let target = null;
      let bestDist = Infinity;
      enemies.forEach(en=>{
        const d = Math.hypot(en.x - t.x, en.y - t.y);
        if (d <= t.spec.range && d < bestDist){
          bestDist = d; target = en;
        }
      });
      if (target){
        bullets.push({
          x: t.x, y: t.y, tx: target, speed: 300,
          dmg: t.spec.dmg
        });
        t.cooldown = t.spec.fireRate;
      }
    }
  });

  bullets.forEach(b=>{
    const target = b.tx;
    if (!target || !target.alive) { b.hit=true; return; }
    const dx = target.x - b.x; const dy = target.y - b.y;
    const dist = Math.hypot(dx,dy);
    const step = b.speed * dt;
    if (dist <= step){
      target.hp -= b.dmg;
      if (target.hp <= 0){
        target.alive = false;
        money += 10;
        moneyEl.textContent = money;
      }
      b.hit = true;
    } else {
      b.x += dx/dist * step;
      b.y += dy/dist * step;
    }
  });
  bullets = bullets.filter(b=>!b.hit);
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  for (let y=0;y<ROWS;y++){
    for (let x=0;x<COLS;x++){
      ctx.fillStyle = ((x+y)%2===0) ? '#071426' : '#062232';
      ctx.fillRect(x*TILE, y*TILE, TILE, TILE);
    }
  }

  path.forEach((p)=>{
    ctx.fillStyle = '#423322';
    ctx.fillRect(p.x*TILE, p.y*TILE, TILE, TILE);
    ctx.fillStyle = '#7a5f3a';
    ctx.fillRect(p.x*TILE + TILE*0.35, p.y*TILE + TILE*0.4, TILE*0.3, TILE*0.2);
  });

  towers.forEach(t=>{
    ctx.fillStyle = (t.type==='basic') ? '#0fd1b2' : '#7bd1ff';
    ctx.beginPath();
    ctx.arc(t.x, t.y, TILE*0.35, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#063c33';
    ctx.fillRect(t.x - 6, t.y - 20, 12, 12);
  });

  bullets.forEach(b=>{
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI*2);
    ctx.fill();
  });

  enemies.forEach(e=>{
    const hpRatio = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, TILE*0.35, TILE*0.25, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x - TILE*0.4, e.y - TILE*0.5, TILE*0.8, 6);
    ctx.fillStyle = '#6fe08e';
    ctx.fillRect(e.x - TILE*0.4, e.y - TILE*0.5, TILE*0.8 * hpRatio, 6);
  });

  const start = path[0];
  const end = path[path.length-1];
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(start.x*TILE + 6, start.y*TILE + 6, TILE-12, TILE-12);
  ctx.fillRect(end.x*TILE + 6, end.y*TILE + 6, TILE-12, TILE-12);

  if (selectedType && mousePos){
    const tx = Math.floor(mousePos.x / TILE);
    const ty = Math.floor(mousePos.y / TILE);
    const cx = tx * TILE + TILE/2;
    const cy = ty * TILE + TILE/2;
    const spec = TOWER_TYPES[selectedType];
    if (!pathSet.has(`${tx},${ty}`) && !towers.some(t=>t.tx===tx && t.ty===ty)){
      ctx.beginPath();
      ctx.arc(cx, cy, spec.range, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(0,209,178,0.12)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, spec.range, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,80,80,0.08)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

let mousePos = null;
canvas.addEventListener('mousemove', (e)=>{
  const rect = canvas.getBoundingClientRect();
  mousePos = {x: e.clientX - rect.left, y: e.clientY - rect.top};
});
canvas.addEventListener('mouseleave', ()=>{ mousePos = null; });

startWaveBtn.addEventListener('click', startWave);
