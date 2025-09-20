# 🚀 Render Deployment Guide

## Quick Deploy to Render

### Step 1: Prepare Your Repository
1. Push your code to GitHub
2. Make sure all files are committed

### Step 2: Deploy to Render
1. Go to https://render.com
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

### Step 3: Add MongoDB Database
1. In Render dashboard, click "New" → "MongoDB"
2. Choose "Free" plan
3. Copy the connection string

### Step 4: Configure Environment Variables
In your web service settings, add these environment variables:

```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://... (paste the connection string from step 3)
JWT_SECRET=your-very-strong-secret-key-here
ALLOWED_ORIGINS=https://your-app-name.onrender.com
```

### Step 5: Deploy
1. Click "Create Web Service"
2. Wait for deployment to complete
3. Your app will be available at: https://your-app-name.onrender.com

## Access Your App

- **Main App**: https://your-app-name.onrender.com
- **Admin Dashboard**: https://your-app-name.onrender.com/admin.html
- **API Health**: https://your-app-name.onrender.com/health

## Default Admin Login

- **Email**: admin@example.com
- **Password**: admin123

⚠️ **Important**: Change the default admin password after deployment!

## Features

- ✅ User registration and login
- ✅ Single device authentication
- ✅ Device change requests
- ✅ Admin dashboard
- ✅ Secure JWT authentication
- ✅ MongoDB database
- ✅ Responsive design

Your Single Device Authentication System is now live and accessible worldwide! 🌍
