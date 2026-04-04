const express = require('express');
const router = express.Router();

// Khi truy cập gốc '/', trả về trang 404 theo yêu cầu
router.get('/', (req, res) => {
    res.status(404).render('404', { url: req.originalUrl });
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