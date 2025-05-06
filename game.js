const CanvasWidth = 800;
const CanvasHeight = 450;
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

window.addEventListener('keydown', keydown, false);
window.addEventListener('keyup', keyup, false);

let keysPressed = {
    left: false,
    right: false,
    up: false,
};

function keyPressed(pressed, event) {
    if (event.keyCode == 37) {
        keysPressed.left = pressed;
    }
    else if (event.keyCode == 39) {
        keysPressed.right = pressed;
    }
    else if (event.keyCode == 38 || event.keyCode == 32) { // up or space
        keysPressed.up = pressed;
    }
}
function keydown(event) {
    keyPressed(true, event);
}
function keyup(event) {
    keyPressed(false, event);
}



const params = new URLSearchParams(window.location.search);
const server = params.get("server");
const isServer = !server;
let lastPeerId = localStorage.getItem("lastPeerId");
let ice = {
    config: {
        iceServers: [
            {
                "urls": "stun:stun.relay.metered.ca:80"
            },
            {
                'urls': 'stun:stun.l.google.com:19302'
            },
            {
                "urls": "turns:global.relay.metered.ca:443?transport=tcp",
                "username": "2741418185fbd3aac2c7aeb4",
                "credential": "00nktyd7tIflZllh"
            },
            {
                "urls": "turn:global.relay.metered.ca:80",
                "username": "2741418185fbd3aac2c7aeb4",
                "credential": "00nktyd7tIflZllh"
            },
            {
                "urls": "turn:global.relay.metered.ca:80?transport=tcp",
                "username": "2741418185fbd3aac2c7aeb4",
                "credential": "00nktyd7tIflZllh"
            },
            {
                "urls": "turn:global.relay.metered.ca:443",
                "username": "2741418185fbd3aac2c7aeb4",
                "credential": "00nktyd7tIflZllh"
            },
        ]
    }
};
let peer;
if (isServer && lastPeerId) {
    peer = new Peer(lastPeerId, ice);
}
else {
    peer = new Peer(undefined, ice);
}
peer.on('error', function (err) {
    console.log(err);
})
peer.on('open', function (id) {
    if (isServer) {
        localStorage.setItem("lastPeerId", peer.id);
        document.getElementById("myId").innerText = "Other player can join you with: "
            + window.location.origin + window.location.pathname + "?server=" + peer.id;
        const server = new Server();
        server.runTick();
        peer.on('connection', function (conn) {
            //conn.on('data', function (data) {});
            conn.on('open', function () {
                server.onConnect(conn);
            });
        });
    } else {
        const conn = peer.connect(server);
        const client = new Client(conn);
        client.runTick();
    }

});

