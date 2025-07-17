const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new sqlite3.Database(':memory:'); // In-memory for simplicity

// Create submissions table
db.serialize(() => {
  db.run(`CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    work_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hotel Submission Backend API', 
    status: 'Running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      submissions: '/api/submissions'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/submissions', (req, res) => {
  db.all('SELECT * FROM submissions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
      return;
    }
    
    // Transform database rows to match frontend format
    const submissions = rows.map(row => ({
      id: row.id,
      studentName: row.student_name,
      type: row.work_type,
      title: JSON.parse(row.content).title || 'Untitled',
      description: JSON.parse(row.content).description || '',
      data: JSON.parse(row.content).data || {},
      submittedAt: row.created_at,
      studentId: JSON.parse(row.content).studentId,
      studentEmail: JSON.parse(row.content).studentEmail
    }));
    
    console.log(`📋 Retrieved ${submissions.length} submissions`);
    res.json(submissions);
  });
});

app.post('/api/submissions', (req, res) => {
  const { studentName, workType, content } = req.body;
  
  // Validation
  if (!studentName || !workType || !content) {
    res.status(400).json({ 
      success: false,
      error: 'Missing required fields: studentName, workType, content' 
    });
    return;
  }

  // Validate work type
  const validWorkTypes = ['room_request', 'report', 'financial_report'];
  if (!validWorkTypes.includes(workType)) {
    res.status(400).json({ 
      success: false,
      error: `Invalid work type: ${workType}. Valid types: ${validWorkTypes.join(', ')}` 
    });
    return;
  }

  console.log(`📝 Received submission: ${workType} from ${studentName}`);

  db.run(
    'INSERT INTO submissions (student_name, work_type, content) VALUES (?, ?, ?)',
    [studentName, workType, content],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ 
          success: false,
          error: 'Database error: ' + err.message 
        });
        return;
      }
      
      const newSubmission = {
        id: this.lastID,
        studentName,
        workType,
        content: JSON.parse(content),
        submittedAt: new Date().toISOString()
      };
      
      console.log(`✅ Submission saved with ID: ${this.lastID}`);
      res.json({ 
        success: true,
        data: newSubmission,
        message: 'Submission saved successfully' 
      });
    }
  );
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found' 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API docs: http://localhost:${PORT}/`);
});
