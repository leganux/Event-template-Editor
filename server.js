const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { glob } = require('glob');

const app = express();
const port = 2222;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Configuración de multer para subida de archivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = req.body.mediaPath || 'media';
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// Ruta principal - sirve el editor
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'editor.html'));
});

// API para guardar archivos
app.post('/api/save', (req, res) => {
  const MAX_FILE_LIMIT = 1024 * 1024 * 2; // 2MB
  const { html, file, action } = req.body;

  try {
    if (action === 'rename') {
      // Lógica para renombrar archivo
      const { oldFile, newFile } = req.body;
      fs.renameSync(oldFile, newFile);
      res.send(`File renamed from '${oldFile}' to '${newFile}'`);
      return;
    }

    if (action === 'delete') {
      // Lógica para eliminar archivo
      const { file } = req.body;
      fs.unlinkSync(file);
      res.send(`File deleted '${file}'`);
      return;
    }

    // Guardar archivo
    if (!html) {
      return res.status(500).send('HTML content is empty!');
    }

    if (!file) {
      return res.status(500).send('Filename is empty!');
    }

    const content = html.substring(0, MAX_FILE_LIMIT);
    const dir = path.dirname(file);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(file, content);
    res.send(`File saved '${file}'`);

  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// API para escanear archivos
app.post('/api/media', (req, res) => {
  const mediaPath = req.body.mediaPath || 'media';
  const scandir = path.join(__dirname, mediaPath);

  const scan = (dir) => {
    const files = [];

    if (fs.existsSync(dir)) {
      fs.readdirSync(dir).forEach(f => {
        if (f[0] === '.') return;

        const filePath = path.join(dir, f);
        if (fs.statSync(filePath).isDirectory()) {
          files.push({
            name: f,
            type: 'folder',
            path: path.relative(scandir, filePath),
            items: scan(filePath)
          });
        } else {
          files.push({
            name: f,
            type: 'file',
            path: path.relative(scandir, filePath),
            size: fs.statSync(filePath).size
          });
        }
      });
    }

    return files;
  };

  res.json({
    name: '',
    type: 'folder',
    path: '',
    items: scan(scandir)
  });
});

// API para subir archivos
app.post('/api/upload', upload.single('file'), (req, res) => {
  const uploadDenyExtensions = ['php'];
  const file = req.file;

  if (!file) {
    return res.status(500).send('No file uploaded');
  }

  const extension = path.extname(file.originalname).toLowerCase().substring(1);
  if (uploadDenyExtensions.includes(extension)) {
    return res.status(500).send(`File type ${extension} not allowed!`);
  }

  const response = req.body.onlyFilename ? file.filename : path.join(req.body.mediaPath || '', file.filename);
  res.send(response);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
