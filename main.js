const cv = document.getElementById("cv");
const ctx = cv.getContext("2d");

cv.width = 854;
cv.height = 480;


rot=(v,a)=>{let c=Math.cos(a),s=Math.sin(a);return vec(v.x*c-v.y*s,v.x*s+v.y*c)}

stc=(p,c)=>rot(p.sub(c.pos),-c.a).mul(c.zoom).add(vec(cv.width/2,cv.height/2))
cts=(p,c)=>rot(p.sub(vec(cv.width/2,cv.height/2)).mul(1/c.zoom),c.a).add(c.pos)


function Mouse(world, pos){
    this.world = world;
    this.pos = pos;
    this.vel = vec();
    this.dir = 0;
    this.radius = 0.4;
}

Mouse.prototype.update = function(dt){

}

Mouse.prototype.draw = function(cam){
    ctx.fillStyle = "rgb(125, 92, 54)";
    ctx.beginPath();
    let cvPos = stc(this.pos, cam);
    ctx.arc(cvPos.x, cvPos.y, this.radius*cam.zoom, 0, Math.PI*2);
    ctx.fill();
}


function World(){
    this.mouse = new Mouse(this, vec(-1));
    this.objects = [this.mouse];
    this.cam = {pos: vec(), a: 0, zoom: 40};
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
}

Game.prototype.loop = function(){
    this.world.update(1/30)
    this.world.draw();
}

Game.prototype.run = function(){
    setInterval(this.loop(), 1000/30);
}


let game = new Game();
game.run();
