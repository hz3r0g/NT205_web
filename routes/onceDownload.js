const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const router = express.Router();

const FILE_PATH = path.join(__dirname, '..', 'public', 'resources', 'data.bin');

router.get('/download/data.bin', async (req, res) => {
    const lockedPath = FILE_PATH + '.' + Date.now() + '.lock';

    try {
        await fsp.rename(FILE_PATH, lockedPath);
    } catch (err) {
        return res.status(404).send('File not found or already downloaded');
    }

    res.download(lockedPath, 'data.bin', async (err) => {
        try { await fsp.unlink(lockedPath); } catch (e) { /* ignore */ }
        if (err && !res.headersSent) {
            // If download failed, send a 500 if possible
            try { res.status(500).send('Download failed'); } catch (e) { /* ignore */ }
        }
    });
});

module.exports = router;
