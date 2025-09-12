// npx terser main.js -o output.js -c -m --toplevel
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

cv.width = 800;
cv.height = 700;

let rotate=(v,a)=>{let c=Math.cos(a),s=Math.sin(a);return vec(v.x*c-v.y*s,v.x*s+v.y*c)}
let spaceToCanvas=(p,cam)=>rotate(p.sub(cam.pos),-cam.rot).mul(cam.zoom).add(vec(cv.width/2,cv.height/2))
let canvasToSpace=(p,cam)=>rotate(p.sub(vec(cv.width/2,cv.height/2)).mul(1/cam.zoom),cam.rot).add(cam.pos)
let lerpDtCoef = (dt, p, t)=>1-Math.pow(1-p, dt/t)
let lerpDt = (a, b, dt, p, t)=>a.add(b.sub(a).mul(lerpDtCoef(dt, p, t)))
let arVec = (a, r) => vec(Math.cos(a), Math.sin(a)).mul(r)

function resolveCollisions(pos, radius, grid){
    let col = false;
    let gx = Math.floor(pos.x), gy = Math.floor(pos.y)
    for(let y = gy-1; y<=gy+1; y++)
        for(let x = gx-1; x<=gx+1; x++){
            if (
                y >= 0 && y < grid.length &&
                x >= 0 && x < grid[y].length &&
                grid[y][x] !== ' '
              ){
            let nearest = vec(Math.max(x, Math.min(pos.x, x+1)), Math.max(y, Math.min(pos.y, y+1)));
            let delta = pos.sub(nearest)
            let dist2 = delta.dot(delta);
            if(dist2 < radius*radius){
            let dist = Math.sqrt(dist2) || 0.0001
            let push = delta.mul((radius - dist)/dist)
            pos = pos.add(push)
            col = true;
            }
        }
        } 
    return [col, pos];
}

function continuousCollisions(a, b, radius, grid){
    let t;
    let d = b.sub(a);
    let it = Math.floor(d.length()/radius)+1;
    for(let i = 1; i <= it; i++){
        p = a.add(d.mul(i/it));
        t = resolveCollisions(p, radius, grid);
        if(t[0]) break;
    }
    return t[1];
}

