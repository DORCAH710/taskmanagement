const mongoose = require('mongoose');
const User = require('../models/User');
const Task = require('../models/Task');
require('dotenv').config();

const seedTasks = async () => {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing tasks
    await Task.deleteMany({});
    console.log('Cleared existing tasks');

    // Create sample users
    const users = await User.find();
    if (users.length < 3) {
      const sampleUsers = [
        {
          username: 'john_doe',
          email: 'john@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'user'
        },
        {
          username: 'jane_smith',
          email: 'jane@example.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'user'
        },
        {
          username: 'admin',
          email: 'admin@example.com',
          password: 'admin123',
          firstName: 'Admin',
          lastName: 'User',
          role: 'admin'
        }
      ];

      await User.insertMany(sampleUsers);
      console.log('Created sample users');
    }

    // Get users for task assignment
    const allUsers = await User.find();
    const adminUser = allUsers.find(u => u.role === 'admin');
    const regularUsers = allUsers.filter(u => u.role === 'user');

    // Create professional mock tasks
    const mockTasks = [
      {
        title: 'Setup Project Infrastructure',
        description: 'Configure AWS EC2 instances, RDS database, and S3 storage for the new e-commerce platform. Ensure all security groups are properly configured and SSL certificates are installed.',
        status: 'in-progress',
        priority: 'high',
        assignedTo: regularUsers[0],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        tags: ['infrastructure', 'aws', 'devops', 'high-priority']
      },
      {
        title: 'Implement User Authentication System',
        description: 'Develop JWT-based authentication with refresh tokens, password reset functionality, and OAuth integration for Google and GitHub. Include proper validation and rate limiting.',
        status: 'todo',
        priority: 'high',
        assignedTo: regularUsers[1],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        tags: ['authentication', 'security', 'backend', 'jwt']
      },
      {
        title: 'Design Database Schema',
        description: 'Create comprehensive ERD for the e-commerce platform including users, products, orders, payments, and inventory tables. Optimize for performance and scalability.',
        status: 'completed',
        priority: 'medium',
        assignedTo: regularUsers[0],
        createdBy: adminUser,
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        tags: ['database', 'design', 'architecture', 'completed']
      },
      {
        title: 'Build React Dashboard',
        description: 'Create responsive admin dashboard with real-time analytics, user management, product catalog, and order tracking. Use Material-UI or Tailwind CSS.',
        status: 'in-progress',
        priority: 'medium',
        assignedTo: regularUsers[1],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        tags: ['frontend', 'react', 'dashboard', 'ui']
      },
      {
        title: 'API Documentation',
        description: 'Write comprehensive API documentation using Swagger/OpenAPI. Include all endpoints, request/response examples, authentication requirements, and error codes.',
        status: 'todo',
        priority: 'low',
        assignedTo: regularUsers[0],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
        tags: ['documentation', 'api', 'swagger']
      },
      {
        title: 'Payment Gateway Integration',
        description: 'Integrate Stripe and PayPal payment gateways. Implement webhook handling, refund processing, and transaction logging. Ensure PCI compliance.',
        status: 'todo',
        priority: 'high',
        assignedTo: regularUsers[1],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        tags: ['payment', 'stripe', 'paypal', 'security']
      },
      {
        title: 'Mobile App Development',
        description: 'Develop React Native mobile app for iOS and Android. Include core features: product browsing, cart, checkout, and order history.',
        status: 'todo',
        priority: 'medium',
        assignedTo: regularUsers[0],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
        tags: ['mobile', 'react-native', 'ios', 'android']
      },
      {
        title: 'Performance Optimization',
        description: 'Optimize database queries, implement Redis caching, and set up CDN for static assets. Target 95+ page speed score.',
        status: 'in-progress',
        priority: 'medium',
        assignedTo: regularUsers[1],
        createdBy: adminUser,
        dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
        tags: ['performance', 'optimization', 'redis', 'cdn']
      }
    ];

    await Task.insertMany(mockTasks);
    console.log('Created 8 professional mock tasks');

    console.log('✅ Database seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedTasks();
