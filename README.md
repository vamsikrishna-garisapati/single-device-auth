# Single Device Authentication System

A proof of concept for a single-device authentication system where users can only log in from one registered device at a time. When attempting to log in from a new device, a device change request is created that requires admin approval.

## Features

### User Features
- **User Registration**: Create new accounts with username, email, and password
- **Single Device Login**: Login from only one registered device
- **Device Change Requests**: Request permission to use a new device
- **Request Status Tracking**: View the status of device change requests

### Admin Features
- **Dashboard**: Overview of system statistics and recent activity
- **Request Management**: View, approve, or reject device change requests
- **User Management**: View all registered users
- **Request Details**: Detailed view of device information and request history

## Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT tokens
- **Security**: bcrypt for password hashing, rate limiting
- **Frontend**: Vanilla HTML, CSS, JavaScript

## Installation

1. **Prerequisites**
   - Node.js (v14 or higher)
   - MongoDB (running locally or accessible remotely)

2. **Clone and Install**
   ```bash
   cd singleLog
   npm install
   ```

3. **Configuration**
   - **Create .env file**:
     ```bash
     # Copy the template
     copy env-template.txt .env
     # Edit .env with your settings
     ```
   
   - **Environment Variables** (in .env file):
     ```
     NODE_ENV=development
     PORT=3001
     MONGODB_URI=mongodb://localhost:27017/single-device-auth
     JWT_SECRET=Fl8cyGu+YYq64x5NM2ZeaScdocl8GjzGlZH3kNhwGR4=
     JWT_EXPIRES_IN=24h
     ADMIN_USERNAME=admin
     ADMIN_EMAIL=admin@example.com
     ADMIN_PASSWORD=admin123
     ALLOWED_ORIGINS=http://localhost:3001,http://127.0.0.1:3001
     ```
   
   - **Important**: 
     - Change JWT_SECRET to a strong, unique value
     - Change admin credentials in production
     - Use MongoDB Atlas for production database

4. **Start the Application**
   ```bash
   npm start
   # or for development
   npm run dev
   ```

## 🔒 Security Considerations

- **JWT Secret**: Generate a strong, unique secret for production
- **Admin Credentials**: Change default admin password in production  
- **Database**: Use MongoDB Atlas or secure database in production
- **CORS**: Configure ALLOWED_ORIGINS for your domains
- **Environment**: Never commit .env files to version control

5. **Access the Application**
   - User Interface: http://localhost:3001
   - Admin Dashboard: http://localhost:3001/admin.html
   - API Health Check: http://localhost:3001/health

## Default Admin Account

The system automatically creates a default admin account on first startup:
- **Email**: admin@example.com
- **Password**: admin123

⚠️ **Important**: Change the default admin password in production!

## API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - User registration
- `POST /login` - User login with device validation
- `POST /logout` - User logout
- `GET /me` - Get current user info
- `POST /request-device-change` - Request device change
- `GET /my-requests` - Get user's device change requests

### Admin Routes (`/api/admin`)
- `GET /dashboard` - Get dashboard statistics
- `GET /requests` - Get all device change requests
- `GET /requests/:id` - Get specific request details
- `POST /requests/:id/approve` - Approve device change request
- `POST /requests/:id/reject` - Reject device change request
- `GET /users` - Get all users
- `GET /users/:id` - Get user details

## How It Works

### Device Registration
1. When a user first registers, their device is automatically registered
2. A unique device ID is generated based on user ID, user agent, and IP address
3. This device ID is stored and associated with the user

### Login Process
1. User attempts to log in with email and password
2. System generates device ID for the current request
3. If device is registered: Login succeeds
4. If device is not registered: Device change request is created automatically

### Device Change Requests
1. User can manually request device change from dashboard
2. Admin receives notification of pending request
3. Admin can view device details and approve/reject
4. Upon approval, new device is registered and old device is removed

### Security Features
- Rate limiting on authentication endpoints
- JWT token expiration
- Password hashing with bcrypt
- Device fingerprinting using multiple factors
- Admin-only access to management functions

## Database Models

### User Model
- Basic user information (username, email, password)
- Role-based access (user/admin)
- Registered devices array
- Current active device ID

### DeviceChangeRequest Model
- User reference and details
- Current and new device information
- Request status (pending/approved/rejected)
- Admin review information
- Timestamps and notes

## Usage Examples

### Register a New User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Login from Registered Device
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Request Device Change
```bash
curl -X POST http://localhost:3001/api/auth/request-device-change \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Switching to new laptop"
  }'
```

## Production Considerations

1. **Security**
   - Change default admin credentials
   - Use strong JWT secrets
   - Enable HTTPS
   - Implement proper CORS policies
   - Add input validation and sanitization

2. **Database**
   - Use MongoDB Atlas or dedicated MongoDB instance
   - Set up proper indexes for performance
   - Implement database backups

3. **Monitoring**
   - Add logging and monitoring
   - Implement health checks
   - Set up error tracking

4. **Scalability**
   - Consider Redis for session management
   - Implement proper caching strategies
   - Add load balancing for multiple instances

## License

MIT License - feel free to use this code for educational or commercial purposes.

