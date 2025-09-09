// npx terser main.js -o output.js -c -m --toplevel
const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

cv.width = 800;
cv.height = 700;

let rotate=(v,a)=>{let c=Math.cos(a),s=Math.sin(a);return vec(v.x*c-v.y*s,v.x*s+v.y*c)}
let spaceToCanvas=(p,cam)=>rotate(p.sub(cam.pos),-cam.rot).mul(cam.zoom).add(vec(cv.width/2,cv.height/2))
let canvasToSpace=(p,cam)=>rotate(p.sub(vec(cv.width/2,cv.height/2)).mul(1/cam.zoom),cam.rot).add(cam.pos)
//let interDt = ()

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
}

Mouse.prototype.update = function(dt){
    let velTarget = vec(Math.cos(this.rot), Math.sin(this.rot)).mul((keyList["ArrowUp"]?15:0)-(keyList["ArrowDown"]?5:0));
    let rotVelTarget = ((keyList["ArrowRight"]?1:0)-(keyList["ArrowLeft"]?1:0))*.1;
    this.rotVel += (rotVelTarget-this.rotVel)*(1-Math.pow(1-0.9, dt/0.2))
    this.rot += this.rotVel;
    this.vel = this.vel.add(velTarget.sub(this.vel).mul(1-Math.pow(1-0.9, dt/0.5)));
    let lastPos = this.pos.copy();
    let pos2 = this.pos.add(this.vel.mul(dt));
    let d = pos2.sub(this.pos);
    let it = Math.ceil(d.length()/this.radius);
    for(let i = 1; i <= it; i++){
        this.pos = lastPos.add(d.mul(i/it));
        if(this.resolveCollisions()) break;
    }
    this.vel = this.pos.sub(lastPos).mul(1/dt);
}

Mouse.prototype.resolveCollisions = function(){
    let col = false;
    let gx = Math.floor(this.pos.x), gy = Math.floor(this.pos.y)
    for(let y = gy-1; y<=gy+1; y++)
        for(let x = gx-1; x<=gx+1; x++){
            if (
                y >= 0 && y < this.world.grid.length &&
                x >= 0 && x < this.world.grid[y].length &&
                this.world.grid[y][x] !== ' '
              ){
            let nearest = vec(Math.max(x, Math.min(this.pos.x, x+1)), Math.max(y, Math.min(this.pos.y, y+1)));
            let delta = this.pos.sub(nearest)
            let dist2 = delta.dot(delta);
            if(dist2 < this.radius*this.radius){
            let dist = Math.sqrt(dist2) || 0.0001
            let push = delta.mul((this.radius - dist)/dist)
            this.pos = this.pos.add(push)
            col = true;
            }
        }
        } 
    return col;
}

Mouse.prototype.draw = function(cam){
    ctx.fillStyle = "rgb(125, 92, 54)";
    ctx.beginPath();
    let cvPos = spaceToCanvas(this.pos, cam);
    ctx.arc(cvPos.x, cvPos.y, this.radius*cam.zoom, this.rot-cam.rot+Math.PI/2, this.rot-cam.rot+3*Math.PI/2);
    let r = this.radius*1.2;
    let noseP = spaceToCanvas(this.pos.add(vec(r*Math.cos(this.rot), r*Math.sin(this.rot))), cam);
    ctx.lineTo(noseP.x, noseP.y);
    ctx.closePath();
    ctx.fill();
}

function Cat(world, pos){
    this.world = world;
    this.pos = pos;
    this.vel = vec(0);
    let d = 2.5;
    this.head = this.pos.add(vec(0,d));
    this.pawsOffset = [vec(-d, -d),vec(d, -d),vec(d,d),vec(-d,d)];
    this.paws = [];
    this.pawsTargets = [];
    for(let i = 0; i < 4; i++){
        this.paws[i] = this.pos.add(this.pawsOffset[i]);
        this.pawsTargets[i] = this.paws[i];
    }
    this.headR = 1;
    this.pawR = 0.6;
    this.bodyR = 1.3;
    this.legL = 3;
}

