const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');

exports.register = (req, res) => {
    const {HoTen, NgaySinh, SDT, Email, TenTaiKhoan, MatKhau, MatKhau2} = req.body;

    if (MatKhau !== MatKhau2) {
        return res.render('register', { message: 'Mật khẩu xác thực không khớp!' });
    }

    db.query('SELECT * FROM users WHERE Email = $1 OR TenTaiKhoan = $2', [Email, TenTaiKhoan], async (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).send('Internal Server Error');
        }

        if (result && result.length > 0) {
            return res.render('register', { message: 'Gmail hoặc tên đăng nhập đã được sử dụng!' });
        }

        let hashedPassword = await bcrypt.hash(MatKhau, 8);

        db.query('SELECT COUNT(*) AS usercount FROM users', (err, countResult) => {
            if (err) {
                console.log(err);
                return res.status(500).send('Internal Server Error');
            }

            const userCount = parseInt(countResult[0].usercount) || 0;
            const ID_U = 'U' + (userCount + 1);

            const insertSql = `INSERT INTO users (ID_U, HoTen, NgaySinh, SDT, Email, NgayTaoTaiKhoan, VaiTro, TenTaiKhoan, MatKhau, TongSoTien) VALUES ($1,$2,$3,$4,$5,NOW(),$6,$7,$8,$9)`;

            db.query(insertSql, [ID_U, HoTen, NgaySinh, SDT, Email, 'KhachHang', TenTaiKhoan, hashedPassword, 0], (err) => {
                if (err) {
                    console.log(err);
                    return res.status(500).send('Internal Server Error');
                }

                req.session.user = {
                    ID_U: ID_U,
                    TenTaiKhoan: TenTaiKhoan,
                    HoTen: HoTen,
                    NgaySinh: NgaySinh,
                    SDT: SDT,
                    Email: Email,
                    TongSoTien: 0,
                };
                return res.redirect('/');
            });
        });
    });
};

exports.login = async (req, res) => {
    const { TenTaiKhoan, MatKhau } = req.body;

    db.query('SELECT * FROM users WHERE TenTaiKhoan = $1', [TenTaiKhoan], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (!results || results.length === 0) {
            return res.render('login', { message: 'Tài khoản không tồn tại!' });
        }

            const user = results[0];
            // Normalize password field from form (some clients send as array)
            const plainPassword = Array.isArray(MatKhau) ? MatKhau[0] : MatKhau;

            if (!user || !user.MatKhau) {
                console.error('User record missing hashed password:', user);
                return res.render('login', { message: 'Tài khoản không đúng hoặc chưa được thiết lập mật khẩu.' });
            }

            let isMatch = false;
            try {
                isMatch = await bcrypt.compare(plainPassword, user.MatKhau);
            } catch (err) {
                console.error('bcrypt.compare error:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (!isMatch) {
                return res.render('login', { message: 'Mật khẩu không đúng!' });
            }

        req.session.user = {
            ID_U: user.ID_U,
            TenTaiKhoan: user.TenTaiKhoan,
            HoTen: user.HoTen,
            NgaySinh: user.NgaySinh,
            SDT: user.SDT,
            Email: user.Email,
            TongSoTien: user.TongSoTien,
        };

        const otp = exports.generateOtp();
        req.session.otp = otp;
        req.session.otpExpires = Date.now() + 5 * 60 * 1000;

        exports.sendOtp(user.Email, otp)
            .then(() => {
                res.render('otp', { message: 'Mã OTP đã được gửi đến email của bạn!' });
            })
            .catch((err) => {
                console.error('Error sending OTP:', err);
                res.status(500).send('Không thể gửi mã OTP. Vui lòng thử lại sau.');
            });
    });
};

