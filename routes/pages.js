const express = require('express');
const router = express.Router();
const refreshSession = require('../controllers/profile').refreshSession;
const db = require('../db');

// Khi truy cập gốc '/', trả về trang 404 theo yêu cầu
router.get('/', (req, res) => {
    res.status(404).render('404', { url: req.originalUrl });
});

// Trang index có sẵn tại /index để người dùng có thể truy cập lại
router.get('/index', refreshSession, (req, res) => {
    const user = req.session.user;

    db.query('SELECT * FROM Phim', (err, phim) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (user) {
            user.TongSoTien = user.TongSoTien.toLocaleString('vi-VN');
            return res.render('index', { user, phim });
        }

        res.render('index', { phim });
    });
});
router.get('/register', (req, res) => {
    res.render("register");
});

router.get('/login', (req, res) => {
    res.render("login");
});

router.get('/forgot_pass', (req, res) => {
    res.render("forgot_pass");
});

router.get('/reset_pass', (req, res) => {
    res.render("reset_pass");
});
router.get('/movie_details', (req, res) => {
    res.render("movie_details");
});
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.clearCookie('connect.sid'); // Xóa cookie session
        res.redirect('/');
    });
});

module.exports = router;