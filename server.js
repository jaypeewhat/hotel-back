const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware with increased limits
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_name TEXT NOT NULL,
    work_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
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
    db.run('INSERT INTO rooms (number, type, capacity, price, amenities, status) VALUES (?, ?, ?, ?, ?, ?)',
      [room.number, room.type, room.capacity, room.price, room.amenities, room.status]);
  });
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hotel Management Backend API is running!',
    timestamp: new Date().toISOString(),
    endpoints: {
      submissions: '/api/submissions',
      rooms: '/api/rooms'
    }
  });
});

// Get all submissions
app.get('/api/submissions', (req, res) => {
  console.log('📥 GET /api/submissions');
  
  db.all('SELECT * FROM submissions ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      console.error('❌ Database error:', err);
      res.status(500).json({ success: false, error: 'Database error: ' + err.message });
      return;
    }
    
    console.log(`✅ Returning ${rows.length} submissions`);
    res.json({ success: true, data: rows, count: rows.length });
  });
});

// Submit new work - with comprehensive error handling
app.post('/api/submissions', (req, res) => {
  console.log('📥 POST /api/submissions');
  console.log('📊 Request size:', JSON.stringify(req.body).length, 'characters');
  
  try {
    const { studentName, workType, content } = req.body;
    
    console.log('🔍 Fields received:');
    console.log('  - studentName:', studentName ? '✅' : '❌');
    console.log('  - workType:', workType ? '✅' : '❌');
    console.log('  - content:', content ? '✅' : '❌');
    console.log('  - content length:', content ? content.length : 0);
    
    // Validation
    if (!studentName || !workType || !content) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false,
        error: 'Missing required fields: studentName, workType, content',
        received: { studentName: !!studentName, workType: !!workType, content: !!content }
      });
    }

    // Validate work type
    const validWorkTypes = ['room_request', 'report', 'financial_report'];
    if (!validWorkTypes.includes(workType)) {
      console.log(`❌ Invalid work type: ${workType}`);
      return res.status(400).json({ 
        success: false,
        error: `Invalid work type: ${workType}. Valid types: ${validWorkTypes.join(', ')}`
      });
    }

    console.log(`📝 Saving submission: ${workType} from ${studentName}`);

    // Insert into database
    db.run(
      'INSERT INTO submissions (student_name, work_type, content) VALUES (?, ?, ?)',
      [studentName, workType, content],
      function(err) {
        if (err) {
          console.error('❌ Database insert error:', err);
          console.error('   Error code:', err.code);
          console.error('   Error message:', err.message);
          
          return res.status(500).json({ 
            success: false,
            error: 'Database error: ' + err.message,
            code: err.code
          });
        }

        console.log(`✅ Submission saved with ID: ${this.lastID}`);
        
        // Return the created submission
        db.get('SELECT * FROM submissions WHERE id = ?', [this.lastID], (err, row) => {
          if (err) {
            console.error('❌ Error retrieving saved submission:', err);
            return res.status(500).json({ 
              success: false,
              error: 'Error retrieving saved submission: ' + err.message
            });
          }
          
          console.log('✅ Submission created successfully');
          res.status(201).json({ success: true, data: row });
        });
      }
    );
    
  } catch (error) {
    console.error('❌ Unexpected error in POST /api/submissions:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error: ' + error.message,
      stack: error.stack
    });
  }
});

// Get all rooms
app.get('/api/rooms', (req, res) => {
  db.all('SELECT * FROM rooms ORDER BY number', (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      res.status(500).json({ success: false, error: 'Database error: ' + err.message });
      return;
    }
    
    const roomsWithParsedAmenities = rows.map(room => ({
      ...room,
      amenities: JSON.parse(room.amenities || '[]')
    }));
    
    res.json({ success: true, data: roomsWithParsedAmenities, count: rows.length });
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Unhandled error:', err);
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hotel Management Backend running on port ${PORT}`);
  console.log(`📡 API Endpoints available:`);
  console.log(`   GET  / - Health check`);
  console.log(`   GET  /api/submissions - Get all submissions`);
  console.log(`   POST /api/submissions - Submit new work`);
  console.log(`   GET  /api/rooms - Get all rooms`);
  console.log(`🛡️  CORS enabled, JSON limit: 100MB`);
});
