const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Task = require('../models/Task');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and documents are allowed'));
    }
  }
});

// Create task
router.post('/', auth, [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
  body('dueDate').optional().isISO8601().withMessage('Invalid date format'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('tags').optional().isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, assignedTo, dueDate, priority = 'medium', tags = [] } = req.body;

    // Verify assigned user exists if provided
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ message: 'Assigned user not found' });
      }
    }

    const task = new Task({
      title,
      description,
      assignedTo,
      createdBy: req.user.userId,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      priority,
      tags: tags.map(tag => tag.trim()).filter(tag => tag)
    });

    await task.save();
    await task.populate('assignedTo', 'username email firstName lastName');
    await task.populate('createdBy', 'username email firstName lastName');

    // Emit real-time notification
    if (task.assignedTo && task.assignedTo._id.toString() !== req.user.userId) {
      global.io.to(task.assignedTo._id.toString()).emit('task-assigned', {
        task: task,
        message: `You have been assigned a new task: ${task.title}`
      });
    }

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Server error creating task' });
  }
});

// Get all tasks
router.get('/', auth, async (req, res) => {
  try {
    const { status, priority, assignedTo, page = 1, limit = 10 } = req.query;
    
    const options = {
      status,
      priority,
      assignedTo,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const tasks = await Task.findAll(options);
    const total = await Task.countAll({ status, priority, assignedTo });

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
});

// Get my tasks
router.get('/my', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    const options = {
      status,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const tasks = await Task.findMyTasks(req.user.userId, options);
    const total = await Task.countMyTasks(req.user.userId, { status });

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    console.error('Get my tasks error:', error);
    res.status(500).json({ message: 'Server error fetching tasks' });
  }
});

// Get single task
router.get('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'username email firstName lastName')
      .populate('createdBy', 'username email firstName lastName')
      .populate('comments.author', 'username firstName lastName');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ message: 'Server error fetching task' });
  }
});

// Update task
router.put('/:id', auth, [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('assignedTo').optional().isMongoId().withMessage('Invalid user ID'),
  body('dueDate').optional().isISO8601().withMessage('Invalid date format'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority'),
  body('status').optional().isIn(['todo', 'in-progress', 'completed']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { title, description, assignedTo, dueDate, priority, status } = req.body;

    // Verify assigned user exists if provided
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (!assignedUser) {
        return res.status(400).json({ message: 'Assigned user not found' });
      }
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;
    if (dueDate !== undefined) task.dueDate = new Date(dueDate);
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;

    await task.save();
    await task.populate('assignedTo', 'username email firstName lastName');
    await task.populate('createdBy', 'username email firstName lastName');

    // Emit real-time notification for status change
    if (status && task.assignedTo && task.assignedTo._id.toString() !== req.user.userId) {
      global.io.to(task.assignedTo._id.toString()).emit('task-updated', {
        task: task,
        message: `Task "${task.title}" status changed to ${status}`
      });
    }

    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Server error updating task' });
  }
});

// Delete task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Server error deleting task' });
  }
});

// Add comment to task
router.post('/:id/comments', auth, [
  body('text').trim().notEmpty().withMessage('Comment text is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { text } = req.body;
    const taskId = req.params.id;

    const task = await Task.addComment(taskId, {
      text,
      authorId: req.user.userId
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Emit real-time notification
    if (task.assignedTo && task.assignedTo._id.toString() !== req.user.userId) {
      global.io.to(task.assignedTo._id.toString()).emit('comment-added', {
        taskId: task._id,
        comment: task.comments[task.comments.length - 1],
        message: `New comment added to task: ${task.title}`
      });
    }

    res.json({
      message: 'Comment added successfully',
      comment: task.comments[task.comments.length - 1]
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ message: 'Server error adding comment' });
  }
});

// Upload attachment to task
router.post('/:id/attachments', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const taskId = req.params.id;
    const { filename, originalname, path: filePath, size, mimetype } = req.file;

    const task = await Task.addAttachment(taskId, {
      filename,
      originalName: originalname,
      path: filePath,
      size,
      mimetype
    });

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      message: 'File uploaded successfully',
      attachment: task.attachments[task.attachments.length - 1]
    });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ message: 'Server error uploading file' });
  }
});

// Add tags to task
router.post('/:id/tags', auth, [
  body('tags').isArray().withMessage('Tags must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { tags } = req.body;
    const taskId = req.params.id;

    const task = await Task.addTagsToTask(taskId, tags);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({
      message: 'Tags added successfully',
      tags: task.tags
    });
  } catch (error) {
    console.error('Add tags error:', error);
    res.status(500).json({ message: 'Server error adding tags' });
  }
});

// Get task statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Task.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalTasks = await Task.countDocuments();
    const completedTasks = await Task.countDocuments({ status: 'completed' });
    const overdueTasks = await Task.countDocuments({
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' }
    });

    res.json({
      status: 'success',
      data: {
        totalTasks,
        completedTasks,
        pendingTasks: totalTasks - completedTasks,
        overdueTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0,
        statusBreakdown: stats,
        priorityBreakdown: priorityStats
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error fetching statistics' });
  }
});

// Bulk update tasks
router.put('/bulk', auth, [
  body('taskIds').isArray().withMessage('Task IDs must be an array'),
  body('updates').isObject().withMessage('Updates must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { taskIds, updates } = req.body;

    const result = await Task.updateMany(
      { _id: { $in: taskIds } },
      updates,
      { new: true }
    );

    res.json({
      message: 'Tasks updated successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ message: 'Server error updating tasks' });
  }
});

// Advanced search
router.get('/search', auth, async (req, res) => {
  try {
    const { q, status, priority, assignedTo, tags, page = 1, limit = 10 } = req.query;

    const searchQuery = {};

    // Text search
    if (q) {
      searchQuery.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    // Filters
    if (status) searchQuery.status = status;
    if (priority) searchQuery.priority = priority;
    if (assignedTo) searchQuery.assignedTo = assignedTo;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      searchQuery.tags = { $in: tagArray };
    }

    const tasks = await Task.find(searchQuery)
      .populate('assignedTo', 'username email firstName lastName')
      .populate('createdBy', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(searchQuery);

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total,
      query: { q, status, priority, assignedTo, tags }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error searching tasks' });
  }
});

// Export tasks to CSV
router.get('/export', auth, async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const tasks = await Task.find()
      .populate('assignedTo', 'username email firstName lastName')
      .populate('createdBy', 'username email firstName lastName')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csv = [
        'Title,Description,Status,Priority,Assigned To,Created By,Due Date,Created At'
      ];

      tasks.forEach(task => {
        csv.push([
          `"${task.title}"`,
          `"${task.description.replace(/"/g, '""')}"`,
          task.status,
          task.priority,
          task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '',
          task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : '',
          task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
          new Date(task.createdAt).toISOString().split('T')[0]
        ].join(','));
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tasks.csv');
      res.send(csv.join('\n'));
    } else {
      res.json({ tasks });
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ message: 'Server error exporting tasks' });
  }
});

module.exports = router;