function square(x) {
    return x * x;
}
class Player {
    static JumpMax = 80;
    constructor(id) {
        this.id = id;
        this.team = id % 2;
        this.x = 200 + this.team * 400;
        this.y = CanvasHeight - 0;
        this.color = this.team == 0 ? "red" : "blue";
        this.vx = 0;
        this.radius = 40;
        this.inputX = 0;
        this.inputY = false;
        this.isJumping = false;
    }
    updateLocalPlayer() {
        let changed = false;
        if (keysPressed.left) {
            if (this.inputX != -1) {
                this.inputX = -1;
                this.vx = 0;
                changed = true;
            }
        } else if (keysPressed.right) {
            if (this.inputX != 1) {
                this.inputX = 1;
                this.vx = 0;
                changed = true;
            }
        } else if (this.inputX != 0) {
            this.inputX = 0;
            this.vx = 0;
            changed = true;
        }
        if (keysPressed.up) {
            if (!this.inputY && !this.isJumping) {
                this.inputY = true;
                changed = true;
            }
        } else if (this.inputY) {
            this.inputY = false;
            changed = true;
        }
        return changed;
    }
    update() {
        let accX = Math.abs(this.vx) < 10 ? 3 : Math.abs(this.vx) < 15 ? 2 : 1;
        if (this.isJumping) {
            accX *= 0.20;
        }
        const newVx = this.vx + this.inputX * accX;
        const maxVx = this.inputX * 20;
        if (this.inputX < 0) {
            this.vx = Math.max(newVx, maxVx);
        } else if (this.inputX > 0) {
            this.vx = Math.min(newVx, maxVx);
        } else if (!this.isJumping) {
            this.vx = 0;
        }
        this.x += this.vx;
        let minX = this.team == 0 ? 0 : (CanvasWidth / 2) + World.NetBorder;
        let maxX = this.team == 0 ? (CanvasWidth / 2) - World.NetBorder : CanvasWidth;
        this.x = Math.max(minX + this.radius, Math.min(maxX - this.radius, this.x));

        if (this.inputY && !this.isJumping) {
            this.vy = -20;
            this.isJumping = true;
        }
        if (!this.isJumping) {
            return;
        }
        let accY = 2;
        if (this.inputY && this.vy < 0 && this.y > CanvasHeight - Player.JumpMax) {
            accY = 0;
        }
        if (!this.inputY && this.vy < 0) {
            this.vy = 0;
        }
        this.vy = Math.min(20, this.vy + accY);
        this.y += this.vy;
        if (this.y >= CanvasHeight) {
            this.y = CanvasHeight;
            this.isJumping = false;
        }

    }
    paint() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, Math.PI, 0);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
    getMsg() {
        return { t: 'playerMove', id: this.id, x: this.x, y: this.y, vx: this.vx, vy: this.vy, ix: this.inputX, iy: this.inputY, ij: this.isJumping };
    }
    onMessage(msg) {
        if (msg.id == this.id && msg.t === 'playerMove') {
            this.x = msg.x;
            this.y = msg.y;
            this.vx = msg.vx;
            this.vy = msg.vy;
            this.inputX = msg.ix;
            this.inputY = msg.iy;
            this.isJumping = msg.ij;
        }
    }
}
class Ball {
    constructor() {
        this.id = 'ball';
        this.x = 200;
        this.y = 40;
        this.vx = 0;
        this.vy = 0;
        this.radius = 10;
        this.color = "orange";
    }
    update(world, updates) {
        this.vy += 0.8;
        for (let i = 0; i < 10; i++) {
            this.x += this.vx / 10;
            this.y += this.vy / 10;
            if (this.x <= this.radius) {
                this.x = this.radius;
                this.vx = Math.abs(this.vx);
            }
            else if (this.x >= CanvasWidth - this.radius - 1) {
                this.x = CanvasWidth - this.radius - 1;
                this.vx = -Math.abs(this.vx);
            }
            else if (this.y > CanvasHeight - World.NetHeight) {
                if (this.vx > 0
                    && this.x > CanvasWidth / 2 - this.radius - World.NetBorder
                    && this.x < CanvasWidth / 2) {
                    this.x = CanvasWidth / 2 - this.radius;
                    this.vx = -Math.abs(this.vx);
                } else if (this.vx < 0
                    && this.x > CanvasWidth / 2
                    && this.x < CanvasWidth / 2 + this.radius + World.NetBorder) {
                    this.x = CanvasWidth / 2 + this.radius;
                    this.vx = Math.abs(this.vx);
                }
            }
            let p = world.localPlayer;
            if (this.vy > 0
                && this.y < p.y
                && square(p.x - this.x) + square(p.y - this.y) < square(p.radius + this.radius)) {
                this.reboundOn(p);
                updates.push(this.getMsg());
                return;
            }
        }
        if (world.isServer && this.y > CanvasHeight + 200) {
            this.x = 200;
            this.y = 40;
            this.vx = 0;
            this.vy = 0;
            updates.push(this.getMsg());
            return;
        }

    }
    reboundOn(player) {
        const speed = Math.sqrt(square(this.vy) + square(this.vx));
        const initialBallAngus = Math.atan2(this.vy, this.vx);
        const tangentAngus = Math.atan2(this.y - player.y, this.x - player.x);
        const angusOnTangent = initialBallAngus - tangentAngus - Math.PI / 2;
        const newAngusOnTangent = Math.atan2(-Math.sin(angusOnTangent), Math.cos(angusOnTangent));
        const newBallAngus = newAngusOnTangent + tangentAngus + Math.PI / 2;
        this.vx = speed * Math.cos(newBallAngus);
        this.vy = speed * Math.sin(newBallAngus);
        this.x = player.x + (player.radius + this.radius) * Math.cos(tangentAngus);
        this.y = player.y + (player.radius + this.radius) * Math.sin(tangentAngus);
    }
    paint() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
    getMsg() {
        return { t: 'throwBall', id: this.id, x: this.x, y: this.y, vx: this.vx, vy: this.vy };
    }
    onMessage(msg) {
        if (msg.id == this.id && msg.t === 'throwBall') {
            this.x = msg.x;
            this.y = msg.y;
            this.vx = msg.vx;
            this.vy = msg.vy;
        }
    }
}

