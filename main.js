const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

cv.width = 854;
cv.height = 480;


const rotate=(v,a)=>{let c=Math.cos(a),s=Math.sin(a);return vec(v.x*c-v.y*s,v.x*s+v.y*c)}
const stc=(p,c)=>rotate(p.sub(c.pos),-c.rot).mul(c.zoom).add(vec(cv.width/2,cv.height/2))
const cts=(p,c)=>rotate(p.sub(vec(cv.width/2,cv.height/2)).mul(1/c.zoom),c.rot).add(c.pos)


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
    this.radius = 0.4;
}

Mouse.prototype.update = function(dt){
    let velTarget = vec(Math.cos(this.rot), Math.sin(this.rot)).mul((keyList["ArrowUp"]?10:0)-(keyList["ArrowDown"]?5:0));
    if(keyList["ArrowUp"]){
        velTarget = vec(Math.cos(this.rot), Math.sin(this.rot)).mul(10);
    }
    let rotVelTarget = ((keyList["ArrowRight"]?1:0)-(keyList["ArrowLeft"]?1:0))*.1;
    this.rotVel += (rotVelTarget-this.rotVel)*(1-Math.pow(1-0.9, dt/0.2))
    this.rot += this.rotVel;
    this.vel = this.vel.add(velTarget.sub(this.vel).mul(1-Math.pow(1-0.9, dt/0.2)));
    this.pos = this.pos.add(this.vel.mul(dt));
}

Mouse.prototype.draw = function(cam){
    ctx.fillStyle = "rgb(125, 92, 54)";
    ctx.beginPath();
    let cvPos = stc(this.pos, cam);
    ctx.arc(cvPos.x, cvPos.y, this.radius*cam.zoom, this.rot-cam.rot+Math.PI/2, this.rot-cam.rot+3*Math.PI/2);
    let r = this.radius*1.2;
    let noseP = stc(this.pos.add(vec(r*Math.cos(this.rot), r*Math.sin(this.rot))), cam);
    ctx.lineTo(noseP.x, noseP.y);
    ctx.closePath();
    ctx.fill();
}


function World(){
    this.mouse = new Mouse(this, vec(-1));
    this.objects = [this.mouse];
    this.cam = {pos: vec(), rot: 0, zoom: 40};
    let gridStr = 
`
aaa aaaa
a      a
       a
a      a
aaaaaaaa
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
    this.cam.pos = this.cam.pos.add(this.mouse.pos.sub(this.cam.pos).mul(1-Math.pow(1-0.95, dt/.2)));
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
                    let cvc = stc(cornerPos, this.cam);
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
