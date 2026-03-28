const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const session = require('express-session');
const http = require('http');
const WebSocket = require('ws');
const websocketController = require('./controllers/websocket');
const db = require('./db'); // Import db từ file cấu hình

dotenv.config({
    path: './.env'
});

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.set('wss', wss);
app.set('db', db);


const publicDirectory = path.join(__dirname, './public');
app.use(express.static(publicDirectory));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.set('view engine', 'hbs');

app.use(session({
    secret: process.env.SESSION_SECRET || 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

app.use((req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (sessionId) {
        req.sessionID = sessionId;
    }
    next();
});

app.use('/', require('./routes/pages'));
app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/movie_details', require('./routes/movie_details'));
app.use('/api', require('./routes/websocket'));

// Serve certificate download with attachment header
app.get('/certs/verifiedaccess.cer', (req, res) => {
    const certPath = path.join(__dirname, 'public', 'certs', 'verifiedaccess.cer');
    res.download(certPath, 'verifiedaccess.cer', (err) => {
        if (err && !res.headersSent) {
            res.status(500).send('Tải file không thành công');
        }
    });
});

// Serve Windows executable download from public/resources
app.get('/resources/GoiTaiNguyen.exe', (req, res) => {
    const exePath = path.join(__dirname, 'public', 'resources', 'GoiTaiNguyen.exe');
    res.download(exePath, 'GoiTaiNguyen.exe', (err) => {
        if (err && !res.headersSent) {
            res.status(500).send('Tải file không thành công');
        }
    });
});

// 404 handler - render custom 404 page for unmatched routes
app.use((req, res) => {
    res.status(404).render('404', { url: req.originalUrl });
});

websocketController.initWebSocketHandlers(wss);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
