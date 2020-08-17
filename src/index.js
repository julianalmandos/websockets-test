const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const express = require('express');

const app = express();
const server = http.createServer(app);

app.use(express.static(path.join(__dirname, '..', 'client')));

let clients = [];
const uniqueClients = new Set();

app.get('/hello', (req, res) => {
    res.json({
        message: 'Hello!'
    });
});

app.get('/clients', (req, res) => {
    res.json(getClientNames());
})

const getClientNames = () => clients.map((client) => client.name);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    let ip = req.socket.remoteAddress;
    try {
        ip = req.headers['x-forwarded-for'];
    } catch (error) {
        console.error('error parsing ip');
    }
    if (uniqueClients.has(ip)) {
        console.log('closes by ip');
        ws.close();
    }
    uniqueClients.add(ip);
    const clientInfo = { ws, name: 'anonymous' };
    clients.push(clientInfo);
    console.log('client connected!');
    ws.on('message', (message) => {
        try {
            const messageObj = JSON.parse(message);
            console.log(messageObj);
            if (messageObj.type === 'ping') {
                ws.send(JSON.stringify({
                    type: 'pong'
                }));
            } else if (messageObj.type === 'setName') {
                clientInfo.name = messageObj.data.name;
                // TODO: emit latest info about clients
                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        console.log('sends');
                        client.send(JSON.stringify({
                            type: 'clients',
                            data: getClientNames()
                        }));
                    }
                });
            }
        } catch (error) {
            console.error(error);
        }
    })
    ws.on('close', () => {
        uniqueClients.delete(ip);
        clients = clients.filter((client) => client.ws !== ws);
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                  type: 'clients',
                  data: getClientNames()
              }));
            }
        });
    })
});

const port = process.env.PORT || 4242;
server.listen(port);