Cat.prototype.update = function(dt){
    let d = this.world.mouse.pos.sub(this.pos);
    let velTarget = d.normalize().mul(5);
    this.vel = this.vel.add(velTarget.sub(this.vel).mul(1-Math.pow(1-0.9, dt/0.5)));
    this.pos = this.pos.add(this.vel.mul(dt));

    let headTarget = this.pos.add(this.vel.normalize().mul(4))
    this.head = this.head.add(headTarget.sub(this.head).mul(1-Math.pow(1-0.8, dt/0.5)));

    for(let i = 0; i < 4; i++){
        let target = this.pos.add(rotate(this.pawsOffset[i], Math.atan2(-this.vel.y, this.vel.x)));
        if(this.paws[i].sub(target).length() > this.legL){
            this.pawsTargets[i] = d.length() < this.legL*1.5 ? this.world.mouse.pos : target;
        }
        this.paws[i] = this.paws[i].add(this.pawsTargets[i].sub(this.paws[i]).mul(1-Math.pow(1-0.8, dt/0.1)));
    }
}

Cat.prototype.draw = function(cam){
    ctx.fillStyle = "black";
    ctx.beginPath();
    let p = spaceToCanvas(this.head, cam);
    ctx.arc(p.x, p.y, this.headR*cam.zoom, 0, Math.PI*2);
    ctx.fill();

    ctx.beginPath();
    p = spaceToCanvas(this.pos, cam);
    ctx.arc(p.x, p.y, this.bodyR*cam.zoom, 0, Math.PI*2);
    ctx.fill();

    let i = 0;
    for(let pa of this.paws){
        if(true){
            ctx.beginPath();
            p = spaceToCanvas(pa, cam);
            ctx.arc(p.x, p.y, this.pawR*cam.zoom, 0, Math.PI*2);
            ctx.fill();
        }

        i++;
    }
}

function World(){
    this.mouse = new Mouse(this, vec(-1));
    this.cat = new Cat(this, vec(-5));
    this.objects = [this.mouse, this.cat];
    this.cam = {pos: vec(), rot: 0, zoom: 50};
    let gridStr = 
`
aaaaaaaaaaa
          a
a   a     a
a   a     a
a   aaaaa a
a         a
a aaaaa   a
a          
aaaaaaaaaaa
`;
    this.grid = [];
    let i = -1; let j = 0;
    for(let char of gridStr){
        if(char == '\n'){
            i++;
            j = 0;
        } else {
            if(j == 0) this.grid[i] = [];
            this.grid[i][j] = char;
            j++;
        }
    }

    console.log(this.grid);
}

World.prototype.update = function(dt){
    this.cam.rot += ((this.mouse.rot+Math.PI/2)-this.cam.rot)*(1-Math.pow(1-0.95, dt));
    this.cam.pos = this.cam.pos.add(this.mouse.pos.sub(this.cam.pos).mul(1-Math.pow(1-1, dt/.2)));
    for(object of this.objects){
        if(object.update !== undefined){
            object.update(dt);
        }
    }
}

World.prototype.draw = function(){
    ctx.fillStyle = "rgb(79, 58, 0)";
    ctx.fillRect(0, 0, cv.width, cv.height);
    for(object of this.objects){
        if(object.draw !== undefined){
            object.draw(this.cam);
        }
    }
    for(let i = 0; i < this.grid.length; i++){
        for(let j = 0; j < this.grid[i].length; j++){
            let c = this.grid[i][j];
            if(c != ' '){
                ctx.fillStyle = "black";
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
    console.log(this.world);
}

Game.prototype.loop = function(){
    this.world.update(1/30);
    this.world.draw();
}

Game.prototype.run = function(){
    setInterval(this.loop.bind(this), 1000/30);
}


let game = new Game();
game.run();
