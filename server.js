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
  
  console.log('Save request received:', {
    action: req.body.action,
    file: req.body.file,
    hasHtml: !!req.body.html,
    startTemplateUrl: req.body.startTemplateUrl
  });

  const { html, file, action, startTemplateUrl } = req.body;

  try {
    if (action === 'rename') {
      // Lógica para renombrar archivo
      const { file, newfile, duplicate } = req.body;
      
      if (!file || !newfile) {
        return res.status(500).send('File name not provided!');
      }
      
      if (duplicate) {
        fs.copyFileSync(file, newfile);
        res.json({
          success: true,
          message: `File duplicated from '${file}' to '${newfile}'`
        });
      } else {
        fs.renameSync(file, newfile);
        res.json({
          success: true,
          message: `File renamed from '${file}' to '${newfile}'`
        });
      }
      return;
    }

    if (action === 'delete') {
      // Lógica para eliminar archivo
      const { file } = req.body;
      
      if (!file) {
        return res.status(500).send('File name not provided!');
      }
      
      fs.unlinkSync(file);
      res.json({
        success: true,
        message: `File deleted '${file}'`
      });
      return;
    }

    // Guardar archivo
    let content = '';
    
    console.log('Processing content...');
    try {
      if (startTemplateUrl) {
        // Si se proporciona una plantilla inicial, usar su contenido
        content = fs.readFileSync(startTemplateUrl, 'utf8');
        console.log('Using template content from:', startTemplateUrl);
      } else if (html) {
        content = html.toString();
        if (content.length > MAX_FILE_LIMIT) {
          console.warn('HTML content truncated from', content.length, 'to', MAX_FILE_LIMIT);
          content = content.substring(0, MAX_FILE_LIMIT);
        }
      } else {
        console.error('No content provided');
        return res.status(500).send('Html content is empty!');
      }

      if (!file) {
        console.error('No filename provided');
        return res.status(500).send('Filename is empty!');
      }
    } catch (err) {
      console.error('Error processing content:', err);
      return res.status(500).send(`Error processing content: ${err.message}`);
    }

    const dir = path.dirname(file);
    
    if (!fs.existsSync(dir)) {
      console.log(`${dir} folder does not exist`);
      fs.mkdirSync(dir, { recursive: true });
      console.log(`${dir} folder was created`);
    }

    console.log('Writing file:', file);
    console.log('Content length:', content.length);
    
    fs.writeFileSync(file, content);
    console.log('File written successfully');
    
    res.json({
      success: true,
      message: `File saved '${file}'`
    });

  } catch (error) {
    console.error('Error in /api/save:', error);
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