exports.forgot_pass = (req, res) => {
    const { Email } = req.body;

    if (!Email) {
        return res.render('forgot_pass', { message: 'Vui lòng nhập email!' });
    }

    db.query('SELECT * FROM users WHERE Email = $1', [Email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (!results || results.length === 0) {
            return res.render('forgot_pass', { message: 'Email không tồn tại!' });
        }

        const token = jwt.sign({ email: Email }, process.env.JWT_SECRET, { expiresIn: '15m' });
        const resetLink = `http://localhost:3000/auth/verify_code?token=${token}`;

        var transporter = nodemailer.createTransport({
            host: process.env.GMAIL_HOST,
            port: process.env.GMAIL_PORT,
            secure: false,
            auth: {
              user:  process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD
            }
        });
          
        var mailOptions = {
            from: process.env.GMAIL_USER,
            to: Email,
            subject: 'Email đặt lại mật khẩu',
            text: `Nhấn vào link sau để đặt lại mật khẩu: ${resetLink}`,
        };
        
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });

        return res.render('share/successed_mail', { message: 'Đã gửi email đặt lại mật khẩu cho email!' });
    });
};

exports.verifyOtp = (req, res) => {
    const { otp } = req.body;

    if (!req.session.otp || !req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    if (Date.now() > req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP đã hết hạn!' });
    }

    if (otp !== req.session.otp) {
        return res.render('otp', { message: 'Mã OTP không đúng!' });
    }

    req.session.otp = null;
    req.session.otpExpires = null;
    res.redirect('/');
};

exports.verify_code = (req, res) => {
    const token = req.query.token;

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.render('error', { message: 'Link không hợp lệ hoặc đã hết hạn!' });
        }

        res.render('reset_pass', { Email: decoded.email });
    });
};

exports.reset_pass = async (req, res) => {
    const { Email, MatKhau, MatKhau2 } = req.body;

    if (!Email) {
        return res.render('reset_pass', { message: 'Email không hợp lệ!' });
    }

    if (MatKhau !== MatKhau2) {
        return res.render('reset_pass', { message: 'Mật khẩu xác thực không khớp!' });
    }

    const hashedPassword = await bcrypt.hash(MatKhau, 8);

    db.query('SELECT * FROM users WHERE Email = $1', [Email], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        db.query('UPDATE users SET MatKhau = $1 WHERE Email = $2', [hashedPassword, Email], (err) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Internal Server Error');
            }

            return res.render('login', { message: 'Đặt lại mật khẩu thành công!' });
        });
    });
};

exports.generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Tạo mã OTP 6 chữ số
};

exports.sendOtp = (email, otp) => {
    const transporter = nodemailer.createTransport({
        host: process.env.GMAIL_HOST,
        port: process.env.GMAIL_PORT,
        secure: false,
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Mã OTP xác thực của bạn',
        text: `Mã OTP của bạn là: ${otp}. Mã này có hiệu lực trong 5 phút.`
    };

    return transporter.sendMail(mailOptions);
};

exports.loginWithOtp = (req, res) => {
    const { TenTaiKhoan, MatKhau } = req.body;

    db.query('SELECT * FROM users WHERE TenTaiKhoan = $1', [TenTaiKhoan], async (err, results) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length === 0) {
            return res.render('login', { message: 'Tài khoản không tồn tại!' });
        }

        const user = results[0];
        const isMatch = await bcrypt.compare(MatKhau, user.MatKhau);

        if (!isMatch) {
            return res.render('login', { message: 'Mật khẩu không đúng!' });
        }

        const otp = exports.generateOtp();
        req.session.otp = otp;
        req.session.otpExpires = Date.now() + 5 * 60 * 1000;
        req.session.user = user;

        exports.sendOtp(user.Email, otp)
            .then(() => {
                res.render('otp', { message: 'Mã OTP đã được gửi đến email của bạn!' });
            })
            .catch((err) => {
                console.error('Error sending OTP:', err);
                res.status(500).send('Không thể gửi mã OTP. Vui lòng thử lại sau.');
            });
    });
};

exports.verifyOtp = (req, res) => {
    const { otp } = req.body;

    if (!req.session.otp || !req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP không hợp lệ hoặc đã hết hạn!' });
    }

    if (Date.now() > req.session.otpExpires) {
        return res.render('otp', { message: 'Mã OTP đã hết hạn!' });
    }

    if (otp !== req.session.otp) {
        return res.render('otp', { message: 'Mã OTP không đúng!' });
    }

    req.session.otp = null;
    req.session.otpExpires = null;
    res.redirect('/');
};
