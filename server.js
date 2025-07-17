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

// Create tables
db.serialize(() => {
  // Submissions table
  db.run(`CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    work_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Rooms table
  db.run(`CREATE TABLE rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    price REAL NOT NULL,
    amenities TEXT,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Insert sample rooms
  const sampleRooms = [
    { number: '101', type: 'Standard', capacity: 2, price: 2500, amenities: JSON.stringify(['WiFi', 'AC', 'TV']), status: 'available' },
    { number: '102', type: 'Standard', capacity: 2, price: 2500, amenities: JSON.stringify(['WiFi', 'AC', 'TV']), status: 'occupied' },
    { number: '201', type: 'Deluxe', capacity: 3, price: 3500, amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Mini Bar']), status: 'available' },
    { number: '202', type: 'Deluxe', capacity: 3, price: 3500, amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Mini Bar']), status: 'maintenance' },
    { number: '301', type: 'Suite', capacity: 4, price: 5000, amenities: JSON.stringify(['WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony']), status: 'available' }
  ];
  
  sampleRooms.forEach(room => {
    db.run(
      'INSERT INTO rooms (number, type, capacity, price, amenities, status) VALUES (?, ?, ?, ?, ?, ?)',
      [room.number, room.type, room.capacity, room.price, room.amenities, room.status]
    );
  });
});

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hotel Submission Backend API', 
    status: 'Running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      submissions: '/api/submissions',
      rooms: '/api/rooms'
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

// ROOMS API ENDPOINTS
app.get('/api/rooms', (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY number ASC', (err, rows) => {
    if (err) {
      res.status(500).json({ 
        success: false,
        error: err.message 
      });
      return;
    }
    
    // Transform database rows to match frontend format
    const rooms = rows.map(row => ({
      id: row.id,
      number: row.number,
      type: row.type,
      capacity: row.capacity,
      price: row.price,
      amenities: JSON.parse(row.amenities || '[]'),
      status: row.status,
      createdAt: row.created_at
    }));
    
    console.log(`🏨 Retrieved ${rooms.length} rooms`);
    res.json(rooms);
  });
});

app.post('/api/rooms', (req, res) => {
  const { number, type, capacity, price, amenities, status } = req.body;
  
  // Validation
  if (!number || !type || !capacity || !price) {
    res.status(400).json({ 
      success: false,
      error: 'Missing required fields: number, type, capacity, price' 
    });
    return;
  }

  console.log(`🏨 Creating new room: ${number} (${type})`);

  db.run(
    'INSERT INTO rooms (number, type, capacity, price, amenities, status) VALUES (?, ?, ?, ?, ?, ?)',
    [number, type, capacity, price, JSON.stringify(amenities || []), status || 'available'],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ 
          success: false,
          error: 'Database error: ' + err.message 
        });
        return;
      }
      
      const newRoom = {
        id: this.lastID,
        number,
        type,
        capacity,
        price,
        amenities: amenities || [],
        status: status || 'available',
        createdAt: new Date().toISOString()
      };
      
      console.log(`✅ Room created with ID: ${this.lastID}`);
      res.json({ 
        success: true,
        data: newRoom,
        message: 'Room created successfully' 
      });
    }
  );
});

app.put('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id;
  const { number, type, capacity, price, amenities, status } = req.body;
  
  console.log(`🏨 Updating room ID: ${roomId}`);

  db.run(
    'UPDATE rooms SET number = ?, type = ?, capacity = ?, price = ?, amenities = ?, status = ? WHERE id = ?',
    [number, type, capacity, price, JSON.stringify(amenities || []), status, roomId],
    function(err) {
      if (err) {
        console.error('Database error:', err);
        res.status(500).json({ 
          success: false,
          error: 'Database error: ' + err.message 
        });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ 
          success: false,
          error: 'Room not found' 
        });
        return;
      }
      
      console.log(`✅ Room ${roomId} updated successfully`);
      res.json({ 
        success: true,
        message: 'Room updated successfully' 
      });
    }
  );
});

app.delete('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id;
  
  console.log(`🏨 Deleting room ID: ${roomId}`);

  db.run('DELETE FROM rooms WHERE id = ?', [roomId], function(err) {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ 
        success: false,
        error: 'Database error: ' + err.message 
      });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ 
        success: false,
        error: 'Room not found' 
      });
      return;
    }
    
    console.log(`✅ Room ${roomId} deleted successfully`);
    res.json({ 
      success: true,
      message: 'Room deleted successfully' 
    });
  });
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
