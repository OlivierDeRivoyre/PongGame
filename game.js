const CanvasWidth = 800;
const CanvasHeight = 450;
const canvas = document.getElementById("myCanvas");
const ctx = canvas.getContext("2d");

window.addEventListener('keydown', keydown, false);
window.addEventListener('keyup', keyup, false);

const params = new URLSearchParams(window.location.search);
const server = params.get("server");
const isServer = !server;
let lastPeerId = localStorage.getItem("lastPeerId");
let peer;
if (isServer && lastPeerId) {
    peer = new Peer(lastPeerId);
}
else {
    peer = new Peer();
}
peer.on('error', function (err) {
    console.log(err);
})
let myConn = null;
peer.on('open', function (id) {
    if (isServer) {
        localStorage.setItem("lastPeerId", peer.id);
        document.getElementById("myId").innerText = "Other player can join you with: "
            + window.location.origin + window.location.pathname + "?server=" + peer.id;
        myConn = new ServerConnnection();
        const server = new Server(myConn);
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
        myConn = conn;
        // Receive messages
        conn.on('data', function (data) {
            client.onData(data);
        });
        //conn.on('open', function () {});
    }

});

function test() {
    myConn.send('Hello I m ' + peer.id);
}

class ServerConnnection {
    send(msg) {
        this.data(msg);
    }
    on(eventType, func) {
        this.data = func;
    }

}

class Player {
    constructor(id) {
        this.id = id;
        this.team = id % 2;
        this.x = 200 + this.team * 400;
        this.y = CanvasHeight - 0;
        this.color = this.team == 0 ? "red" : "blue";
        this.vx = 0;
        this.radius = 40;
    }
    update() {
        this.x += this.vx * 5;
    }
    paint() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, Math.PI, 0);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
    onMessage(msg) {
        if (msg.vx !== undefined) {
            this.vx = msg.vx;
        }
    }
}
function square(x) {
    return x * x;
}

class Ball {
    constructor() {
        this.x = 200;
        this.y = 40;
        this.vx = 0;
        this.vy = 0;
        this.radius = 10;
        this.color = "orange";
    }
    update(players) {
        this.vy += 0.8;
        this.x += this.vx;
        this.y += this.vy;

        if (this.x <= this.radius) {
            this.x = this.radius;
            this.vx = Math.abs(this.vx);
        }
        else if (this.x >= CanvasWidth - this.radius - 1) {
            this.x = CanvasWidth - this.radius - 1;
            this.vx = -Math.abs(this.vx);
        }
        for (let p of players) {
            if (this.vy > 0 && square(p.x - this.x) + square(p.y - this.y) < square(p.radius + this.radius)) {
                this.reboundOn(p);
                return;
            }
        }
        if (this.y > CanvasHeight - this.radius) {
            this.x = 200;
            this.y = 40;
            this.vx = 0;
            this.vy = 0;
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
}

class World {
    constructor() {
        this.players = [];
        this.ball = new Ball();
    }
    update() {
        for (let p of this.players) {
            p.update();
        }
        this.ball.update(this.players);
    }
    paint() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let p of this.players) {
            p.paint();
        }
        this.ball.paint();
    }
    toMsg() {
        return {
            t: 'world',
            p: this.players.map(p => { return { id: p.id, x: p.x, y: p.y } }),
            b: { x: this.ball.x, y: this.ball.y }
        }
    }
    updateFrom(msg) {
        if (this.players.length != msg.p.length) {
            this.players = msg.p.map(p => new Player(p.id));
        }
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].x = msg.p[i].x;
            this.players[i].y = msg.p[i].y;
        }
        this.ball.x = msg.b.x;
        this.ball.y = msg.b.y;
        this.paint();
    }
}

class Server {
    static tickDuration = 1000.0 / 30;
    constructor(fakeConn) {
        this.connections = [];
        this.world = new World();
        this.onConnect(fakeConn)
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
    }
    runTick() {
        this.world.update();
        this.world.paint();
        this.sendWorld();
        setTimeout(() => this.runTick(), Server.tickDuration);
    }
    sendWorld() {
        const msg = this.world.toMsg();
        for (let c of this.connections) {
            c.send(msg);
        }
    }
    onReceiveMsg(player, data) {
        if (data.t == 'patch') {
            player.onMessage(data);
        }
    }
}

class Client {
    constructor(conn) {
        this.connection = conn;
        this.world = new World();
    }
    onData(msg) {
        if (msg.t == 'world') {
            this.world.updateFrom(msg);
        }
    }
}

function keydown(event) {
    if (event.keyCode == 37 || event.keyCode == 39) {
        myConn.send({ t: "patch", vx: event.keyCode == 37 ? -1 : 1 });
    }
}

function keyup(event) {
    if (event.keyCode == 37 || event.keyCode == 39) {
        myConn.send({ t: "patch", vx: 0 });
    }
}