class World {
    static NetHeight = 80;
    static NetBorder = 4;
    constructor(isServer, players, localPlayerId) {
        this.isServer = isServer;
        this.players = players;
        this.ball = new Ball();
        this.localPlayer = players.find(p => p.id == localPlayerId);
        if (!this.localPlayer) {
            throw new Error(`Player not found ${localPlayerId}`);
        }
    }
    update() {
        const changed = this.localPlayer.updateLocalPlayer();
        for (let p of this.players) {
            p.update();
        }
        const updates = [];
        if (changed) {
            updates.push(this.localPlayer.getMsg());
        }
        this.ball.update(this, updates);
        return updates;
    }
    paint() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.paintNet();
        for (let p of this.players) {
            p.paint();
        }
        this.ball.paint();
    }
    paintNet() {
        ctx.beginPath();
        ctx.lineWidth = "0";
        ctx.fillStyle = "green";
        ctx.rect(CanvasWidth / 2 - World.NetBorder, CanvasHeight - World.NetHeight, 2 * World.NetBorder, World.NetHeight);
        ctx.fill();
    }
    getNewWorldMsg() {
        return {
            t: 'newWorld',
            p: this.players.map(p => { return { id: p.id, x: p.x, y: p.y } }),
            b: { x: this.ball.x, y: this.ball.y },
            yourId: '',
        }
    }
    static newWorld(msg) {
        const players = msg.p.map(p => new Player(p.id));
        const world = new World(false, players, msg.yourId);
        world.ball.x = msg.b.x;
        world.ball.y = msg.b.y;
        return world;
    }
    onUpdates(updates) {
        for (let m of updates) {
            for (let p of this.players) {
                p.onMessage(m);
            }
            this.ball.onMessage(m);
        }
    }
}

class Server {
    static tickDuration = 1000.0 / 30;
    constructor() {
        this.connections = [];
        const serverPlayer = new Player(0);
        this.world = new World(true, [serverPlayer], serverPlayer.id);
    }
    onConnect(conn) {
        this.connections.push(conn);
        const p = new Player(this.world.players.length);
        p.connection = conn;
        conn.player = p;
        this.world.players.push(p);
        const self = this;
        conn.on('data', function (data) {
            self.onReceiveMsg(p, data);
        });
        this.sendWorld();
    }
    runTick() {
        const updates = this.world.update();
        if (updates.length != 0) {
            this.broadcastAll({ t: 'updates', updates });
        }
        this.world.paint();
        setTimeout(() => this.runTick(), Server.tickDuration);
    }
    broadcastAll(msg) {
        for (let c of this.connections) {
            c.send(msg);
        }
    }
    sendWorld() {
        const msg = this.world.getNewWorldMsg();
        for (let c of this.connections) {
            msg.yourId = c.player.id;
            c.send(msg);
        }
    }
    onReceiveMsg(player, msg) {
        if (msg.t == 'updates') {
            this.world.onUpdates(msg.updates);
            for (let c of this.connections.filter(c => c.player.id != player.id)) {
                c.send(msg);
            }
        }
    }
}

class Client {
    constructor(conn) {
        this.connection = conn;
        this.world = null;
        const self = this;
        conn.on('data', function (data) {
            self.onData(data);
        });
    }
    runTick() {
        if (this.world != null) {
            const updates = this.world.update();
            if (updates.length != 0) {
                this.connection.send({ t: 'updates', updates });
            }
            this.world.paint();
        }
        setTimeout(() => this.runTick(), Server.tickDuration);
    }
    onData(msg) {
        if (msg.t == 'newWorld') {
            this.world = World.newWorld(msg);
        }
        if (msg.t == 'updates' && this.world != null) {
            this.world.onUpdates(msg.updates);
        }
    }
}

