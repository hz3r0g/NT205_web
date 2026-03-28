const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Hỗ trợ callback style gần giống mysql để bạn đỡ sửa nhiều
module.exports = {
  query: (text, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    pool.query(text, params)
      .then(res => {
        // Map common lowercase column names (Postgres returns lowercase) to PascalCase keys
        const mapping = {
          id_u: 'ID_U',
          hoten: 'HoTen',
          ngaysinh: 'NgaySinh',
          sdt: 'SDT',
          email: 'Email',
          tentaikhoan: 'TenTaiKhoan',
          matkhau: 'MatKhau',
          tongsotien: 'TongSoTien',
          googleid: 'GoogleId',
          id_p: 'ID_P',
          tenphim: 'TenPhim',
          id_sc: 'ID_SC',
          id_pc: 'ID_PC',
          id_r: 'ID_R',
          id_g: 'ID_G',
          soghe: 'SoGhe',
          loaighe: 'LoaiGhe',
          giave: 'GiaVe',
          id_dv: 'ID_DV'
        };

        const mappedRows = res.rows.map(row => {
          const out = Object.assign({}, row);
          for (const key of Object.keys(row)) {
            const lower = key.toLowerCase();
            if (mapping[lower]) {
              out[mapping[lower]] = row[key];
            } else {
              // also create PascalCase from underscore-separated names as a fallback
              if (lower.includes('_')) {
                const parts = lower.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1));
                const pascal = parts.join('_');
                out[pascal] = row[key];
              }
            }
          }

          return out;
        });

        if (callback) callback(null, mappedRows);
      })
      .catch(err => {
        if (callback) callback(err);
      });
  },

  // thêm asyncQuery để dùng async/await nếu cần
  asyncQuery: async (text, params = []) => {
    const res = await pool.query(text, params);
    // apply same mapping logic for asyncQuery
    const mapping = {
      id_u: 'ID_U', hoten: 'HoTen', ngaysinh: 'NgaySinh', sdt: 'SDT', email: 'Email',
      tentaikhoan: 'TenTaiKhoan', matkhau: 'MatKhau', tongsotien: 'TongSoTien', googleid: 'GoogleId',
      id_p: 'ID_P', tenphim: 'TenPhim', id_sc: 'ID_SC', id_pc: 'ID_PC', id_r: 'ID_R', id_g: 'ID_G',
      soghe: 'SoGhe', loaighe: 'LoaiGhe', giave: 'GiaVe', id_dv: 'ID_DV'
    };

    return res.rows.map(row => {
      const out = Object.assign({}, row);
      for (const key of Object.keys(row)) {
        const lower = key.toLowerCase();
        if (mapping[lower]) {
          out[mapping[lower]] = row[key];
        } else if (lower.includes('_')) {
          const parts = lower.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1));
          out[parts.join('_')] = row[key];
        }
      }
      return out;
    });
  },

  pool
};