const keyList = [];
window.addEventListener('keydown',function(event){
    keyList[event.code] = true;
    if(["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].indexOf(event.code) > -1) {
        event.preventDefault();
    }
});
window.addEventListener('keyup',function(event){
    keyList[event.code] = false;
});

function Mouse(world, pos){
    this.world = world;
    this.pos = pos;
    this.vel = vec();
    this.rot = 0;
    this.rotVel = 0;
    this.radius = 0.25;

    this.hit = 0;
    this.life = 1;
}

Mouse.prototype.update = function(dt){
    let aliv = this.life > -.5;
    let velTarget = aliv ? (arVec(this.rot, (keyList["ArrowUp"]?15:0)-(keyList["ArrowDown"]?5:0))) : vec();
    let rotVelTarget = aliv ? ((keyList["ArrowRight"]?1:0)-(keyList["ArrowLeft"]?1:0))*.06 : 0;
    this.rotVel += (rotVelTarget-this.rotVel)*lerpDtCoef(dt, .9, .2)
    this.rot += this.rotVel;
    this.vel = lerpDt(this.vel, velTarget, dt, .9, .3);
    let lastPos = this.pos.copy();
    for(let paw of this.world.cat.paws){
        let d = this.pos.sub(paw);
        let dd = this.radius+this.world.cat.pawR;
        if(aliv && d.length() < dd && this.hit < 0){
            this.pos = paw.add(d.normalize().mul(dd+this.radius*.2));
            //this.vel = this.vel.add(d.normalize().mul(10));
            this.hit = .2;
            this.life -= .2;
            console.log(this.life);
        }
    }

    for(let i = this.world.cheese.length-1; i >= 0; i--){
        if(this.world.cheese[i].sub(this.pos).length() < this.radius+.4){
            this.world.cheese.splice(i,1);
        }
    }
    let pos2 = this.pos.add(this.vel.mul(dt));
    this.pos = continuousCollisions(lastPos, pos2, this.radius, this.world.grid);
    this.vel = this.pos.sub(lastPos).mul(1/dt);

    this.hit-=dt;
    if(aliv) this.life = Math.min(this.life+dt*.05,1);
    //console.log(this.life);
}

Mouse.prototype.draw = function(cam){
    ctx.globalAlpha = this.life > .2?this.life:0.2*(this.life+.5)/.7;
    //console.log(ctx.globalAlpha);
    ctx.fillStyle = this.hit > 0 ? "white" : "rgb(125, 92, 54)";
    ctx.beginPath();
    let cvPos = spaceToCanvas(this.pos, cam);
    ctx.arc(cvPos.x, cvPos.y, this.radius*cam.zoom, this.rot-cam.rot+Math.PI/2, this.rot-cam.rot+3*Math.PI/2);
    let r = this.radius*1.2;
    let noseP = spaceToCanvas(this.pos.add(arVec(this.rot, r)), cam);
    ctx.lineTo(noseP.x, noseP.y);
    ctx.closePath();
    ctx.fill();
}

function Cat(world, pos){
    this.world = world;
    this.pos = pos;
    this.vel = vec(0);
    let dy = 5;
    let dx = 2;
    this.head = this.pos.add(vec(0,2));
    this.pawsOffset = [vec(1, -dx),vec(dy, -dx),vec(dy,dx),vec(1,dx)];
    this.paws = [];
    this.pawsTargets = [];
    for(let i = 0; i < 4; i++){
        this.paws[i] = this.pos.add(this.pawsOffset[i]);
        this.pawsTargets[i] = this.paws[i];
    }
    this.headR = 1;
    this.pawR = 0.6;
    this.bodyR = 1.3;
    this.legL = 5;
    this.dead = false;
}

Cat.prototype.update = function(dt){
    let h = this.world.hole;
    if(this.world.cheese.length == 0 && this.pos.sub(h).length() < this.bodyR) this.dead = true;
    if(this.dead){
        this.head = lerpDt(this.head, h, dt, .9, .4);
        this.pos = lerpDt(this.pos, h, dt, .9, .4);
        for(let i = 0; i < 4; i++) this.paws[i] = lerpDt(this.paws[i], h, dt, .9, .4);
        return
    }
    let d = this.world.mouse.pos.sub(this.pos);
    let velTarget = d.normalize().mul(8);
    this.vel = lerpDt(this.vel, velTarget, dt, .9, .5)
    this.pos = continuousCollisions(this.pos, this.pos.add(this.vel.mul(dt)), this.bodyR, this.world.grid);

    let headTarget = this.pos.add(this.vel.normalize().mul(4))
    this.head = continuousCollisions(this.head,lerpDt(this.head, headTarget, dt, .8, .5), this.headR, this.world.grid)

    for(let i = 0; i < 4; i++){
        let target = this.pos.add(rotate(this.pawsOffset[i], Math.atan2(this.vel.y, this.vel.x)));
        if(this.paws[i].sub(target).length() > this.legL){
            this.pawsTargets[i] = ((i == 1 || i == 2) && d.length() < this.legL*1.5) ? this.world.mouse.pos : target;
        }
        this.paws[i] = continuousCollisions(this.paws[i], lerpDt(this.paws[i], this.pawsTargets[i], dt, .8, .1), this.pawR, this.world.grid);
        //this.paws[i] = lerpDt(this.paws[i], this.pawsTargets[i], dt, .8, .1), this.pawR, this.world.grid;
    }
}

Cat.prototype.draw = function(cam, shadow){
    if(shadow){
        ctx.globalAlpha /= 2;
        //cam.pos.x += shadow;
        cam.zoom *= 1.1;
    }
    ctx.fillStyle = "black";
    ctx.beginPath();
    let headP = spaceToCanvas(this.head, cam);
    ctx.arc(headP.x, headP.y, this.headR*cam.zoom, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    let bodyP = spaceToCanvas(this.pos, cam);
    ctx.arc(bodyP.x, bodyP.y, this.bodyR*cam.zoom, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(headP.x, headP.y);
    ctx.lineTo(bodyP.x, bodyP.y);
    ctx.stroke();

    let n = this.vel.normalize();
    let o = vec(-n.y, n.x);
    ctx.lineWidth = 0.6*cam.zoom;
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(bodyP.x, bodyP.y);
    for(let i = 0; i < 10; i++){
        let p = spaceToCanvas(this.pos.sub(n.mul(this.bodyR+i*.25)).add(o.mul(0.1*i*Math.sin(i*.5+this.world.time*2))), cam);
        ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    if(shadow) cam.zoom /= 1.1;//cam.pos.x -= shadow;
    for(let pa of this.paws){
        ctx.beginPath();
        let p = spaceToCanvas(pa, cam);
        ctx.arc(p.x, p.y, this.pawR*cam.zoom, 0, Math.PI*2);
        ctx.fill();
        ctx.lineWidth = cam.zoom*.6;
        ctx.beginPath();
        ctx.moveTo(bodyP.x, bodyP.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
    if(shadow){
        ctx.globalAlpha *= 2;
    }
}
const parseGrid = s => (/\d/.test(s)?s.replace(/(\d+)([\s\S])/g,(_,n,c)=>c.repeat(+n)):s).split('\n').map(r=>r.split(''));

function World(){
    this.time = 0;
    this.mouse = new Mouse(this, vec(20));
    this.cat = new Cat(this, vec(30));
    this.objects = [this.mouse, this.cat];
    this.cam = {pos: vec(), rot: 0, zoom: 30};
    let gridStr = 
`
42 13a5 1
43a11 6a1
2a26 1a11 1a18 1a1
1a27 1a11 1a18 1a1
1a27 1a11 1a18 1a1
1a27 1a11 9a10 1a1
1a10 10a1 7a11 1a7 1a10 1a1
1a14 1a12 1a5 1a5 1a7 1a10 1a1
1a14 1a12 1a5 1a5 1a3 1a3 1a10 1a1
1a14 1a12 1a5 1a5 1a3 1a3 1a10 1a1
1a14 1a12 1a5 1a5 1a3 1a3 1a9 2a1
9a6 1a12 1a5 1a5 1a3 1a3 1a9 1a1 1
1a14 1a12 1a5 1a5 5a3 1a9 1a1 1
1a14 1a12 1a5 1a13 1a9 1a1 1
1a14 1a12 1a5 1a13 1a9 1a1 1
1a14 1a12 1a5 1a13 1a9 1a1 1
1a13 2a12 1a5 1a13 1a9 1a1 1
1a13 1a13 1a5 1a13 1a9 2a1
1a13 1a13 1a5 3a11 1a10 1a1
1a13 1a13 1a7 1a11 1a10 1a1
1a13 1a13 1a7 1a11 1a10 1a1
1a27 1a7 1a22 1a1
1a35 1a22 1a1
1a35 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a50 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 21a7 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a22 1a1
1a7 1a27 1a21 2a1
1a7 1a27 1a21 1a1 1
1a35 1a6 11a6 1
1a18 1a16 1a6 1a14 1a1 1
1a18 1a16 1a6 1a1 7a6 1a1 1
1a18 1a16 1a6 1a1 1a12 1a1 1
1a18 1a23 1a1 1a12 1a1 1
1a18 1a23 1a1 1a12 1a1 1
1a18 1a23 1a1 1a12 1a1 1
1a18 1a23 1a1 1a12 1a1 1
1a18 1a23 1a1 1a5 1a6 1a1 1
1a18 1a23 1a1 1a5 1a5 2a1 1
1a18 1a23 1a1 1a5 1a5 2a1 1
1a18 1a23 1a1 1a5 1a5 1a2 1
1a18 1a23 1a1 1a5 1a5 1a2 1
1a18 1a25 1a5 1a5 1a2 1
1a18 1a25 1a5 1a4 2a2 1
1a18 1a25 1a5 1a4 2a2 1
57a3 1
`;
    this.grid = parseGrid(gridStr);
    
    let maxD;
    do{
        this.cheese = [];
        maxD = 0;
        for(let i = 0; i < 10; i++){
            let cp, y, x, minD;
            do{
                y = Math.floor(Math.random()*this.grid.length);
                x = Math.floor(Math.random()*this.grid[y].length);
                cp = vec(x, y);
                minD = 1e10;
                for(let c of this.cheese){
                    let d = cp.sub(c).length();
                    if(d < minD) minD = d;
                    if(d > maxD) maxD = d;
                }
            }while(this.grid[y][x] != ' ' || minD < 5);
            this.cheese.push(cp.add(vec(.5)))
        }
    }while(maxD < 10);
    console.log(this.cheese)
    this.hole = vec(this.grid.length/2, this.grid[1].length/2);
    this.holeR = 2;

    // this.grid = [];
    // let i = -1; let j = 0;
    // for(let char of gridStr){
    //     if(char == '\n'){
    //         i++;
    //         j = 0;
    //     } else {
    //         if(j == 0) this.grid[i] = [];
    //         this.grid[i][j] = char;
    //         j++;
    //     }
    // }

    // console.log(this.grid);
}

World.prototype.update = function(dt){
    this.cam.rot += ((this.mouse.rot+Math.PI/2)-this.cam.rot)*lerpDtCoef(dt, .95, .8)
    this.cam.pos = lerpDt(this.cam.pos, this.mouse.pos.add(arVec(this.mouse.rot, 1)), dt, 1, .5)
    for(object of this.objects){
        if(object.update !== undefined){
            object.update(dt);
        }
    }
    this.time += dt;
}

World.prototype.draw = function(){
    ctx.fillStyle = "rgb(79, 58, 0)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = this.cheese.length > 0?"rgb(72, 72, 72)":"black"
    ctx.beginPath();
    let p = spaceToCanvas(this.hole, this.cam);
    ctx.arc(p.x, p.y, this.cam.zoom*this.holeR, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "rgb(244, 229, 66)"
    for(let c of this.cheese){
        ctx.beginPath();
        p = spaceToCanvas(c, this.cam);
        ctx.arc(p.x, p.y, this.cam.zoom*.4, 0, Math.PI*2);
        ctx.fill();
    }
    this.cat.draw(this.cam, .6);
    for(object of this.objects){
        if(object.draw !== undefined){
            object.draw(this.cam);
        }
    }
    let z = this.cam.zoom;
    for(let d = 0; d < 20; d++){
        this.cam.zoom = z*(1+d*.05);
        this.drawGrid();
    }
    this.cam.zoom = z;
}

World.prototype.drawGrid = function(){
    for(let i = 0; i < this.grid.length; i++){
        for(let j = 0; j < this.grid[i].length; j++){
            let c = this.grid[i][j];
            if(c != ' '){
                ctx.fillStyle = "rgb(42, 31, 17)";
                ctx.beginPath();
                let corners = [[0,0], [0,1], [1,1], [1,0]];
                for(let ind = 0; ind < corners.length; ind++){
                    let cornerPos = vec(j, i).add(vec(corners[ind][0], corners[ind][1]))
                    let cvc = spaceToCanvas(cornerPos, this.cam);
                    if(ind == 0){
                        ctx.moveTo(cvc.x, cvc.y);
                    } else {
                        ctx.lineTo(cvc.x, cvc.y);
                    }
                }
                ctx.fill();
            }
        }
    }
}

function Game(){
    this.world = new World();
    this.lastUpdateTime = null;
}

Game.prototype.loop = function(){
    const now = Date.now();
    const dtInMilliseconds = this.lastUpdateTime == null ? 1000/60 : now-this.lastUpdateTime;
    this.lastUpdateTime = now;
    const dtInSeconds = dtInMilliseconds/1000;
    this.world.update(dtInSeconds);
    this.world.draw();
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle"
    ctx.font = "30px Verdana";
    let l = this.world.cheese.length;
    if(!this.world.cat.dead)ctx.fillText(l > 0?String(l):"Guide Cat into hole", cv.width/2, 100);
    if(this.world.mouse.life < -.5){
        ctx.fillText("R to restart", cv.width/2, cv.height/2+30);
        ctx.font = "60px Verdana";
        ctx.fillText("Game Over", cv.width/2, cv.height/2-40);
        if(keyList["KeyR"]){
            this.world = new World();
        }

    } else if(this.world.cat.dead){
        ctx.font = "60px Verdana";
        ctx.fillText("You Win!!!", cv.width/2, cv.height/2-40);
    }
    requestAnimationFrame(this.loop.bind(this))
}

let game = new Game();
requestAnimationFrame(game.loop.bind(game))
