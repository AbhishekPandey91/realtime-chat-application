// src/server.js
const http = require("http");

const app= require("./app");

const connectDB= require("./config/db");

const initWebSocket= require("./websocket/index");

const PORT= process.env.PORT;

const server= http.createServer(app);

initWebSocket(server);

async function start() {
    await connectDB();
    server.listen(PORT,()=>{
        console.log(`Server is running on port ${PORT}`);
    });
}
start();